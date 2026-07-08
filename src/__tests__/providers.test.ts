import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { anthropicProvider } from '../providers/anthropic'
import { openaiProvider } from '../providers/openai'
import { googleProvider } from '../providers/google'
import { resolveProvider } from '../providers/resolve'
import { toToolSchema, buildSystemPrompt, buildFallbackSummary } from '../providers/utils'
import type { AgentKAgentConfig } from '../providers/types'
import type { ToolDef } from '../providers/utils'

// ─────────────────────────────────────────────────────────────
// Shared test fixtures
// ─────────────────────────────────────────────────────────────

const testTools: ToolDef[] = [
  {
    name: 'set_brightness',
    description: 'Set brightness level',
    inputSchema: {
      type: 'object',
      properties: {
        level: { type: 'number', minimum: 0, maximum: 100 },
      },
      required: ['level'],
    },
  },
  {
    name: 'toggle_power',
    description: 'Toggle power on/off',
  },
]

const baseConfig: AgentKAgentConfig = {
  provider: 'anthropic',
  apiKey: 'test-key',
}

// ─────────────────────────────────────────────────────────────
// Helpers to create mock responses
// ─────────────────────────────────────────────────────────────

function mockFetchResponse(body: any, status = 200, contentType = 'application/json') {
  const headers = new Headers({ 'content-type': contentType })
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    headers,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
    body: null,
  })
}

function mockFetchError(status: number, errorText: string) {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    headers: new Headers(),
    text: () => Promise.resolve(errorText),
  })
}

// ─────────────────────────────────────────────────────────────
// Provider utility tests
// ─────────────────────────────────────────────────────────────

describe('Provider utilities', () => {
  describe('toToolSchema', () => {
    it('converts a tool definition to schema format', () => {
      const schema = toToolSchema(testTools[0])
      expect(schema.name).toBe('set_brightness')
      expect(schema.description).toBe('Set brightness level')
      expect(schema.inputSchema).toEqual(testTools[0].inputSchema)
    })

    it('falls back to label when description is missing', () => {
      const schema = toToolSchema({ name: 'test', label: 'Test Label' })
      expect(schema.description).toBe('Test Label')
    })

    it('falls back to name when description and label are missing', () => {
      const schema = toToolSchema({ name: 'test' })
      expect(schema.description).toBe('test')
    })

    it('provides empty object schema when inputSchema is missing', () => {
      const schema = toToolSchema({ name: 'test' })
      expect(schema.inputSchema).toEqual({ type: 'object', properties: {} })
    })
  })

  describe('buildSystemPrompt', () => {
    it('includes tool names and descriptions', () => {
      const prompt = buildSystemPrompt(testTools)
      expect(prompt).toContain('set_brightness')
      expect(prompt).toContain('Set brightness level')
      expect(prompt).toContain('toggle_power')
      expect(prompt).toContain('Toggle power on/off')
    })

    it('falls back to "No description" for tools without description', () => {
      const prompt = buildSystemPrompt([{ name: 'test' }])
      expect(prompt).toContain('No description')
    })
  })

  describe('buildFallbackSummary', () => {
    it('builds summary from single tool name', () => {
      const summary = buildFallbackSummary(['search_web'])
      expect(summary).toBe("I'll search web")
    })

    it('joins multiple tool names with "and"', () => {
      const summary = buildFallbackSummary(['search_web', 'open_tab'])
      expect(summary).toBe("I'll search web and open tab")
    })

    it('replaces underscores with spaces', () => {
      const summary = buildFallbackSummary(['set_brightness_level'])
      expect(summary).toBe("I'll set brightness level")
    })
  })
})

// ─────────────────────────────────────────────────────────────
// Anthropic provider
// ─────────────────────────────────────────────────────────────

describe('Anthropic provider', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('builds correct request body', async () => {
    const fetchMock = mockFetchResponse({
      content: [{ type: 'text', text: 'I will set brightness' }],
    })
    globalThis.fetch = fetchMock

    await anthropicProvider('set brightness to 50', testTools, {
      ...baseConfig,
      model: 'claude-sonnet-4-20250514',
    })

    expect(fetchMock).toHaveBeenCalledOnce()
    const callArgs = fetchMock.mock.calls[0]
    expect(callArgs[0]).toBe('https://api.anthropic.com/v1/messages')

    const body = JSON.parse(callArgs[1].body)
    expect(body.model).toBe('claude-sonnet-4-20250514')
    expect(body.max_tokens).toBe(8192)
    expect(body.messages).toEqual([{ role: 'user', content: 'set brightness to 50' }])
    expect(body.tools).toHaveLength(2)
    expect(body.tools[0].name).toBe('set_brightness')
    expect(body.tools[0].input_schema).toEqual(testTools[0].inputSchema)
  })

  it('sets correct headers with API key', async () => {
    const fetchMock = mockFetchResponse({ content: [] })
    globalThis.fetch = fetchMock

    await anthropicProvider('test', testTools, baseConfig)

    const headers = fetchMock.mock.calls[0][1].headers
    expect(headers['x-api-key']).toBe('test-key')
    expect(headers['anthropic-version']).toBe('2023-06-01')
    expect(headers['anthropic-dangerous-direct-browser-access']).toBe('true')
    expect(headers['Content-Type']).toBe('application/json')
  })

  it('does not set API key headers when no key provided', async () => {
    const fetchMock = mockFetchResponse({ content: [] })
    globalThis.fetch = fetchMock

    await anthropicProvider('test', testTools, { provider: 'anthropic' })

    const headers = fetchMock.mock.calls[0][1].headers
    expect(headers['x-api-key']).toBeUndefined()
    expect(headers['anthropic-version']).toBeUndefined()
  })

  it('parses tool_use and text blocks into AgentKPlan', async () => {
    globalThis.fetch = mockFetchResponse({
      content: [
        { type: 'text', text: 'I will set the brightness.' },
        { type: 'tool_use', name: 'set_brightness', input: { level: 50 } },
      ],
    })

    const plan = await anthropicProvider('set brightness', testTools, baseConfig)

    expect(plan.summary).toBe('I will set the brightness.')
    expect(plan.calls).toHaveLength(1)
    expect(plan.calls[0].toolName).toBe('set_brightness')
    expect(plan.calls[0].parameters).toEqual({ level: 50 })
  })

  it('handles empty tool calls (text-only response)', async () => {
    globalThis.fetch = mockFetchResponse({
      content: [{ type: 'text', text: 'I cannot help with that.' }],
    })

    const plan = await anthropicProvider('do something', testTools, baseConfig)

    expect(plan.calls).toHaveLength(0)
    expect(plan.summary).toBe('I cannot help with that.')
  })

  it('skips thinking blocks', async () => {
    globalThis.fetch = mockFetchResponse({
      content: [
        { type: 'thinking', thinking: 'Let me think about this...' },
        { type: 'text', text: 'Here is my answer.' },
        { type: 'tool_use', name: 'toggle_power', input: {} },
      ],
    })

    const plan = await anthropicProvider('toggle power', testTools, baseConfig)

    expect(plan.summary).toBe('Here is my answer.')
    expect(plan.calls).toHaveLength(1)
    expect(plan.calls[0].toolName).toBe('toggle_power')
  })

  it('throws on error blocks', async () => {
    globalThis.fetch = mockFetchResponse({
      content: [
        { type: 'error', error: { message: 'Rate limit exceeded' } },
      ],
    })

    await expect(anthropicProvider('test', testTools, baseConfig)).rejects.toThrow(
      'Anthropic content error: Rate limit exceeded',
    )
  })

  it('calls onProviderError on error blocks before throwing', async () => {
    const onProviderError = vi.fn()
    globalThis.fetch = mockFetchResponse({
      content: [
        { type: 'error', error: { message: 'Rate limit exceeded' } },
      ],
    })

    await expect(
      anthropicProvider('test', testTools, { ...baseConfig, onProviderError }),
    ).rejects.toThrow()

    expect(onProviderError).toHaveBeenCalledWith(expect.any(Error))
  })

  it('handles missing content array', async () => {
    const onProviderError = vi.fn()
    globalThis.fetch = mockFetchResponse({ id: 'msg_123' })

    const plan = await anthropicProvider('test', testTools, {
      ...baseConfig,
      onProviderError,
    })

    expect(plan.calls).toHaveLength(0)
    expect(plan.summary).toBe('')
    expect(onProviderError).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('missing content array') }),
    )
  })

  it('throws on non-200 response', async () => {
    globalThis.fetch = mockFetchError(429, 'Rate limited')

    await expect(anthropicProvider('test', testTools, baseConfig)).rejects.toThrow(
      'Anthropic API error 429: Rate limited',
    )
  })

  it('passes signal to fetch', async () => {
    const fetchMock = mockFetchResponse({ content: [] })
    globalThis.fetch = fetchMock
    const controller = new AbortController()

    await anthropicProvider('test', testTools, baseConfig, controller.signal)

    expect(fetchMock.mock.calls[0][1].signal).toBe(controller.signal)
  })

  it('uses custom endpoint when provided', async () => {
    const fetchMock = mockFetchResponse({ content: [] })
    globalThis.fetch = fetchMock

    await anthropicProvider('test', testTools, {
      ...baseConfig,
      endpoint: 'https://my-proxy.com/api',
    })

    expect(fetchMock.mock.calls[0][0]).toBe('https://my-proxy.com/api')
  })

  it('uses default model when not specified', async () => {
    const fetchMock = mockFetchResponse({ content: [] })
    globalThis.fetch = fetchMock

    await anthropicProvider('test', testTools, { provider: 'anthropic' })

    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.model).toBe('claude-sonnet-4-20250514')
  })

  it('generates fallback summary when text is missing but calls exist', async () => {
    globalThis.fetch = mockFetchResponse({
      content: [
        { type: 'tool_use', name: 'set_brightness', input: { level: 50 } },
        { type: 'tool_use', name: 'toggle_power', input: {} },
      ],
    })

    const plan = await anthropicProvider('test', testTools, baseConfig)

    expect(plan.summary).toBe("I'll set brightness and toggle power")
    expect(plan.calls).toHaveLength(2)
  })

  it('handles tool_use with missing input', async () => {
    globalThis.fetch = mockFetchResponse({
      content: [
        { type: 'tool_use', name: 'toggle_power' },
      ],
    })

    const plan = await anthropicProvider('test', testTools, baseConfig)

    expect(plan.calls[0].parameters).toEqual({})
  })

  it('handles top-level error response', async () => {
    globalThis.fetch = mockFetchResponse({
      type: 'error',
      error: { message: 'Invalid API key' },
    })

    await expect(anthropicProvider('test', testTools, baseConfig)).rejects.toThrow(
      'Anthropic API error: Invalid API key',
    )
  })

  it('throws on unexpected content-type', async () => {
    const headers = new Headers({ 'content-type': 'text/html' })
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers,
      text: () => Promise.resolve('<html>Error</html>'),
    })

    await expect(anthropicProvider('test', testTools, baseConfig)).rejects.toThrow(
      'unexpected content-type',
    )
  })

  it('sets stream flag in body when config.stream is true', async () => {
    // For streaming, we need a body with getReader
    const mockReader = {
      read: vi.fn()
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode(
            'event: message_start\ndata: {"type":"message_start"}\n\n' +
            'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n' +
            'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}\n\n' +
            'event: content_block_stop\ndata: {"type":"content_block_stop","index":0}\n\n' +
            'event: message_stop\ndata: {"type":"message_stop"}\n\n',
          ),
        })
        .mockResolvedValueOnce({ done: true, value: undefined }),
      cancel: vi.fn(),
    }

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'text/event-stream' }),
      body: { getReader: () => mockReader },
    })
    globalThis.fetch = fetchMock

    const plan = await anthropicProvider('test', testTools, {
      ...baseConfig,
      stream: true,
    })

    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.stream).toBe(true)
    expect(plan.summary).toBe('Hello')
  })

  describe('streaming', () => {
    it('parses SSE events with tool calls into plan', async () => {
      const events = [
        'event: message_start\ndata: {"type":"message_start"}\n\n',
        'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n',
        'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Setting brightness"}}\n\n',
        'event: content_block_stop\ndata: {"type":"content_block_stop","index":0}\n\n',
        'event: content_block_start\ndata: {"type":"content_block_start","index":1,"content_block":{"type":"tool_use","name":"set_brightness"}}\n\n',
        'event: content_block_delta\ndata: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":"{\\"level\\": 50}"}}\n\n',
        'event: content_block_stop\ndata: {"type":"content_block_stop","index":1}\n\n',
        'event: message_stop\ndata: {"type":"message_stop"}\n\n',
      ].join('')

      const mockReader = {
        read: vi.fn()
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(events) })
          .mockResolvedValueOnce({ done: true, value: undefined }),
        cancel: vi.fn(),
      }

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/event-stream' }),
        body: { getReader: () => mockReader },
      })

      const plan = await anthropicProvider('test', testTools, {
        ...baseConfig,
        stream: true,
      })

      expect(plan.summary).toBe('Setting brightness')
      expect(plan.calls).toHaveLength(1)
      expect(plan.calls[0].toolName).toBe('set_brightness')
      expect(plan.calls[0].parameters).toEqual({ level: 50 })
    })

    it('handles abort signal', async () => {
      const controller = new AbortController()
      controller.abort()

      const mockReader = {
        read: vi.fn().mockResolvedValue({ done: true, value: undefined }),
        cancel: vi.fn(),
      }

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/event-stream' }),
        body: { getReader: () => mockReader },
      })

      await expect(
        anthropicProvider('test', testTools, { ...baseConfig, stream: true }, controller.signal),
      ).rejects.toThrow('aborted')
    })

    it('throws on missing body in streaming response', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/event-stream' }),
        body: null,
      })

      await expect(
        anthropicProvider('test', testTools, { ...baseConfig, stream: true }),
      ).rejects.toThrow('no body')
    })

    it('handles stream error events', async () => {
      const events =
        'event: error\ndata: {"type":"error","error":{"message":"Overloaded"}}\n\n'

      const mockReader = {
        read: vi.fn()
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(events) })
          .mockResolvedValueOnce({ done: true, value: undefined }),
        cancel: vi.fn(),
      }

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/event-stream' }),
        body: { getReader: () => mockReader },
      })

      await expect(
        anthropicProvider('test', testTools, { ...baseConfig, stream: true }),
      ).rejects.toThrow('Overloaded')
    })

    it('generates fallback summary when text is missing in streaming', async () => {
      const events = [
        'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"tool_use","name":"toggle_power"}}\n\n',
        'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"{}"}}\n\n',
        'event: content_block_stop\ndata: {"type":"content_block_stop","index":0}\n\n',
        'event: message_stop\ndata: {"type":"message_stop"}\n\n',
      ].join('')

      const mockReader = {
        read: vi.fn()
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(events) })
          .mockResolvedValueOnce({ done: true, value: undefined }),
        cancel: vi.fn(),
      }

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/event-stream' }),
        body: { getReader: () => mockReader },
      })

      const plan = await anthropicProvider('test', testTools, {
        ...baseConfig,
        stream: true,
      })

      expect(plan.summary).toBe("I'll toggle power")
    })
  })
})

// ─────────────────────────────────────────────────────────────
// OpenAI provider
// ─────────────────────────────────────────────────────────────

describe('OpenAI provider', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  const openaiConfig: AgentKAgentConfig = {
    provider: 'openai',
    apiKey: 'sk-test',
  }

  it('builds correct request body (function calling format)', async () => {
    const fetchMock = mockFetchResponse({
      choices: [{ message: { content: 'Hello', tool_calls: [] } }],
    })
    globalThis.fetch = fetchMock

    await openaiProvider('test', testTools, openaiConfig)

    expect(fetchMock).toHaveBeenCalledOnce()
    const callArgs = fetchMock.mock.calls[0]
    expect(callArgs[0]).toBe('https://api.openai.com/v1/chat/completions')

    const body = JSON.parse(callArgs[1].body)
    expect(body.model).toBe('gpt-4o')
    expect(body.messages).toHaveLength(2)
    expect(body.messages[0].role).toBe('system')
    expect(body.messages[1]).toEqual({ role: 'user', content: 'test' })
    expect(body.tools).toHaveLength(2)
    expect(body.tools[0].type).toBe('function')
    expect(body.tools[0].function.name).toBe('set_brightness')
    expect(body.tools[0].function.parameters).toEqual(testTools[0].inputSchema)
  })

  it('sets Authorization header with Bearer token', async () => {
    const fetchMock = mockFetchResponse({
      choices: [{ message: { content: 'Hi' } }],
    })
    globalThis.fetch = fetchMock

    await openaiProvider('test', testTools, openaiConfig)

    const headers = fetchMock.mock.calls[0][1].headers
    expect(headers['Authorization']).toBe('Bearer sk-test')
  })

  it('parses tool_calls into AgentKPlan', async () => {
    globalThis.fetch = mockFetchResponse({
      choices: [
        {
          message: {
            content: 'Setting brightness',
            tool_calls: [
              {
                type: 'function',
                function: {
                  name: 'set_brightness',
                  arguments: '{"level": 75}',
                },
              },
            ],
          },
        },
      ],
    })

    const plan = await openaiProvider('set brightness', testTools, openaiConfig)

    expect(plan.summary).toBe('Setting brightness')
    expect(plan.calls).toHaveLength(1)
    expect(plan.calls[0].toolName).toBe('set_brightness')
    expect(plan.calls[0].parameters).toEqual({ level: 75 })
  })

  it('handles legacy function_call format', async () => {
    globalThis.fetch = mockFetchResponse({
      choices: [
        {
          message: {
            content: '',
            function_call: {
              name: 'toggle_power',
              arguments: '{}',
            },
          },
        },
      ],
    })

    const plan = await openaiProvider('toggle', testTools, openaiConfig)

    expect(plan.calls).toHaveLength(1)
    expect(plan.calls[0].toolName).toBe('toggle_power')
    expect(plan.calls[0].parameters).toEqual({})
  })

  it('wraps JSON.parse in try/catch for bad arguments', async () => {
    const onProviderError = vi.fn()
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    globalThis.fetch = mockFetchResponse({
      choices: [
        {
          message: {
            content: 'Trying',
            tool_calls: [
              {
                type: 'function',
                function: {
                  name: 'set_brightness',
                  arguments: '{invalid json',
                },
              },
            ],
          },
        },
      ],
    })

    const plan = await openaiProvider('test', testTools, {
      ...openaiConfig,
      onProviderError,
    })

    // Should skip the bad call but not throw
    expect(plan.calls).toHaveLength(0)
    expect(plan.summary).toBe('Trying')
    expect(onProviderError).toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('throws on non-200 response', async () => {
    globalThis.fetch = mockFetchError(500, 'Internal Server Error')

    await expect(openaiProvider('test', testTools, openaiConfig)).rejects.toThrow(
      'OpenAI API error 500: Internal Server Error',
    )
  })

  it('handles missing choices array gracefully', async () => {
    const onProviderError = vi.fn()
    globalThis.fetch = mockFetchResponse({ id: 'chatcmpl-123' })

    const plan = await openaiProvider('test', testTools, {
      ...openaiConfig,
      onProviderError,
    })

    expect(plan.calls).toHaveLength(0)
    expect(plan.summary).toBe('')
    expect(onProviderError).toHaveBeenCalled()
  })

  it('handles missing message in first choice', async () => {
    const onProviderError = vi.fn()
    globalThis.fetch = mockFetchResponse({
      choices: [{ finish_reason: 'stop' }],
    })

    const plan = await openaiProvider('test', testTools, {
      ...openaiConfig,
      onProviderError,
    })

    expect(plan.calls).toHaveLength(0)
    expect(plan.summary).toBe('')
    expect(onProviderError).toHaveBeenCalled()
  })

  it('generates fallback summary when content is empty but calls exist', async () => {
    globalThis.fetch = mockFetchResponse({
      choices: [
        {
          message: {
            content: '',
            tool_calls: [
              {
                type: 'function',
                function: {
                  name: 'set_brightness',
                  arguments: '{"level": 50}',
                },
              },
            ],
          },
        },
      ],
    })

    const plan = await openaiProvider('test', testTools, openaiConfig)

    expect(plan.summary).toBe("I'll set brightness")
  })

  it('uses custom endpoint when provided', async () => {
    const fetchMock = mockFetchResponse({
      choices: [{ message: { content: 'Hi' } }],
    })
    globalThis.fetch = fetchMock

    await openaiProvider('test', testTools, {
      ...openaiConfig,
      endpoint: 'https://my-proxy.com/openai',
    })

    expect(fetchMock.mock.calls[0][0]).toBe('https://my-proxy.com/openai')
  })

  it('passes signal to fetch', async () => {
    const fetchMock = mockFetchResponse({
      choices: [{ message: { content: 'Hi' } }],
    })
    globalThis.fetch = fetchMock
    const controller = new AbortController()

    await openaiProvider('test', testTools, openaiConfig, controller.signal)

    expect(fetchMock.mock.calls[0][1].signal).toBe(controller.signal)
  })

  it('throws on unexpected content-type', async () => {
    const headers = new Headers({ 'content-type': 'text/html' })
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers,
      text: () => Promise.resolve('<html>Error</html>'),
    })

    await expect(openaiProvider('test', testTools, openaiConfig)).rejects.toThrow(
      'unexpected content-type',
    )
  })

  it('handles legacy function_call bad arguments gracefully', async () => {
    const onProviderError = vi.fn()
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    globalThis.fetch = mockFetchResponse({
      choices: [
        {
          message: {
            content: '',
            function_call: {
              name: 'toggle_power',
              arguments: 'not json',
            },
          },
        },
      ],
    })

    const plan = await openaiProvider('test', testTools, {
      ...openaiConfig,
      onProviderError,
    })

    expect(plan.calls).toHaveLength(0)
    expect(onProviderError).toHaveBeenCalled()
    warnSpy.mockRestore()
  })
})

// ─────────────────────────────────────────────────────────────
// Google provider
// ─────────────────────────────────────────────────────────────

describe('Google provider', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  const googleConfig: AgentKAgentConfig = {
    provider: 'google',
    apiKey: 'AIza-test',
  }

  it('builds correct request body (functionDeclarations format)', async () => {
    const fetchMock = mockFetchResponse({
      candidates: [
        {
          content: {
            parts: [{ text: 'Done' }],
          },
        },
      ],
    })
    globalThis.fetch = fetchMock

    await googleProvider('test', testTools, googleConfig)

    expect(fetchMock).toHaveBeenCalledOnce()
    const callArgs = fetchMock.mock.calls[0]
    expect(callArgs[0]).toContain('generativelanguage.googleapis.com')
    expect(callArgs[0]).toContain('gemini-2.0-flash')
    expect(callArgs[0]).toContain('key=AIza-test')

    const body = JSON.parse(callArgs[1].body)
    expect(body.contents[0].role).toBe('user')
    expect(body.contents[0].parts[0].text).toBe('test')
    expect(body.tools[0].functionDeclarations).toHaveLength(2)
    expect(body.tools[0].functionDeclarations[0].name).toBe('set_brightness')
  })

  it('parses functionCall parts into AgentKPlan', async () => {
    globalThis.fetch = mockFetchResponse({
      candidates: [
        {
          content: {
            parts: [
              { text: 'Setting brightness now' },
              {
                functionCall: {
                  name: 'set_brightness',
                  args: { level: 80 },
                },
              },
            ],
          },
        },
      ],
    })

    const plan = await googleProvider('set brightness', testTools, googleConfig)

    expect(plan.summary).toBe('Setting brightness now')
    expect(plan.calls).toHaveLength(1)
    expect(plan.calls[0].toolName).toBe('set_brightness')
    expect(plan.calls[0].parameters).toEqual({ level: 80 })
  })

  it('handles finishReason: "SAFETY" (throws)', async () => {
    globalThis.fetch = mockFetchResponse({
      candidates: [
        {
          finishReason: 'SAFETY',
          content: { parts: [] },
        },
      ],
    })

    await expect(googleProvider('test', testTools, googleConfig)).rejects.toThrow(
      'safety filters',
    )
  })

  it('handles missing candidates', async () => {
    const onProviderError = vi.fn()
    globalThis.fetch = mockFetchResponse({})

    const plan = await googleProvider('test', testTools, {
      ...googleConfig,
      onProviderError,
    })

    expect(plan.calls).toHaveLength(0)
    expect(plan.summary).toBe('')
    expect(onProviderError).toHaveBeenCalled()
  })

  it('throws on non-200 response', async () => {
    globalThis.fetch = mockFetchError(403, 'Forbidden')

    await expect(googleProvider('test', testTools, googleConfig)).rejects.toThrow(
      'Google API error 403: Forbidden',
    )
  })

  it('uses custom endpoint when provided', async () => {
    const fetchMock = mockFetchResponse({
      candidates: [{ content: { parts: [{ text: 'OK' }] } }],
    })
    globalThis.fetch = fetchMock

    await googleProvider('test', testTools, {
      ...googleConfig,
      endpoint: 'https://my-proxy.com/gemini',
    })

    expect(fetchMock.mock.calls[0][0]).toBe('https://my-proxy.com/gemini')
  })

  it('passes signal to fetch', async () => {
    const fetchMock = mockFetchResponse({
      candidates: [{ content: { parts: [{ text: 'OK' }] } }],
    })
    globalThis.fetch = fetchMock
    const controller = new AbortController()

    await googleProvider('test', testTools, googleConfig, controller.signal)

    expect(fetchMock.mock.calls[0][1].signal).toBe(controller.signal)
  })

  it('handles missing content in candidate', async () => {
    const onProviderError = vi.fn()
    globalThis.fetch = mockFetchResponse({
      candidates: [{ finishReason: 'MAX_TOKENS' }],
    })

    const plan = await googleProvider('test', testTools, {
      ...googleConfig,
      onProviderError,
    })

    expect(plan.calls).toHaveLength(0)
    expect(plan.summary).toBe('')
    expect(onProviderError).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('no content') }),
    )
  })

  it('handles missing parts array', async () => {
    const onProviderError = vi.fn()
    globalThis.fetch = mockFetchResponse({
      candidates: [{ content: {} }],
    })

    const plan = await googleProvider('test', testTools, {
      ...googleConfig,
      onProviderError,
    })

    expect(plan.calls).toHaveLength(0)
    expect(onProviderError).toHaveBeenCalled()
  })

  it('handles functionCall with missing args', async () => {
    globalThis.fetch = mockFetchResponse({
      candidates: [
        {
          content: {
            parts: [
              { functionCall: { name: 'toggle_power' } },
            ],
          },
        },
      ],
    })

    const plan = await googleProvider('test', testTools, googleConfig)

    expect(plan.calls[0].parameters).toEqual({})
  })

  it('generates fallback summary when text is missing but calls exist', async () => {
    globalThis.fetch = mockFetchResponse({
      candidates: [
        {
          content: {
            parts: [
              { functionCall: { name: 'set_brightness', args: { level: 50 } } },
            ],
          },
        },
      ],
    })

    const plan = await googleProvider('test', testTools, googleConfig)

    expect(plan.summary).toBe("I'll set brightness")
  })

  it('throws on unexpected content-type', async () => {
    const headers = new Headers({ 'content-type': 'text/html' })
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers,
      text: () => Promise.resolve('<html>Error</html>'),
    })

    await expect(googleProvider('test', testTools, googleConfig)).rejects.toThrow(
      'unexpected content-type',
    )
  })
})

// ─────────────────────────────────────────────────────────────
// resolveProvider
// ─────────────────────────────────────────────────────────────

describe('resolveProvider', () => {
  it('returns anthropic provider for anthropic type', () => {
    const provider = resolveProvider({ provider: 'anthropic' })
    expect(provider).toBe(anthropicProvider)
  })

  it('returns openai provider for openai type', () => {
    const provider = resolveProvider({ provider: 'openai' })
    expect(provider).toBe(openaiProvider)
  })

  it('returns google provider for google type', () => {
    const provider = resolveProvider({ provider: 'google' })
    expect(provider).toBe(googleProvider)
  })

  it('throws for unknown provider', () => {
    expect(() => resolveProvider({ provider: 'unknown' as any })).toThrow(
      'Unknown provider: unknown',
    )
  })

  it('throws for custom without providerFn', () => {
    expect(() => resolveProvider({ provider: 'custom' })).toThrow(
      'Custom provider requires providerFn',
    )
  })

  it('returns custom providerFn when provided', () => {
    const customFn = vi.fn()
    const provider = resolveProvider({
      provider: 'custom',
      providerFn: customFn as any,
    })
    expect(provider).toBe(customFn)
  })

  it('returns providerFn even when provider is not custom', () => {
    // providerFn takes priority over built-in
    const customFn = vi.fn()
    const provider = resolveProvider({
      provider: 'anthropic',
      providerFn: customFn as any,
    })
    expect(provider).toBe(customFn)
  })

  it('warns on API key in browser', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    // window is defined in jsdom environment
    resolveProvider({ provider: 'anthropic', apiKey: 'sk-test' })

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('API key detected in browser'),
    )
    warnSpy.mockRestore()
  })
})
