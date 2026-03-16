// ============================================================
// agentk — OpenAI provider
//
// GPT API integration with hardened response parsing (P1.7).
// ============================================================

import type { AgentKProvider, AgentKToolCall } from './types'
import { toToolSchema, buildSystemPrompt, buildFallbackSummary } from './utils'

/**
 * OpenAI (GPT) LLM provider.
 *
 * @description Calls the OpenAI Chat Completions API to translate natural
 * language into tool calls. Handles both the modern `tool_calls` format and
 * the legacy `function_call` format. Includes hardened parsing with null checks
 * and JSON parse error recovery.
 *
 * @param prompt - The user's natural language input
 * @param tools - Available tools the LLM can call
 * @param config - Agent configuration. Uses `gpt-4o` by default.
 * @param signal - Optional AbortSignal for request cancellation
 * @returns A promise resolving to an execution plan
 *
 * @example
 * ```ts
 * import { openaiProvider } from 'agentk/providers/openai'
 *
 * const plan = await openaiProvider(
 *   'Summarize recent orders',
 *   tools,
 *   { provider: 'openai', apiKey: 'sk-...' }
 * )
 * ```
 */
export const openaiProvider: AgentKProvider = async (prompt, tools, config, signal) => {
  const endpoint = config.endpoint || 'https://api.openai.com/v1/chat/completions'
  const model = config.model || 'gpt-4o'

  const body = {
    model,
    messages: [
      { role: 'system', content: config.systemPrompt || buildSystemPrompt(tools) },
      { role: 'user', content: prompt },
    ],
    tools: tools.map((t) => {
      const schema = toToolSchema(t)
      return {
        type: 'function',
        function: {
          name: schema.name,
          description: schema.description,
          parameters: schema.inputSchema,
        },
      }
    }),
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (config.apiKey) {
    headers['Authorization'] = `Bearer ${config.apiKey}`
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`OpenAI API error ${res.status}: ${text}`)
  }

  // Validate content type
  const contentType = res.headers.get('content-type') || ''
  if (!contentType.includes('application/json') && !contentType.includes('text/json')) {
    const text = await res.text()
    throw new Error(
      `OpenAI API returned unexpected content-type "${contentType}". Body: ${text.slice(0, 500)}`,
    )
  }

  let data: any
  try {
    data = await res.json()
  } catch {
    throw new Error('OpenAI API returned invalid JSON in response body')
  }

  // Null-check choices array
  if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
    if (config.onProviderError) {
      config.onProviderError(new Error('OpenAI API response missing choices array'))
    }
    return { calls: [], summary: '' }
  }

  const msg = data.choices[0]?.message

  // Null-check message
  if (!msg) {
    if (config.onProviderError) {
      config.onProviderError(new Error('OpenAI API response missing message in first choice'))
    }
    return { calls: [], summary: '' }
  }

  const calls: AgentKToolCall[] = []
  const summary = msg.content || ''

  // Handle modern tool_calls format
  if (msg.tool_calls && Array.isArray(msg.tool_calls)) {
    for (const tc of msg.tool_calls) {
      if (tc.type === 'function' && tc.function) {
        try {
          const parameters = JSON.parse(tc.function.arguments || '{}')
          calls.push({
            toolName: tc.function.name,
            parameters,
          })
        } catch (parseError) {
          // Log warning and skip this call on JSON parse failure
          const warning = `Failed to parse tool arguments for "${tc.function.name}": ${tc.function.arguments}`
          console.warn(`[agentk] ${warning}`)
          if (config.onProviderError) {
            config.onProviderError(new Error(warning))
          }
        }
      }
    }
  }

  // Handle legacy function_call format (older OpenAI models)
  if (calls.length === 0 && msg.function_call) {
    const fc = msg.function_call
    if (fc.name) {
      try {
        const parameters = JSON.parse(fc.arguments || '{}')
        calls.push({
          toolName: fc.name,
          parameters,
        })
      } catch (parseError) {
        const warning = `Failed to parse legacy function_call arguments for "${fc.name}": ${fc.arguments}`
        console.warn(`[agentk] ${warning}`)
        if (config.onProviderError) {
          config.onProviderError(new Error(warning))
        }
      }
    }
  }

  if (!summary && calls.length > 0) {
    return {
      calls,
      summary: buildFallbackSummary(calls.map((c) => c.toolName)),
    }
  }

  return { calls, summary }
}
