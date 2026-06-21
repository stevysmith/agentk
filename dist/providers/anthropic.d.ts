import { c as AgentKProvider } from '../types-CXxYj9tM.js';

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
declare const anthropicProvider: AgentKProvider;

export { anthropicProvider };
