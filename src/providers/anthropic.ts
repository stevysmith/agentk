// ============================================================
// agentk — Anthropic provider
//
// Claude API integration with streaming support (P1.8) and
// hardened response parsing (P1.7).
// ============================================================

import type { AgentKProvider, AgentKToolCall, AgentKPlan } from './types'
import { toToolSchema, buildSystemPrompt, buildFallbackSummary } from './utils'

/**
 * Anthropic (Claude) LLM provider.
 *
 * @description Calls the Anthropic Messages API to translate natural language
 * into tool calls. Supports both standard request/response and SSE streaming
 * modes. Handles `thinking` blocks (skipped), `error` blocks (thrown), and
 * missing/null content gracefully.
 *
 * @param prompt - The user's natural language input
 * @param tools - Available tools the LLM can call
 * @param config - Agent configuration. Uses `claude-sonnet-4-20250514` by default.
 * @param signal - Optional AbortSignal for request cancellation
 * @returns A promise resolving to an execution plan
 *
 * @example
 * ```ts
 * import { anthropicProvider } from 'agentk/providers/anthropic'
 *
 * const plan = await anthropicProvider(
 *   'Search for flights to Tokyo',
 *   tools,
 *   { provider: 'anthropic', apiKey: 'sk-...' }
 * )
 * ```
 */
export const anthropicProvider: AgentKProvider = async (prompt, tools, config, signal) => {
  const endpoint = config.endpoint || 'https://api.anthropic.com/v1/messages'
  const model = config.model || 'claude-sonnet-4-20250514'

  const body: Record<string, any> = {
    model,
    // Default raised from 1024: a tool call that fills a large argument (e.g. a
    // full HTML document) is truncated at a low cap, so its input JSON never
    // completes and arrives empty. Override per model via config.maxTokens.
    max_tokens: config.maxTokens ?? 8192,
    system: config.systemPrompt || buildSystemPrompt(tools),
    tools: tools.map((t) => {
      const schema = toToolSchema(t)
      return {
        name: schema.name,
        description: schema.description,
        input_schema: schema.inputSchema,
      }
    }),
    messages: [{ role: 'user', content: prompt }],
  }

  if (config.stream) {
    body.stream = true
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (config.apiKey) {
    headers['x-api-key'] = config.apiKey
    headers['anthropic-version'] = '2023-06-01'
    headers['anthropic-dangerous-direct-browser-access'] = 'true'
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Anthropic API error ${res.status}: ${text}`)
  }

  // Streaming mode
  if (config.stream) {
    return parseAnthropicStream(res, config.onProviderError, signal)
  }

  // Standard mode
  return parseAnthropicResponse(res, config.onProviderError)
}

/**
 * Parses a standard (non-streaming) Anthropic API response.
 *
 * @param res - The fetch Response object
 * @param onError - Optional error callback for non-fatal parsing issues
 * @returns A parsed AgentKPlan
 * @throws {Error} If the response is not valid JSON or contains an API error
 *
 * @internal
 */
async function parseAnthropicResponse(
  res: Response,
  onError?: (error: Error) => void,
): Promise<AgentKPlan> {
  const contentType = res.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    const text = await res.text()
    throw new Error(
      `Anthropic API returned unexpected content-type "${contentType}". Body: ${text.slice(0, 500)}`,
    )
  }

  let data: any
  try {
    data = await res.json()
  } catch {
    throw new Error('Anthropic API returned invalid JSON in response body')
  }

  // Handle top-level error responses
  if (data.type === 'error') {
    throw new Error(
      `Anthropic API error: ${data.error?.message || JSON.stringify(data.error) || 'Unknown error'}`,
    )
  }

  const calls: AgentKToolCall[] = []
  let summary = ''

  // Handle missing or null content array
  if (!data.content || !Array.isArray(data.content)) {
    if (onError) {
      onError(new Error('Anthropic API response missing content array'))
    }
    return { calls: [], summary: '' }
  }

  for (const block of data.content) {
    // Skip thinking blocks (extended thinking feature)
    if (block.type === 'thinking') {
      continue
    }

    // Handle error blocks
    if (block.type === 'error') {
      const errorMsg = `Anthropic content error: ${block.error?.message || JSON.stringify(block)}`
      if (onError) {
        onError(new Error(errorMsg))
      }
      throw new Error(errorMsg)
    }

    if (block.type === 'tool_use') {
      calls.push({
        toolName: block.name,
        parameters: block.input || {},
      })
    } else if (block.type === 'text') {
      summary = block.text
    }
  }

  if (!summary && calls.length > 0) {
    summary = buildFallbackSummary(calls.map((c) => c.toolName))
  }

  return { calls, summary }
}

/**
 * Parses an SSE streaming response from the Anthropic Messages API.
 *
 * @description Processes Server-Sent Events incrementally, building content blocks
 * as deltas arrive. Handles these event types:
 * - `message_start` — message metadata
 * - `content_block_start` — begins a new text or tool_use block
 * - `content_block_delta` — appends text or JSON input deltas
 * - `content_block_stop` — finalizes a block
 * - `message_delta` — stop reason
 * - `message_stop` — stream complete
 * - `error` — stream error
 *
 * @param res - The fetch Response with an SSE body
 * @param onError - Optional error callback for non-fatal streaming issues
 * @param signal - Optional AbortSignal to cancel streaming
 * @returns A promise resolving to the complete AgentKPlan
 * @throws {Error} On network errors, abort, or stream error events
 *
 * @internal
 */
async function parseAnthropicStream(
  res: Response,
  onError?: (error: Error) => void,
  signal?: AbortSignal,
): Promise<AgentKPlan> {
  if (!res.body) {
    throw new Error('Anthropic streaming response has no body')
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()

  // Track content blocks as they stream in
  const blocks: Array<{
    type: 'text' | 'tool_use'
    text?: string
    name?: string
    inputJson?: string
  }> = []
  let currentBlockIndex = -1
  let buffer = ''

  try {
    while (true) {
      // Check for abort before reading
      if (signal?.aborted) {
        reader.cancel()
        throw new Error('Anthropic streaming request was aborted')
      }

      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      // Process complete SSE lines
      const lines = buffer.split('\n')
      // Keep the last potentially incomplete line in the buffer
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()

        // Skip empty lines and comments
        if (!trimmed || trimmed.startsWith(':')) continue

        // Parse event type
        if (trimmed.startsWith('event:')) {
          // Event type is handled via the data payload
          continue
        }

        // Parse data payload
        if (trimmed.startsWith('data:')) {
          const jsonStr = trimmed.slice(5).trim()
          if (jsonStr === '[DONE]') break

          let event: any
          try {
            event = JSON.parse(jsonStr)
          } catch {
            // Skip malformed JSON lines — may be partial
            continue
          }

          switch (event.type) {
            case 'message_start':
              // Message metadata — nothing to extract for the plan
              break

            case 'content_block_start': {
              currentBlockIndex = event.index ?? blocks.length
              const cb = event.content_block
              if (cb?.type === 'tool_use') {
                blocks[currentBlockIndex] = {
                  type: 'tool_use',
                  name: cb.name,
                  inputJson: '',
                }
              } else if (cb?.type === 'text') {
                blocks[currentBlockIndex] = {
                  type: 'text',
                  text: cb.text || '',
                }
              }
              // Skip thinking blocks — don't track them
              break
            }

            case 'content_block_delta': {
              const idx = event.index ?? currentBlockIndex
              const block = blocks[idx]
              if (!block) break

              if (event.delta?.type === 'text_delta' && block.type === 'text') {
                block.text = (block.text || '') + (event.delta.text || '')
              } else if (event.delta?.type === 'input_json_delta' && block.type === 'tool_use') {
                block.inputJson = (block.inputJson || '') + (event.delta.partial_json || '')
              }
              // Skip thinking_delta — we don't track thinking blocks
              break
            }

            case 'content_block_stop':
              // Block is finalized — nothing to do
              break

            case 'message_delta':
              // Contains stop_reason — we're almost done
              break

            case 'message_stop':
              // Stream complete
              break

            case 'error': {
              const errorMsg = event.error?.message || JSON.stringify(event.error) || 'Stream error'
              throw new Error(`Anthropic stream error: ${errorMsg}`)
            }

            default:
              // Unknown event type — ignore
              break
          }
        }
      }
    }
  } catch (error) {
    // Re-throw abort errors
    if (signal?.aborted) {
      throw new Error('Anthropic streaming request was aborted')
    }
    // Notify via callback for non-fatal errors, then re-throw
    if (onError && error instanceof Error) {
      onError(error)
    }
    throw error
  } finally {
    try {
      reader.cancel()
    } catch {
      // Ignore cancel errors during cleanup
    }
  }

  // Build the plan from accumulated blocks
  const calls: AgentKToolCall[] = []
  let summary = ''

  for (const block of blocks) {
    if (!block) continue

    if (block.type === 'tool_use' && block.name) {
      let parameters: Record<string, any> = {}
      if (block.inputJson) {
        try {
          parameters = JSON.parse(block.inputJson)
        } catch {
          if (onError) {
            onError(
              new Error(`Failed to parse tool input JSON for "${block.name}": ${block.inputJson}`),
            )
          }
          // Use empty parameters on parse failure
        }
      }
      calls.push({ toolName: block.name, parameters })
    } else if (block.type === 'text') {
      summary = block.text || ''
    }
  }

  if (!summary && calls.length > 0) {
    summary = buildFallbackSummary(calls.map((c) => c.toolName))
  }

  return { calls, summary }
}
