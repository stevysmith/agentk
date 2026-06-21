import { b as AgentKAgentConfig, c as AgentKProvider } from './types-CXxYj9tM.js';
export { a as AgentKPlan, A as AgentKToolCall, T as ToolDef, d as buildFallbackSummary, e as buildSystemPrompt, t as toToolSchema } from './types-CXxYj9tM.js';
export { anthropicProvider } from './providers/anthropic.js';
export { openaiProvider } from './providers/openai.js';
export { googleProvider } from './providers/google.js';

/**
 * Resolves an agent configuration to a concrete provider function.
 *
 * @description Given an `AgentKAgentConfig`, returns the appropriate provider
 * function. For built-in providers (`'anthropic'`, `'openai'`, `'google'`),
 * returns the corresponding implementation. For `'custom'` providers, returns
 * the `providerFn` from the config.
 *
 * Warns when an API key is used directly in the browser, as this is insecure.
 *
 * @param config - The agent configuration specifying which provider to use
 * @returns The resolved provider function
 *
 * @throws {Error} When `provider` is `'custom'` but `providerFn` is not provided
 * @throws {Error} When the provider name is not recognized
 *
 * @example
 * ```ts
 * const provider = resolveProvider({
 *   provider: 'anthropic',
 *   apiKey: 'sk-...',
 * })
 * const plan = await provider('Hello', tools, config)
 * ```
 *
 * @example
 * ```ts
 * // Custom provider
 * const provider = resolveProvider({
 *   provider: 'custom',
 *   providerFn: async (prompt, tools, config, signal) => {
 *     // ... custom logic
 *     return { calls: [], summary: 'Done' }
 *   },
 * })
 * ```
 */
declare function resolveProvider(config: AgentKAgentConfig): AgentKProvider;

export { AgentKAgentConfig, AgentKProvider, resolveProvider };
