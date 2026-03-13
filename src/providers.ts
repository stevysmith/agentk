// ============================================================
// agentk — LLM provider abstraction
//
// Thin, zero-dependency layer. Each provider is a fetch() call.
// No SDKs bundled — keeps the bundle small.
// ============================================================

// Minimal tool type — avoids circular import with index.tsx
type ToolDef = {
  name: string
  label?: string
  description?: string
  inputSchema?: { type: 'object'; properties: Record<string, any>; required?: string[] }
  icon?: any
  keywords?: string[]
}

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type AgentKToolCall = {
  toolName: string
  parameters: Record<string, any>
  reasoning?: string
}

export type AgentKPlan = {
  calls: AgentKToolCall[]
  summary: string
}

export type AgentKAgentConfig = {
  provider: 'anthropic' | 'openai' | 'google' | 'custom'
  apiKey?: string
  endpoint?: string
  model?: string
  systemPrompt?: string
  requireApproval?: boolean
  maxCalls?: number
  providerFn?: AgentKProvider
}

export type AgentKProvider = (
  prompt: string,
  tools: ToolDef[],
  config: AgentKAgentConfig,
) => Promise<AgentKPlan>

// ─────────────────────────────────────────────────────────────
// Tool schema conversion — ToolDef → provider format
// ─────────────────────────────────────────────────────────────

function toToolSchema(tool: ToolDef) {
  return {
    name: tool.name,
    description: tool.description || tool.label || tool.name,
    inputSchema: tool.inputSchema || { type: 'object' as const, properties: {} },
  }
}

// ─────────────────────────────────────────────────────────────
// Anthropic provider
// ─────────────────────────────────────────────────────────────

const anthropicProvider: AgentKProvider = async (prompt, tools, config) => {
  const endpoint = config.endpoint || 'https://api.anthropic.com/v1/messages'
  const model = config.model || 'claude-sonnet-4-20250514'

  const body = {
    model,
    max_tokens: 1024,
    system: config.systemPrompt || buildSystemPrompt(tools),
    tools: tools.map((t) => ({
      name: toToolSchema(t).name,
      description: toToolSchema(t).description,
      input_schema: toToolSchema(t).inputSchema,
    })),
    messages: [{ role: 'user', content: prompt }],
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (config.apiKey) {
    headers['x-api-key'] = config.apiKey
    headers['anthropic-version'] = '2023-06-01'
    headers['anthropic-dangerous-direct-browser-access'] = 'true'
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Anthropic API error ${res.status}: ${text}`)
  }

  const data = await res.json()
  const calls: AgentKToolCall[] = []
  let summary = ''

  for (const block of data.content || []) {
    if (block.type === 'tool_use') {
      calls.push({
        toolName: block.name,
        parameters: block.input || {},
      })
    } else if (block.type === 'text') {
      summary = block.text
    }
  }

  if (!summary && calls.length > 0) {
    summary = `I'll ${calls.map((c) => c.toolName.replace(/_/g, ' ')).join(' and ')}`
  }

  return { calls, summary }
}

// ─────────────────────────────────────────────────────────────
// OpenAI provider
// ─────────────────────────────────────────────────────────────

const openaiProvider: AgentKProvider = async (prompt, tools, config) => {
  const endpoint = config.endpoint || 'https://api.openai.com/v1/chat/completions'
  const model = config.model || 'gpt-4o'

  const body = {
    model,
    messages: [
      { role: 'system', content: config.systemPrompt || buildSystemPrompt(tools) },
      { role: 'user', content: prompt },
    ],
    tools: tools.map((t) => ({
      type: 'function',
      function: {
        name: toToolSchema(t).name,
        description: toToolSchema(t).description,
        parameters: toToolSchema(t).inputSchema,
      },
    })),
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
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`OpenAI API error ${res.status}: ${text}`)
  }

  const data = await res.json()
  const msg = data.choices?.[0]?.message
  const calls: AgentKToolCall[] = []
  const summary = msg?.content || ''

  for (const tc of msg?.tool_calls || []) {
    if (tc.type === 'function') {
      calls.push({
        toolName: tc.function.name,
        parameters: JSON.parse(tc.function.arguments || '{}'),
      })
    }
  }

  if (!summary && calls.length > 0) {
    return {
      calls,
      summary: `I'll ${calls.map((c) => c.toolName.replace(/_/g, ' ')).join(' and ')}`,
    }
  }

  return { calls, summary }
}

// ─────────────────────────────────────────────────────────────
// Google (Gemini) provider
// ─────────────────────────────────────────────────────────────

const googleProvider: AgentKProvider = async (prompt, tools, config) => {
  const model = config.model || 'gemini-2.0-flash'
  const endpoint =
    config.endpoint ||
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent${config.apiKey ? `?key=${config.apiKey}` : ''}`

  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    systemInstruction: {
      parts: [{ text: config.systemPrompt || buildSystemPrompt(tools) }],
    },
    tools: [
      {
        functionDeclarations: tools.map((t) => ({
          name: toToolSchema(t).name,
          description: toToolSchema(t).description,
          parameters: toToolSchema(t).inputSchema,
        })),
      },
    ],
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Google API error ${res.status}: ${text}`)
  }

  const data = await res.json()
  const calls: AgentKToolCall[] = []
  let summary = ''

  const parts = data.candidates?.[0]?.content?.parts || []
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
    summary = `I'll ${calls.map((c) => c.toolName.replace(/_/g, ' ')).join(' and ')}`
  }

  return { calls, summary }
}

// ─────────────────────────────────────────────────────────────
// System prompt builder
// ─────────────────────────────────────────────────────────────

function buildSystemPrompt(tools: ToolDef[]): string {
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

// ─────────────────────────────────────────────────────────────
// Provider resolver
// ─────────────────────────────────────────────────────────────

const PROVIDERS: Record<string, AgentKProvider> = {
  anthropic: anthropicProvider,
  openai: openaiProvider,
  google: googleProvider,
}

export function resolveProvider(config: AgentKAgentConfig): AgentKProvider {
  if (config.providerFn) return config.providerFn
  if (config.provider === 'custom') {
    throw new Error('Custom provider requires providerFn')
  }
  const provider = PROVIDERS[config.provider]
  if (!provider) {
    throw new Error(`Unknown provider: ${config.provider}`)
  }

  // Warn if API key is used client-side
  if (config.apiKey && typeof window !== 'undefined') {
    console.warn(
      '[agentk] API key detected in browser. For production, use the `endpoint` prop to proxy through your server.',
    )
  }

  return provider
}
