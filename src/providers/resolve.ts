// ============================================================
// agentk — Provider resolver
//
// Maps provider names to their implementations and handles
// custom provider validation.
// ============================================================

import type { AgentKAgentConfig, AgentKProvider } from './types'
import { anthropicProvider } from './anthropic'
import { openaiProvider } from './openai'
import { googleProvider } from './google'

/**
 * Map of built-in provider names to their implementations.
 *
 * @internal
 */
const PROVIDERS: Record<string, AgentKProvider> = {
  anthropic: anthropicProvider,
  openai: openaiProvider,
  google: googleProvider,
}

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
export function resolveProvider(config: AgentKAgentConfig): AgentKProvider {
  if (config.providerFn) return config.providerFn
  if (config.provider === 'custom') {
    throw new Error('Custom provider requires providerFn')
  }
  const provider = PROVIDERS[config.provider]
  if (!provider) {
    throw new Error(`Unknown provider: ${config.provider}`)
  }

  // Warn if API key is used client-side, unless the caller has explicitly
  // opted into a browser key (e.g. a bring-your-own-key UI).
  if (config.apiKey && !config.dangerouslyAllowBrowserKey && typeof window !== 'undefined') {
    console.warn(
      '[agentk] API key detected in browser. For production, use the `endpoint` prop to proxy through your server, or set `dangerouslyAllowBrowserKey: true` for an intentional bring-your-own-key setup.',
    )
  }

  return provider
}
