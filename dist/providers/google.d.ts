import { c as AgentKProvider } from '../types-CXxYj9tM.js';

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
 * import { googleProvider } from '@stevysmith/agentk/providers/google'
 *
 * const plan = await googleProvider(
 *   'Turn on the lights',
 *   tools,
 *   { provider: 'google', apiKey: 'AIza...' }
 * )
 * ```
 */
declare const googleProvider: AgentKProvider;

export { googleProvider };
