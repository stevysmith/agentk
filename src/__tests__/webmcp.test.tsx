import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useWebMCPRegistration, type AgentKToolDef } from '../index'

type Registered = { tool: any; options: any }

function installFakeModelContext() {
  const registered: Registered[] = []
  const mc = {
    registerTool: vi.fn((tool: any, options: any) => {
      registered.push({ tool, options })
      return Promise.resolve()
    }),
    unregisterTool: vi.fn(),
  }
  ;(document as any).modelContext = mc
  return { mc, registered }
}

const TOOLS: AgentKToolDef[] = [
  { name: 'list_wings', label: 'List wings', description: 'Read-only listing', annotations: { readOnlyHint: true } },
  {
    name: 'buy_ticket',
    description: 'Pays',
    inputSchema: { type: 'object', properties: { wing: { type: 'string' } }, required: ['wing'] },
  },
]

describe('useWebMCPRegistration', () => {
  beforeEach(() => {
    delete (document as any).modelContext
    delete (navigator as any).modelContext
  })
  afterEach(() => {
    delete (document as any).modelContext
  })

  it('registers each tool with prefix, title, schema and annotations', async () => {
    const { mc, registered } = installFakeModelContext()
    const exec = vi.fn(async () => ({ ok: 1 }))
    const { result } = renderHook(() => useWebMCPRegistration(TOOLS, exec, { prefix: 'gallery_' }))
    await act(async () => {})
    expect(mc.registerTool).toHaveBeenCalledTimes(2)
    expect(result.current.active).toBe(true)
    const [a, b] = registered
    expect(a.tool.name).toBe('gallery_list_wings')
    expect(a.tool.title).toBe('List wings')
    expect(a.tool.annotations).toEqual({ readOnlyHint: true })
    expect(a.tool.inputSchema).toBeUndefined()
    expect(b.tool.name).toBe('gallery_buy_ticket')
    expect(b.tool.annotations).toBeUndefined()
    expect(b.tool.inputSchema.required).toEqual(['wing'])
    expect(a.options.signal).toBeInstanceOf(AbortSignal)
  })

  it('execute calls the executor with the unprefixed name and wraps the result as text content', async () => {
    const { registered } = installFakeModelContext()
    const exec = vi.fn(async (name: string, params: any) => ({ echoed: name, params }))
    renderHook(() => useWebMCPRegistration(TOOLS, exec, { prefix: 'gallery_' }))
    await act(async () => {})
    const res = await registered[1].tool.execute({ wing: 'van-gogh' })
    expect(exec).toHaveBeenCalledWith('buy_ticket', { wing: 'van-gogh' })
    expect(res.isError).toBeUndefined()
    expect(JSON.parse(res.content[0].text)).toEqual({ echoed: 'buy_ticket', params: { wing: 'van-gogh' } })
  })

  it('marks thrown errors with isError so agents can tell failure from success', async () => {
    const { registered } = installFakeModelContext()
    const exec = vi.fn(async () => {
      throw new Error('No ticket for the Van Gogh Room ($0.02).')
    })
    renderHook(() => useWebMCPRegistration(TOOLS, exec))
    await act(async () => {})
    const res = await registered[1].tool.execute({ wing: 'van-gogh' })
    expect(res.isError).toBe(true)
    expect(res.content[0].text).toContain('No ticket for the Van Gogh Room')
  })

  it('unregisters every prefixed tool and aborts the signal on unmount', async () => {
    const { mc, registered } = installFakeModelContext()
    const { unmount } = renderHook(() => useWebMCPRegistration(TOOLS, vi.fn(), { prefix: 'p_' }))
    await act(async () => {})
    const signal: AbortSignal = registered[0].options.signal
    unmount()
    expect(signal.aborted).toBe(true)
    expect(mc.unregisterTool).toHaveBeenCalledWith('p_list_wings')
    expect(mc.unregisterTool).toHaveBeenCalledWith('p_buy_ticket')
  })

  it('stays inactive (and quiet) when no modelContext exists', async () => {
    const { result } = renderHook(() => useWebMCPRegistration(TOOLS, vi.fn(), { maxWaitMs: 300, retryMs: 50 }))
    await act(async () => {
      await new Promise((r) => setTimeout(r, 400))
    })
    expect(result.current.active).toBe(false)
  })
})

describe('useWebMCPRegistration — surface changes while a call is in flight', () => {
  beforeEach(() => {
    delete (document as any).modelContext
  })

  it('defers unregister/register until the in-flight execution has returned (Chrome <153 aborts otherwise)', async () => {
    const registered: Registered[] = []
    const events: string[] = []
    let inflight = 0
    const mc = {
      registerTool: vi.fn((tool: any, options: any) => {
        registered.push({ tool, options })
        events.push(`register:${tool.name}${inflight ? ' (DURING CALL)' : ''}`)
        return Promise.resolve()
      }),
      unregisterTool: vi.fn((name: string) => {
        events.push(`unregister:${name}${inflight ? ' (DURING CALL)' : ''}`)
      }),
    }
    ;(document as any).modelContext = mc

    let release!: () => void
    const gate = new Promise<void>((r) => (release = r))
    const exec = vi.fn(async (name: string) => {
      if (name === 'buy') {
        await gate
        return { bought: true }
      }
      return { ok: true }
    })
    const before: AgentKToolDef[] = [{ name: 'buy', description: 'buy' }]
    const after: AgentKToolDef[] = [{ name: 'buy', description: 'buy' }, { name: 'enter', description: 'enter' }]
    const { rerender } = renderHook(({ t }) => useWebMCPRegistration(t, exec), { initialProps: { t: before } })
    await act(async () => {})
    expect(events).toEqual(['register:buy'])

    // an agent calls buy; its result will change the catalog
    inflight = 1
    const call = registered[0].tool.execute({})
    await act(async () => {
      rerender({ t: after }) // page re-renders with a bigger catalog while the call runs
    })
    // nothing may be unregistered or registered yet
    expect(events).toEqual(['register:buy'])

    release()
    const res = await call
    inflight = 0
    expect(JSON.parse(res.content[0].text)).toEqual({ bought: true })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 60))
    })
    expect(events).toEqual(['register:buy', 'unregister:buy', 'register:buy', 'register:enter'])
    expect(events.some((e) => e.includes('DURING CALL'))).toBe(false)
  })
})

describe('executeTool input conventions', () => {
  beforeEach(() => {
    delete (document as any).modelContext
  })

  it('passes an object (the spec shape ChatGPT enforces) and falls back to a JSON string', async () => {
    const seen: any[] = []
    // A host that only accepts a JSON string, like shipping Chrome builds.
    ;(document as any).modelContext = {
      registerTool: vi.fn(() => Promise.resolve()),
      unregisterTool: vi.fn(),
      executeTool: vi.fn(async (_name: string, input: unknown) => {
        seen.push(input)
        if (typeof input !== 'string') throw new Error('executeTool expects a string input')
        return { content: [{ type: 'text', text: 'ok' }] }
      }),
    }
    const { useWebMCPTools } = await import('../index')
    const { result } = renderHook(() => useWebMCPTools())
    await act(async () => {})
    const r = await result.current.executeTool('demo', { a: 1 })
    expect(seen[0]).toEqual({ a: 1 })        // object first
    expect(seen[1]).toBe('{"a":1}')          // then the string fallback
    expect(r.content[0].text).toBe('ok')
  })

  it('does not retry when the host fails for an unrelated reason', async () => {
    const executeTool = vi.fn(async () => {
      throw new Error('tool is busy')
    })
    ;(document as any).modelContext = { registerTool: vi.fn(() => Promise.resolve()), unregisterTool: vi.fn(), executeTool }
    const { useWebMCPTools } = await import('../index')
    const { result } = renderHook(() => useWebMCPTools())
    await act(async () => {})
    await expect(result.current.executeTool('demo', {})).rejects.toThrow('tool is busy')
    expect(executeTool).toHaveBeenCalledTimes(1)
  })
})
