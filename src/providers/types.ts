// ============================================================
// agentk — Provider types
//
// Shared type definitions for all LLM providers.
// ============================================================

import type { ToolDef } from './utils'

/**
 * Represents a single tool call planned by an LLM provider.
 *
 * @description Contains the tool name, parameters to pass, and optional
 * reasoning from the LLM explaining why this call was chosen.
 */
export type AgentKToolCall = {
  /** The registered name of the tool to invoke. */
  toolName: string
  /** Key-value parameters to pass to the tool. */
  parameters: Record<string, any>
  /** Optional LLM reasoning for why this tool was selected. */
  reasoning?: string
}

/**
 * A plan returned by an LLM provider consisting of tool calls and a summary.
 *
 * @description The plan is the structured output from a provider call.
 * It contains zero or more tool calls and a human-readable summary of what
 * the LLM intends to do.
 */
export type AgentKPlan = {
  /** Ordered list of tool calls the LLM wants to execute. */
  calls: AgentKToolCall[]
  /** Human-readable summary of the plan. */
  summary: string
}

/**
 * Configuration for an agentk LLM agent.
 *
 * @description Controls which provider to use, authentication, model selection,
 * and behavioral options like approval requirements and streaming.
 *
 * @example
 * ```ts
 * const config: AgentKAgentConfig = {
 *   provider: 'anthropic',
 *   apiKey: 'sk-...',
 *   model: 'claude-sonnet-5',
 *   stream: true,
 *   timeout: 15000,
 * }
 * ```
 */
/**
 * One completed step in a multi-step agent run: the call that ran and what
 * came back. Fed to the provider on the next turn so the model can react to
 * results, recover from errors, and decide when it is finished.
 */
export type AgentKStepRecord = {
  toolName: string
  parameters: Record<string, any>
  result?: any
  error?: string
}

export type AgentKAgentConfig = {
  /**
   * The LLM provider to use.
   * Use `'custom'` with `providerFn` for custom implementations.
   */
  provider: 'anthropic' | 'openai' | 'google' | 'custom'
  /**
   * How many times the provider may be called for one user intent.
   *
   * `1` (the default) is single-shot: the model plans once, those calls run,
   * and the run ends — the model never sees the results. Set it higher to let
   * the model work in steps: after each plan's calls finish, the results (and
   * any errors) go back to the model, which either calls more tools or replies
   * with text to finish. That is what makes "plan a tour, then walk me through
   * it" work, and it lets the model recover from a tool error instead of
   * halting on it.
   *
   * Left at 1 by default so existing scripted `providerFn` agents — which
   * return the same plan for the same prompt — cannot loop.
   * @default 1
   */
  maxSteps?: number
  /**
   * With `requireApproval`, skip the approval gate for plans whose calls are
   * all marked `annotations.readOnlyHint`. Reading is free; only changes
   * (and payments) stop for a human.
   * @default false
   */
  autoApproveReadOnly?: boolean
  /**
   * With `requireApproval`, also skip the gate for writes that are not marked
   * `annotations.consequentialHint` — the reversible middle, where read vs.
   * write is too blunt a line: drafting an email is a write, sending it is not
   * the same thing. A call annotated consequential always stops, whichever
   * auto-approve is on.
   * @default false
   */
  autoApproveReversible?: boolean
  /**
   * API key for the selected provider.
   * Warning: Including API keys in client-side code is insecure.
   * Use the `endpoint` field to proxy through your server instead.
   */
  apiKey?: string
  /**
   * Acknowledge that an API key is intentionally used in the browser
   * (e.g. a bring-your-own-key UI where the key is the end user's own and
   * never leaves their machine). Suppresses the client-side key warning.
   * @default false
   */
  dangerouslyAllowBrowserKey?: boolean
  /**
   * Custom API endpoint URL. Overrides the provider's default endpoint.
   * Use this to proxy requests through your own server.
   */
  endpoint?: string
  /**
   * Model identifier to use. Each provider has a sensible default:
   * - Anthropic: `'claude-sonnet-5'`
   * - OpenAI: `'gpt-4o'`
   * - Google: `'gemini-3.5-flash'`
   * @default Provider-specific default
   */
  model?: string
  /**
   * Custom system prompt. If omitted, a default prompt is generated
   * from the available tools.
   */
  systemPrompt?: string
  /**
   * When `true`, the plan must be approved by the user before execution.
   * @default false
   */
  requireApproval?: boolean
  /**
   * Maximum number of tool calls allowed in a single plan.
   */
  maxCalls?: number
  /**
   * Maximum tokens the model may generate in its response. Important when the
   * model fills a large tool argument (e.g. a full HTML document): too low a
   * cap truncates the tool call and its arguments arrive empty. Each model has
   * its own ceiling, so set this per provider.
   * @default 8192 (Anthropic; OpenAI and Google use the model default if unset)
   */
  maxTokens?: number
  /**
   * Custom provider function. Required when `provider` is `'custom'`.
   */
  providerFn?: AgentKProvider
  /**
   * Request timeout in milliseconds. The provider will abort the request
   * if it takes longer than this duration.
   * @default 30000
   */
  timeout?: number
  /**
   * Enable streaming mode. Currently only supported by the Anthropic provider.
   * When `true`, the provider uses SSE streaming and returns the complete
   * plan once streaming finishes.
   * @default false
   */
  stream?: boolean
  /**
   * Callback invoked when a provider encounters an error during response
   * parsing or streaming. Use this for logging or telemetry.
   *
   * @param error - The error that occurred
   */
  onProviderError?: (error: Error) => void
  /**
   * Progress callback fired while a streaming response is being received
   * (requires `stream: true`). Reports the cumulative number of characters
   * generated so far, so a UI can show live progress during a long generation.
   *
   * @param chars - Total characters streamed so far
   */
  onProgress?: (chars: number) => void
}

/**
 * A function that takes a prompt and tools, calls an LLM, and returns a plan.
 *
 * @description This is the core abstraction for LLM providers. Each built-in
 * provider (Anthropic, OpenAI, Google) implements this interface. Custom
 * providers must also conform to this signature.
 *
 * @param prompt - The user's natural language input
 * @param tools - Available tools the LLM can call
 * @param config - Agent configuration including model, API key, etc.
 * @param signal - Optional AbortSignal for request cancellation
 * @returns A promise resolving to an execution plan
 *
 * @example
 * ```ts
 * const myProvider: AgentKProvider = async (prompt, tools, config, signal) => {
 *   const response = await fetch(config.endpoint!, { signal })
 *   // ... parse response
 *   return { calls: [], summary: 'Done' }
 * }
 * ```
 */
export type AgentKProvider = (
  prompt: string,
  tools: ToolDef[],
  config: AgentKAgentConfig,
  signal?: AbortSignal,
) => Promise<AgentKPlan>
