/**
 * Minimal tool definition used by providers.
 *
 * @description This is a slim representation of a tool that avoids
 * circular dependencies with the main agentk module. It contains
 * only the fields needed for LLM provider API calls.
 */
type ToolDef = {
    /** Unique tool name used as the identifier in LLM calls. */
    name: string;
    /** Human-readable label for the tool. */
    label?: string;
    /** Description of what the tool does, sent to the LLM. */
    description?: string;
    /** JSON Schema describing the tool's input parameters. */
    inputSchema?: {
        type: 'object';
        properties: Record<string, any>;
        required?: string[];
    };
    /** Icon for UI rendering. */
    icon?: any;
    /** Keywords for fuzzy matching in the command palette. */
    keywords?: string[];
};
/**
 * Converts a ToolDef into the standard schema format expected by LLM providers.
 *
 * @description Normalizes the tool definition into a consistent shape with
 * guaranteed `name`, `description`, and `inputSchema` fields. Falls back to
 * the tool's `label` or `name` if no description is provided.
 *
 * @param tool - The tool definition to convert
 * @returns A normalized tool schema object
 *
 * @example
 * ```ts
 * const schema = toToolSchema({
 *   name: 'search',
 *   description: 'Search the web',
 *   inputSchema: { type: 'object', properties: { query: { type: 'string' } } }
 * })
 * // => { name: 'search', description: 'Search the web', inputSchema: { ... } }
 * ```
 */
declare function toToolSchema(tool: ToolDef): {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: Record<string, any>;
        required?: string[];
    };
};
/**
 * Builds a default system prompt from the available tools.
 *
 * @description Generates a structured system prompt that instructs the LLM
 * to translate natural language into tool calls. Lists all available tools
 * with their descriptions and provides rules for tool usage.
 *
 * @param tools - Array of available tool definitions
 * @returns A formatted system prompt string
 *
 * @example
 * ```ts
 * const prompt = buildSystemPrompt([
 *   { name: 'search', description: 'Search the web' },
 *   { name: 'navigate', description: 'Navigate to a URL' },
 * ])
 * ```
 */
declare function buildSystemPrompt(tools: ToolDef[]): string;
/**
 * Generates a fallback summary from a list of tool call names.
 *
 * @description Creates a human-readable summary like "I'll search and navigate"
 * when the LLM doesn't provide its own text summary.
 *
 * @param callNames - Array of tool names that were called
 * @returns A formatted summary string
 *
 * @example
 * ```ts
 * buildFallbackSummary(['search_web', 'open_tab'])
 * // => "I'll search web and open tab"
 * ```
 */
declare function buildFallbackSummary(callNames: string[]): string;

/**
 * Represents a single tool call planned by an LLM provider.
 *
 * @description Contains the tool name, parameters to pass, and optional
 * reasoning from the LLM explaining why this call was chosen.
 */
type AgentKToolCall = {
    /** The registered name of the tool to invoke. */
    toolName: string;
    /** Key-value parameters to pass to the tool. */
    parameters: Record<string, any>;
    /** Optional LLM reasoning for why this tool was selected. */
    reasoning?: string;
};
/**
 * A plan returned by an LLM provider consisting of tool calls and a summary.
 *
 * @description The plan is the structured output from a provider call.
 * It contains zero or more tool calls and a human-readable summary of what
 * the LLM intends to do.
 */
type AgentKPlan = {
    /** Ordered list of tool calls the LLM wants to execute. */
    calls: AgentKToolCall[];
    /** Human-readable summary of the plan. */
    summary: string;
};
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
 *   model: 'claude-sonnet-4-20250514',
 *   stream: true,
 *   timeout: 15000,
 * }
 * ```
 */
type AgentKAgentConfig = {
    /**
     * The LLM provider to use.
     * Use `'custom'` with `providerFn` for custom implementations.
     */
    provider: 'anthropic' | 'openai' | 'google' | 'custom';
    /**
     * API key for the selected provider.
     * Warning: Including API keys in client-side code is insecure.
     * Use the `endpoint` field to proxy through your server instead.
     */
    apiKey?: string;
    /**
     * Acknowledge that an API key is intentionally used in the browser
     * (e.g. a bring-your-own-key UI where the key is the end user's own and
     * never leaves their machine). Suppresses the client-side key warning.
     * @default false
     */
    dangerouslyAllowBrowserKey?: boolean;
    /**
     * Custom API endpoint URL. Overrides the provider's default endpoint.
     * Use this to proxy requests through your own server.
     */
    endpoint?: string;
    /**
     * Model identifier to use. Each provider has a sensible default:
     * - Anthropic: `'claude-sonnet-4-20250514'`
     * - OpenAI: `'gpt-4o'`
     * - Google: `'gemini-2.0-flash'`
     * @default Provider-specific default
     */
    model?: string;
    /**
     * Custom system prompt. If omitted, a default prompt is generated
     * from the available tools.
     */
    systemPrompt?: string;
    /**
     * When `true`, the plan must be approved by the user before execution.
     * @default false
     */
    requireApproval?: boolean;
    /**
     * Maximum number of tool calls allowed in a single plan.
     */
    maxCalls?: number;
    /**
     * Maximum tokens the model may generate in its response. Important when the
     * model fills a large tool argument (e.g. a full HTML document): too low a
     * cap truncates the tool call and its arguments arrive empty. Each model has
     * its own ceiling, so set this per provider.
     * @default 8192 (Anthropic; OpenAI and Google use the model default if unset)
     */
    maxTokens?: number;
    /**
     * Custom provider function. Required when `provider` is `'custom'`.
     */
    providerFn?: AgentKProvider;
    /**
     * Request timeout in milliseconds. The provider will abort the request
     * if it takes longer than this duration.
     * @default 30000
     */
    timeout?: number;
    /**
     * Enable streaming mode. Currently only supported by the Anthropic provider.
     * When `true`, the provider uses SSE streaming and returns the complete
     * plan once streaming finishes.
     * @default false
     */
    stream?: boolean;
    /**
     * Callback invoked when a provider encounters an error during response
     * parsing or streaming. Use this for logging or telemetry.
     *
     * @param error - The error that occurred
     */
    onProviderError?: (error: Error) => void;
};
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
type AgentKProvider = (prompt: string, tools: ToolDef[], config: AgentKAgentConfig, signal?: AbortSignal) => Promise<AgentKPlan>;

export { type AgentKToolCall as A, type ToolDef as T, type AgentKPlan as a, type AgentKAgentConfig as b, type AgentKProvider as c, buildFallbackSummary as d, buildSystemPrompt as e, toToolSchema as t };
