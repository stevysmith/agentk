// ============================================================
// agentk — Provider utilities
//
// Shared helpers for LLM providers: schema conversion and
// system prompt generation.
// ============================================================

/**
 * Minimal tool definition used by providers.
 *
 * @description This is a slim representation of a tool that avoids
 * circular dependencies with the main agentk module. It contains
 * only the fields needed for LLM provider API calls.
 */
export type ToolDef = {
  /** Unique tool name used as the identifier in LLM calls. */
  name: string
  /** Human-readable label for the tool. */
  label?: string
  /** Description of what the tool does, sent to the LLM. */
  description?: string
  /** JSON Schema describing the tool's input parameters. */
  inputSchema?: { type: 'object'; properties: Record<string, any>; required?: string[] }
  /** Icon for UI rendering. */
  icon?: any
  /** Keywords for fuzzy matching in the command palette. */
  keywords?: string[]
}

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
export function toToolSchema(tool: ToolDef) {
  return {
    name: tool.name,
    description: tool.description || tool.label || tool.name,
    inputSchema: tool.inputSchema || { type: 'object' as const, properties: {} },
  }
}

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
export function buildSystemPrompt(tools: ToolDef[]): string {
  const toolList = tools
    .map((t) => `- ${t.name}: ${t.description || t.label || 'No description'}`)
    .join('\n')

  return `You are a helpful assistant controlling a web application via WebMCP tools.
The user will describe what they want in natural language. Translate their intent into tool calls.

Available tools:
${toolList}

Rules:
- Use the minimum number of tool calls needed.
- Always include a brief text explanation of what you'll do before the tool calls.
- If the user's request doesn't match any available tool, respond with text only (no tool calls).`
}

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
export function buildFallbackSummary(callNames: string[]): string {
  return `I'll ${callNames.map((name) => name.replace(/_/g, ' ')).join(' and ')}`
}

/**
 * Builds the prompt for a follow-up turn in a multi-step run.
 *
 * Deliberately provider-agnostic: the transcript is rendered as text and sent
 * as an ordinary prompt, so every provider — including a custom `providerFn` —
 * supports multi-step runs without implementing a message format.
 *
 * @param originalPrompt - What the user actually asked for.
 * @param steps - Calls already made this run, in order, with their results.
 * @param maxResultChars - Per-result truncation budget. Defaults to 1500.
 */
export function buildFollowUpPrompt(
  originalPrompt: string,
  steps: Array<{ toolName: string; parameters: Record<string, any>; result?: any; error?: string }>,
  maxResultChars = 1500,
): string {
  const render = (v: unknown) => {
    const text = typeof v === 'string' ? v : JSON.stringify(v ?? null)
    return text.length > maxResultChars ? `${text.slice(0, maxResultChars)}… (truncated)` : text
  }
  const lines = steps.map((s, i) => {
    const args = JSON.stringify(s.parameters ?? {})
    const outcome = s.error ? `ERROR: ${s.error}` : render(s.result)
    return `${i + 1}. ${s.toolName}(${args})\n   → ${outcome}`
  })
  return [
    `The user asked: "${originalPrompt}"`,
    '',
    'Tools called so far, in order, and what they returned:',
    lines.join('\n'),
    '',
    'Continue the task: call more tools if it is not finished. An ERROR above usually says what to do instead — read it and adjust rather than repeating the same call. When the request is satisfied, reply with text only (no tool calls) and tell the user what you did.',
  ].join('\n')
}
