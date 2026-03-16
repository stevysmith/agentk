import { c as AgentKProvider } from '../types-QpaOvRHU.js';

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
declare const openaiProvider: AgentKProvider;

export { openaiProvider };
