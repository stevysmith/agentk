'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Command, useAgentK, type AgentKToolDef, type ToolExecution, type AgentKAgentConfig } from 'agentk'

/* ─────────────────────────────────────────────────────────
 * ANIMATION STORYBOARD — agentk demo
 *
 * Page entrance (on mount):
 *    0ms   dark canvas visible
 *  200ms   header fades in
 *  300ms   sidebar fades in
 *  400ms   content fades in (staggered sections)
 *
 * Palette open (⌘K):
 *    0ms   overlay fades in (150ms), backdrop blur
 *   50ms   palette scales 0.97 → 1.0 (250ms spring)
 *
 * Tool execution:
 *    —ms   state changes reflected live in the docs page
 *          (language tabs switch, section navigates,
 *           code snippets regenerate, auth badge updates)
 * ───────────────────────────────────────────────────────── */

// ─────────────────────────────────────────────────────────
// SVG Icons — consistent 16px monochrome set
// ─────────────────────────────────────────────────────────

const Icons = {
  search: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5L14 14" />
    </svg>
  ),
  code: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 4L1 8l4 4" />
      <path d="M11 4l4 4-4 4" />
    </svg>
  ),
  globe: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="6.5" />
      <path d="M1.5 8h13" />
      <path d="M8 1.5c2 2.5 2 9.5 0 13" />
      <path d="M8 1.5c-2 2.5-2 9.5 0 13" />
    </svg>
  ),
  play: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 3l9 5-9 5V3z" />
    </svg>
  ),
  clipboard: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="10" height="10" rx="1.5" />
      <path d="M2 10V3a1.5 1.5 0 011.5-1.5H10" />
    </svg>
  ),
  key: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="5.5" cy="10.5" r="3" />
      <path d="M8 8l5.5-5.5" />
      <path d="M11 5l2.5 2.5" />
    </svg>
  ),
  zap: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 1L3 9h5l-1 6 6-8H8l1-6z" />
    </svg>
  ),
  arrowRight: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8h10" />
      <path d="M9 4l4 4-4 4" />
    </svg>
  ),
  lock: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="7" width="10" height="7" rx="1.5" />
      <path d="M5 7V5a3 3 0 016 0v2" />
    </svg>
  ),
}

// ─────────────────────────────────────────────────────────
// API docs data model
// ─────────────────────────────────────────────────────────

type Endpoint = {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  path: string
  title: string
  description: string
  params: { name: string; type: string; required: boolean; description: string }[]
}

type Section = {
  name: string
  endpoints: Endpoint[]
}

const DOCS: Section[] = [
  {
    name: 'Messages',
    endpoints: [
      {
        method: 'POST', path: '/v1/messages', title: 'Create a Message',
        description: 'Send a structured list of input messages with text and/or image content, and the model will generate the next message in the conversation. The Messages API can be used for either single queries or stateless multi-turn conversations.',
        params: [
          { name: 'model', type: 'string', required: true, description: 'The model that will complete your prompt (e.g. claude-sonnet-4-20250514)' },
          { name: 'max_tokens', type: 'integer', required: true, description: 'The maximum number of tokens to generate before stopping' },
          { name: 'messages', type: 'array', required: true, description: 'Input messages. Each message has a role and content' },
          { name: 'system', type: 'string', required: false, description: 'System prompt. Provides context and instructions' },
          { name: 'temperature', type: 'number', required: false, description: 'Amount of randomness (0.0 to 1.0). Default: 1.0' },
        ],
      },
      {
        method: 'GET', path: '/v1/messages/{message_id}', title: 'Retrieve a Message',
        description: 'Retrieves a Message object by its ID. This can be used to poll for the completion of a message that was created with stream set to false.',
        params: [
          { name: 'message_id', type: 'string', required: true, description: 'The ID of the message to retrieve' },
        ],
      },
    ],
  },
  {
    name: 'Models',
    endpoints: [
      {
        method: 'GET', path: '/v1/models', title: 'List Models',
        description: 'Lists all available models. Returns a list of Model objects with metadata about each model including capabilities and pricing.',
        params: [
          { name: 'limit', type: 'integer', required: false, description: 'Number of models to return (default 20, max 100)' },
          { name: 'after_id', type: 'string', required: false, description: 'Cursor for pagination' },
        ],
      },
      {
        method: 'GET', path: '/v1/models/{model_id}', title: 'Get Model',
        description: 'Retrieves a specific Model object by ID. Returns model metadata including name, capabilities, context window size, and pricing.',
        params: [
          { name: 'model_id', type: 'string', required: true, description: 'The ID of the model to retrieve' },
        ],
      },
    ],
  },
  {
    name: 'Completions',
    endpoints: [
      {
        method: 'POST', path: '/v1/complete', title: 'Create a Completion',
        description: 'Create a text completion given a prompt. This is a legacy endpoint — we recommend using the Messages API for new projects.',
        params: [
          { name: 'model', type: 'string', required: true, description: 'The model to use for completion' },
          { name: 'prompt', type: 'string', required: true, description: 'The prompt to complete' },
          { name: 'max_tokens_to_sample', type: 'integer', required: true, description: 'Maximum tokens to generate' },
        ],
      },
    ],
  },
  {
    name: 'Embeddings',
    endpoints: [
      {
        method: 'POST', path: '/v1/embeddings', title: 'Create Embeddings',
        description: 'Creates an embedding vector representing the input text. Use embeddings for search, clustering, and classification tasks.',
        params: [
          { name: 'model', type: 'string', required: true, description: 'The embedding model to use' },
          { name: 'input', type: 'string | array', required: true, description: 'Text to embed. Can be a string or array of strings' },
        ],
      },
    ],
  },
  {
    name: 'Admin',
    endpoints: [
      {
        method: 'GET', path: '/v1/usage', title: 'Get Usage',
        description: 'Returns usage statistics for the current billing period, including token counts and costs broken down by model.',
        params: [
          { name: 'start_date', type: 'string', required: false, description: 'Start date (YYYY-MM-DD)' },
          { name: 'end_date', type: 'string', required: false, description: 'End date (YYYY-MM-DD)' },
        ],
      },
      {
        method: 'POST', path: '/v1/api-keys', title: 'Create API Key',
        description: 'Creates a new API key for programmatic access. The key value is only shown once upon creation — store it securely.',
        params: [
          { name: 'name', type: 'string', required: true, description: 'A human-readable name for the key' },
          { name: 'workspace_id', type: 'string', required: false, description: 'Restrict key to a specific workspace' },
        ],
      },
    ],
  },
]

const SECTIONS = DOCS.map((d) => d.name)
const ALL_ENDPOINTS = DOCS.flatMap((d) => d.endpoints)
const LANGUAGES = ['python', 'javascript', 'go', 'curl'] as const
type Language = typeof LANGUAGES[number]

// ─────────────────────────────────────────────────────────
// Code snippet generators
// ─────────────────────────────────────────────────────────

function generateSnippet(endpoint: Endpoint, lang: Language): string {
  const { method, path } = endpoint
  switch (lang) {
    case 'python':
      return method === 'POST'
        ? `import anthropic

client = anthropic.Anthropic()

message = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=1024,
    messages=[
        {"role": "user", "content": "Hello, Claude"}
    ]
)
print(message.content)`
        : `import anthropic

client = anthropic.Anthropic()

result = client.get("${path}")
print(result)`

    case 'javascript':
      return method === 'POST'
        ? `import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const message = await client.messages.create({
  model: "claude-sonnet-4-20250514",
  max_tokens: 1024,
  messages: [
    { role: "user", content: "Hello, Claude" }
  ],
});
console.log(message.content);`
        : `import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const result = await client.get("${path}");
console.log(result);`

    case 'go':
      return method === 'POST'
        ? `package main

import (
    "context"
    "fmt"
    anthropic "github.com/anthropics/anthropic-sdk-go"
)

func main() {
    client := anthropic.NewClient()
    message, _ := client.Messages.New(context.TODO(),
        anthropic.MessageNewParams{
            Model:     anthropic.ModelClaudeSonnet4_20250514,
            MaxTokens: 1024,
            Messages: []anthropic.MessageParam{
                anthropic.NewUserMessage(
                    anthropic.NewTextBlock("Hello, Claude"),
                ),
            },
        },
    )
    fmt.Println(message.Content)
}`
        : `package main

import (
    "context"
    "fmt"
    anthropic "github.com/anthropics/anthropic-sdk-go"
)

func main() {
    client := anthropic.NewClient()
    result, _ := client.Get(context.TODO(), "${path}")
    fmt.Println(result)
}`

    case 'curl':
      return method === 'POST'
        ? `curl https://api.anthropic.com${path} \\
  -H "content-type: application/json" \\
  -H "x-api-key: $ANTHROPIC_API_KEY" \\
  -H "anthropic-version: 2023-06-01" \\
  -d '{
    "model": "claude-sonnet-4-20250514",
    "max_tokens": 1024,
    "messages": [
      {"role": "user", "content": "Hello, Claude"}
    ]
  }'`
        : `curl https://api.anthropic.com${path} \\
  -H "x-api-key: $ANTHROPIC_API_KEY" \\
  -H "anthropic-version: 2023-06-01"`
  }
}

// ─────────────────────────────────────────────────────────
// Docs state
// ─────────────────────────────────────────────────────────

type DocsState = {
  currentSection: string
  currentEndpointIndex: number
  currentLanguage: Language
  authToken: string | null
  testResult: { status: number; time: string } | null
  copied: boolean
}

const INITIAL: DocsState = {
  currentSection: 'Messages',
  currentEndpointIndex: 0,
  currentLanguage: 'python',
  authToken: null,
  testResult: null,
  copied: false,
}

// ─────────────────────────────────────────────────────────
// WebMCP tool definitions
// ─────────────────────────────────────────────────────────

const TOOLS: AgentKToolDef[] = [
  {
    name: 'search_endpoints',
    label: 'Search Endpoints',
    description: 'Find API endpoints',
    icon: Icons.search,
    keywords: ['search', 'find', 'endpoint', 'api', 'route'],
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query (e.g. "messages", "models")' },
      },
      required: ['query'],
    },
  },
  {
    name: 'generate_snippet',
    label: 'Generate Snippet',
    description: 'Generate code example',
    icon: Icons.code,
    keywords: ['code', 'snippet', 'example', 'generate', 'sample'],
    inputSchema: {
      type: 'object',
      properties: {
        endpoint: { type: 'string', description: 'API endpoint path', enum: ALL_ENDPOINTS.map((e) => e.path) },
        language: { type: 'string', description: 'Language', enum: [...LANGUAGES] },
      },
      required: ['endpoint', 'language'],
    },
  },
  {
    name: 'switch_language',
    label: 'Switch Language',
    description: 'Change SDK language',
    icon: Icons.globe,
    keywords: ['language', 'sdk', 'python', 'javascript', 'go', 'curl', 'switch'],
    inputSchema: {
      type: 'object',
      properties: {
        language: { type: 'string', description: 'Target language', enum: [...LANGUAGES] },
      },
      required: ['language'],
    },
  },
  {
    name: 'run_test_call',
    label: 'Test API Call',
    description: 'Send a test request',
    icon: Icons.play,
    keywords: ['test', 'try', 'run', 'call', 'request', 'execute'],
    inputSchema: {
      type: 'object',
      properties: {
        endpoint: { type: 'string', description: 'Endpoint to test', enum: ALL_ENDPOINTS.map((e) => e.path) },
      },
      required: ['endpoint'],
    },
  },
  {
    name: 'copy_code',
    label: 'Copy Code',
    description: 'Copy snippet to clipboard',
    icon: Icons.clipboard,
    keywords: ['copy', 'clipboard', 'code'],
  },
  {
    name: 'navigate_section',
    label: 'Go to Section',
    description: 'Jump to docs section',
    icon: Icons.arrowRight,
    keywords: ['navigate', 'go', 'section', 'jump'],
    inputSchema: {
      type: 'object',
      properties: {
        section: { type: 'string', description: 'Section name', enum: SECTIONS },
      },
      required: ['section'],
    },
  },
]

const QUICK_ACTIONS: AgentKToolDef[] = [
  { name: 'getting_started', label: 'Getting Started', description: 'Quick start guide', icon: Icons.zap, keywords: ['start', 'quick', 'begin'] },
  { name: 'auth_setup', label: 'Set Up Authentication', description: 'Configure API key', icon: Icons.key, keywords: ['auth', 'key', 'token', 'authenticate'] },
]

// ─────────────────────────────────────────────────────────
// Rich result messages
// ─────────────────────────────────────────────────────────

const RESULT_MESSAGES: Record<string, (p: Record<string, any>) => string> = {
  search_endpoints:  (p) => `Found ${p._count ?? 0} endpoints matching "${p.query}"`,
  generate_snippet:  (p) => `${p.language} snippet generated for ${p.endpoint}`,
  switch_language:   (p) => `Switched to ${p.language}`,
  run_test_call:     (p) => `${p.endpoint} → ${p._status} ${p._status < 400 ? 'OK' : 'Unauthorized'} (${p._time})`,
  copy_code:         () => 'Copied to clipboard',
  navigate_section:  (p) => `Navigated to ${p.section}`,
  getting_started:   () => 'Showing the Messages quickstart',
  auth_setup:        () => 'API key configured — you\'re ready to go',
}

// ─────────────────────────────────────────────────────────
// Page component
// ─────────────────────────────────────────────────────────

export default function DemoPage() {
  const [open, setOpen] = useState(false)
  const [docs, setDocs] = useState(INITIAL)
  const [flash, setFlash] = useState<string | null>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  const doFlash = useCallback((key: string) => {
    setFlash(key)
    setTimeout(() => setFlash(null), 800)
  }, [])

  const section = DOCS.find((d) => d.name === docs.currentSection) || DOCS[0]
  const endpoint = section.endpoints[docs.currentEndpointIndex] || section.endpoints[0]
  const snippet = generateSnippet(endpoint, docs.currentLanguage)
  const toolCount = TOOLS.length + QUICK_ACTIONS.length

  const executeTool = useCallback(
    async (name: string, params: Record<string, any>) => {
      await new Promise((r) => setTimeout(r, 400 + Math.random() * 400))

      switch (name) {
        case 'search_endpoints': {
          const q = (params.query || '').toLowerCase()
          const matches = ALL_ENDPOINTS.filter(
            (e) => e.path.includes(q) || e.title.toLowerCase().includes(q) || e.description.toLowerCase().includes(q)
          )
          if (matches.length > 0) {
            const match = matches[0]
            const sec = DOCS.find((d) => d.endpoints.includes(match))!
            const idx = sec.endpoints.indexOf(match)
            setDocs((d) => ({ ...d, currentSection: sec.name, currentEndpointIndex: idx, testResult: null }))
            doFlash('content')
          }
          return { success: true, query: params.query, _count: matches.length }
        }

        case 'generate_snippet': {
          const ep = ALL_ENDPOINTS.find((e) => e.path === params.endpoint)
          if (ep) {
            const sec = DOCS.find((d) => d.endpoints.includes(ep))!
            const idx = sec.endpoints.indexOf(ep)
            setDocs((d) => ({
              ...d,
              currentSection: sec.name,
              currentEndpointIndex: idx,
              currentLanguage: params.language as Language,
              testResult: null,
            }))
          }
          doFlash('code')
          return { success: true, endpoint: params.endpoint, language: params.language }
        }

        case 'switch_language': {
          setDocs((d) => ({ ...d, currentLanguage: params.language as Language }))
          doFlash('code')
          return { success: true, language: params.language }
        }

        case 'run_test_call': {
          const ep = ALL_ENDPOINTS.find((e) => e.path === params.endpoint)
          const isAuth = ep?.method === 'POST' || ep?.path.includes('api-keys') || ep?.path.includes('usage')
          const status = isAuth && !docs.authToken ? 401 : 200
          const time = `${Math.round(80 + Math.random() * 150)}ms`
          if (ep) {
            const sec = DOCS.find((d) => d.endpoints.includes(ep))!
            const idx = sec.endpoints.indexOf(ep)
            setDocs((d) => ({ ...d, currentSection: sec.name, currentEndpointIndex: idx, testResult: { status, time } }))
          }
          doFlash('test')
          return { success: true, endpoint: params.endpoint, _status: status, _time: time }
        }

        case 'copy_code': {
          setDocs((d) => ({ ...d, copied: true }))
          setTimeout(() => setDocs((d) => ({ ...d, copied: false })), 2000)
          doFlash('code')
          return { success: true }
        }

        case 'navigate_section': {
          const sec = DOCS.find((d) => d.name === params.section)
          if (sec) {
            setDocs((d) => ({ ...d, currentSection: sec.name, currentEndpointIndex: 0, testResult: null }))
            doFlash('content')
          }
          return { success: true, section: params.section }
        }

        case 'getting_started': {
          setDocs((d) => ({ ...d, currentSection: 'Messages', currentEndpointIndex: 0, testResult: null }))
          doFlash('content')
          return { success: true }
        }

        case 'auth_setup': {
          setDocs((d) => ({ ...d, authToken: 'sk-ant-api03-****' }))
          doFlash('auth')
          return { success: true }
        }

        default:
          throw new Error(`Unknown tool: ${name}`)
      }
    },
    [docs.authToken, doFlash],
  )

  const agentConfig: AgentKAgentConfig = {
    provider: 'anthropic',
    endpoint: '/api/agent',
    requireApproval: true,
  }

  // ── WebMCP registration ──
  // In production, your site registers tools with the browser's WebMCP API.
  // This makes them discoverable by any AI agent, not just agentk's palette.
  const [webmcpActive, setWebmcpActive] = useState(false)
  const executeRef = useRef(executeTool)
  executeRef.current = executeTool

  useEffect(() => {
    const mc = (navigator as any).modelContext
    if (!mc) return

    setWebmcpActive(true)
    const allTools = [...TOOLS, ...QUICK_ACTIONS]

    for (const tool of allTools) {
      mc.registerTool({
        name: tool.name,
        description: tool.description,
        ...(tool.inputSchema ? { inputSchema: tool.inputSchema } : {}),
        execute: async (params: Record<string, any>) => {
          try {
            const result = await executeRef.current(tool.name, params)
            const msgFn = RESULT_MESSAGES[tool.name]
            const text = msgFn ? msgFn({ ...params, ...result }) : JSON.stringify(result)
            return { content: [{ type: 'text', text }] }
          } catch (err: any) {
            return { content: [{ type: 'text', text: `Error: ${err.message}` }] }
          }
        },
      })
    }

    return () => {
      for (const tool of allTools) {
        try { mc.unregisterTool(tool.name) } catch {}
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const suggestion = !docs.authToken
    ? { tool: QUICK_ACTIONS.find((t) => t.name === 'auth_setup')!, reason: 'No API key configured' }
    : null

  const handleModeChange = useCallback((mode: string) => {
    if (mode === 'result') setTimeout(() => setOpen(false), 2500)
  }, [])

  return (
    <div className="docs-page">
      {/* ── Header ── */}
      <header className="docs-header">
        <div className="docs-header-left">
          <span className="docs-logo">agentk</span>
          <span className="docs-logo-sep">/</span>
          <span className="docs-logo-sub">API Reference</span>
        </div>
        <div className="docs-header-right">
          <span className={`docs-webmcp-badge ${webmcpActive ? '' : 'docs-webmcp-badge--inactive'}`}>
            <span className="docs-webmcp-dot" />
            {webmcpActive ? `WebMCP ${toolCount} tools` : `${toolCount} tools · WebMCP not detected`}
          </span>
          <button className="docs-trigger" onClick={() => setOpen(true)}>
            <span className="docs-trigger-text">Search docs...</span>
            <kbd>⌘K</kbd>
          </button>
        </div>
      </header>

      <div className="docs-layout">
        {/* ── Sidebar ── */}
        <nav className="docs-sidebar">
          <div className="docs-sidebar-section">
            <span className="docs-sidebar-heading">Getting Started</span>
            <a className="docs-sidebar-link" onClick={() => {
              setDocs((d) => ({ ...d, currentSection: 'Messages', currentEndpointIndex: 0, testResult: null }))
            }}>
              Introduction
            </a>
            <a className="docs-sidebar-link" onClick={() => {
              setDocs((d) => ({ ...d, authToken: d.authToken || 'sk-ant-api03-****' }))
              doFlash('auth')
            }}>
              Authentication
            </a>
          </div>
          {DOCS.map((sec) => (
            <div key={sec.name} className="docs-sidebar-section">
              <span className="docs-sidebar-heading">{sec.name}</span>
              {sec.endpoints.map((ep, i) => (
                <a
                  key={ep.path}
                  className={`docs-sidebar-link ${docs.currentSection === sec.name && docs.currentEndpointIndex === i ? 'docs-sidebar-link--active' : ''}`}
                  onClick={() => setDocs((d) => ({ ...d, currentSection: sec.name, currentEndpointIndex: i, testResult: null }))}
                >
                  <span className={`docs-sidebar-method docs-sidebar-method--${ep.method.toLowerCase()}`}>{ep.method}</span>
                  {ep.title}
                </a>
              ))}
            </div>
          ))}
        </nav>

        {/* ── Main content ── */}
        <main className="docs-content" data-flash={flash === 'content' ? '' : undefined}>
          {/* Endpoint header */}
          <div className="docs-endpoint-header">
            <h1 className="docs-endpoint-title">{endpoint.title}</h1>
            <div className="docs-endpoint-method-line">
              <span className={`docs-method-badge docs-method-badge--${endpoint.method.toLowerCase()}`}>{endpoint.method}</span>
              <code className="docs-endpoint-path">{endpoint.path}</code>
              {docs.authToken && (
                <span className="docs-auth-chip" data-flash={flash === 'auth' ? '' : undefined}>
                  {Icons.lock}
                  <span>Authenticated</span>
                </span>
              )}
              {!docs.authToken && (
                <span className="docs-auth-chip docs-auth-chip--none">
                  {Icons.key}
                  <span>No API key</span>
                </span>
              )}
            </div>
            <p className="docs-endpoint-description">{endpoint.description}</p>
          </div>

          {/* Code snippet */}
          <div className="docs-code-section" data-flash={flash === 'code' ? '' : undefined}>
            <div className="docs-code-header">
              <div className="docs-lang-tabs">
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang}
                    className={`docs-lang-tab ${lang === docs.currentLanguage ? 'docs-lang-tab--active' : ''}`}
                    onClick={() => setDocs((d) => ({ ...d, currentLanguage: lang }))}
                  >
                    {lang}
                  </button>
                ))}
              </div>
              <button
                className="docs-copy-btn"
                onClick={() => {
                  setDocs((d) => ({ ...d, copied: true }))
                  setTimeout(() => setDocs((d) => ({ ...d, copied: false })), 2000)
                }}
              >
                {docs.copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
            <pre className="docs-code-block"><code>{snippet}</code></pre>
          </div>

          {/* Test result */}
          {docs.testResult && (
            <div className="docs-test-result" data-flash={flash === 'test' ? '' : undefined}>
              <span className="docs-test-label">Test Result</span>
              <span className={`docs-test-status ${docs.testResult.status < 400 ? 'docs-test-status--ok' : 'docs-test-status--err'}`}>
                {docs.testResult.status} {docs.testResult.status < 400 ? 'OK' : 'Unauthorized'}
              </span>
              <span className="docs-test-time">{docs.testResult.time}</span>
            </div>
          )}

          {/* Parameters */}
          <div className="docs-params-section">
            <h2 className="docs-section-title">Parameters</h2>
            <div className="docs-params-table">
              {endpoint.params.map((p) => (
                <div key={p.name} className="docs-param-row">
                  <div className="docs-param-name-line">
                    <code className="docs-param-name">{p.name}</code>
                    <span className="docs-param-type">{p.type}</span>
                    {p.required && <span className="docs-param-required">required</span>}
                  </div>
                  <p className="docs-param-desc">{p.description}</p>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>

      {/* ── Hint ── */}
      <p className="docs-hint">
        This docs site exposes <strong>{toolCount} WebMCP tools</strong>. Press <kbd>⌘</kbd><kbd>K</kbd> to see what the agent can do.
      </p>

      {/* ── Palette ── */}
      <Command.Dialog
        open={open}
        onOpenChange={setOpen}
        onToolExecute={executeTool}
        onModeChange={handleModeChange}
        tools={[...TOOLS, ...QUICK_ACTIONS]}
        agent={agentConfig}
        label="API Documentation"
      >
        <Command.Input placeholder="Search docs, or describe what you need..." />
        <PaletteBody suggestion={suggestion} />
        <PaletteFooter />
      </Command.Dialog>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Palette body
// ─────────────────────────────────────────────────────────

function PaletteBody({ suggestion }: { suggestion: { tool: AgentKToolDef; reason: string } | null }) {
  const ak = useAgentK()
  const showList = ak.state.mode === 'browse'

  return (
    <>
      {showList && (
        <Command.List>
          {suggestion && (
            <Command.Group heading="Suggested">
              <Command.Tool tool={suggestion.tool} value={`suggested-${suggestion.tool.name}`}>
                <span data-agentk-tool-icon="">{suggestion.tool.icon}</span>
                <span data-agentk-suggestion-content="">
                  <span data-agentk-tool-name="">{suggestion.tool.label || suggestion.tool.name}</span>
                  <span data-agentk-suggestion-reason="">{suggestion.reason}</span>
                </span>
              </Command.Tool>
            </Command.Group>
          )}
          <Command.Group heading="Tools">
            {TOOLS.map((t) => (
              <Command.Tool key={t.name} tool={t} />
            ))}
          </Command.Group>
          <Command.Group heading="Quick Actions">
            {QUICK_ACTIONS.map((s) => (
              <Command.Tool key={s.name} tool={s} />
            ))}
          </Command.Group>
          <Command.Empty>No matching tools.</Command.Empty>
        </Command.List>
      )}
      <Command.AgentHint />
      <Command.Approval />
      <Command.ToolForm />
      <Command.ToolResult renderResult={(execution: ToolExecution) => {
        const msgFn = RESULT_MESSAGES[execution.toolName]
        const message = msgFn ? msgFn({ ...execution.parameters, ...execution.result }) : JSON.stringify(execution.result, null, 2)
        if (execution.error) {
          return (
            <div data-agentk-result-rich="">
              <div data-agentk-result-icon="" data-error="">✗</div>
              <div data-agentk-result-message="">{execution.error}</div>
            </div>
          )
        }
        return (
          <div data-agentk-result-rich="">
            <div data-agentk-result-icon="">✓</div>
            <div data-agentk-result-message="">{message}</div>
            <div data-agentk-result-meta="">
              {execution.startedAt && `${((Date.now() - execution.startedAt) / 1000).toFixed(1)}s`}
            </div>
          </div>
        )
      }} />
      <Command.ActivityFeed />
    </>
  )
}

// ─────────────────────────────────────────────────────────
// Palette footer — visible in all modes including planning
// ─────────────────────────────────────────────────────────

function PaletteFooter() {
  const ak = useAgentK()

  return (
    <div className="palette-footer">
      <div className="palette-footer-keys">
        {ak.state.mode === 'browse' && !ak.agentHintVisible && (
          <>
            <span className="palette-footer-key"><kbd>↑↓</kbd> navigate</span>
            <span className="palette-footer-key"><kbd>↵</kbd> select</span>
            <span className="palette-footer-key"><kbd>esc</kbd> close</span>
          </>
        )}
        {ak.state.mode === 'browse' && ak.agentHintVisible && (
          <>
            <span className="palette-footer-key"><kbd>↵</kbd> ask agent</span>
            <span className="palette-footer-key"><kbd>esc</kbd> close</span>
          </>
        )}
        {ak.state.mode === 'form' && (
          <>
            <span className="palette-footer-key"><kbd>↵</kbd> execute</span>
            <span className="palette-footer-key"><kbd>esc</kbd> back</span>
          </>
        )}
        {ak.state.mode === 'planning' && (
          <span className="palette-footer-key"><kbd>esc</kbd> cancel</span>
        )}
        {ak.state.mode === 'executing' && (
          <span className="palette-footer-key"><kbd>esc</kbd> cancel</span>
        )}
        {ak.state.mode === 'approval' && (
          <>
            <span className="palette-footer-key"><kbd>↵</kbd> approve</span>
            <span className="palette-footer-key"><kbd>esc</kbd> reject</span>
          </>
        )}
        {ak.state.mode === 'result' && (
          <span className="palette-footer-key"><kbd>↵</kbd> dismiss</span>
        )}
      </div>
      <span className="palette-footer-brand">
        <span className="palette-footer-dot" />
        agentk
      </span>
    </div>
  )
}
