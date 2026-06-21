// ============================================================
// agentk — Google (Gemini) provider
//
// Gemini API integration with hardened response parsing (P1.7).
// ============================================================

import type { AgentKProvider, AgentKToolCall } from './types'
import { toToolSchema, buildSystemPrompt, buildFallbackSummary } from './utils'

/**
 * Google (Gemini) LLM provider.
 *
 * @description Calls the Google Generative Language API to translate natural
 * language into tool calls. Handles safety-filtered responses, missing
 * candidates, and missing content parts gracefully.
 *
 * @param prompt - The user's natural language input
 * @param tools - Available tools the LLM can call
 * @param config - Agent configuration. Uses `gemini-2.0-flash` by default.
 * @param signal - Optional AbortSignal for request cancellation
 * @returns A promise resolving to an execution plan
 *
 * @throws {Error} When the response is blocked by safety filters (`finishReason: "SAFETY"`)
 *
 * @example
 * ```ts
 * import { googleProvider } from 'agentk/providers/google'
 *
 * const plan = await googleProvider(
 *   'Turn on the lights',
 *   tools,
 *   { provider: 'google', apiKey: 'AIza...' }
 * )
 * ```
 */
export const googleProvider: AgentKProvider = async (prompt, tools, config, signal) => {
  const model = config.model || 'gemini-2.0-flash'
  const endpoint =
    config.endpoint ||
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent${config.apiKey ? `?key=${config.apiKey}` : ''}`

  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    systemInstruction: {
      parts: [{ text: config.systemPrompt || buildSystemPrompt(tools) }],
    },
    ...(config.maxTokens ? { generationConfig: { maxOutputTokens: config.maxTokens } } : {}),
    tools: [
      {
        functionDeclarations: tools.map((t) => {
          const schema = toToolSchema(t)
          return {
            name: schema.name,
            description: schema.description,
            parameters: schema.inputSchema,
          }
        }),
      },
    ],
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Google API error ${res.status}: ${text}`)
  }

  // Validate content type
  const contentType = res.headers.get('content-type') || ''
  if (!contentType.includes('application/json') && !contentType.includes('text/json')) {
    const text = await res.text()
    throw new Error(
      `Google API returned unexpected content-type "${contentType}". Body: ${text.slice(0, 500)}`,
    )
  }

  let data: any
  try {
    data = await res.json()
  } catch {
    throw new Error('Google API returned invalid JSON in response body')
  }

  // Handle missing candidates array
  if (!data.candidates || !Array.isArray(data.candidates) || data.candidates.length === 0) {
    if (config.onProviderError) {
      config.onProviderError(new Error('Google API response missing candidates array'))
    }
    return { calls: [], summary: '' }
  }

  const candidate = data.candidates[0]

  // Handle safety-filtered responses
  if (candidate.finishReason === 'SAFETY') {
    throw new Error(
      'Google API blocked the response due to safety filters. ' +
      'The prompt or response was flagged as potentially harmful. ' +
      'Try rephrasing the request or adjusting safety settings.',
    )
  }

  // Handle missing content
  if (!candidate.content) {
    if (config.onProviderError) {
      config.onProviderError(
        new Error(`Google API candidate has no content (finishReason: ${candidate.finishReason || 'unknown'})`),
      )
    }
    return { calls: [], summary: '' }
  }

  const calls: AgentKToolCall[] = []
  let summary = ''

  // Handle missing parts array
  const parts = candidate.content.parts
  if (!parts || !Array.isArray(parts)) {
    if (config.onProviderError) {
      config.onProviderError(new Error('Google API response content missing parts array'))
    }
    return { calls: [], summary: '' }
  }

  for (const part of parts) {
    if (part.functionCall) {
      calls.push({
        toolName: part.functionCall.name,
        parameters: part.functionCall.args || {},
      })
    } else if (part.text) {
      summary = part.text
    }
  }

  if (!summary && calls.length > 0) {
    summary = buildFallbackSummary(calls.map((c) => c.toolName))
  }

  return { calls, summary }
}
