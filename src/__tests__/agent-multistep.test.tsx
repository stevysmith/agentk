import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react'
import * as React from 'react'
import { Command, type AgentKToolDef, type AgentKPlan } from '../index'

const TOOLS: AgentKToolDef[] = [
  { name: 'list_rooms', description: 'List rooms', annotations: { readOnlyHint: true } },
  { name: 'buy_ticket', description: 'Buy a ticket', inputSchema: { type: 'object', properties: { room: { type: 'string' } } } },
  { name: 'enter_room', description: 'Enter a room', inputSchema: { type: 'object', properties: { room: { type: 'string' } } } },
  { name: 'pay', description: 'Pay for admission', annotations: { consequentialHint: true } },
]

function renderPalette(props: Partial<React.ComponentProps<typeof Command>> = {}) {
  return render(
    <Command label="Test" tools={TOOLS} {...props}>
      <Command.Input placeholder="Search..." />
      <Command.List>
        <Command.Empty>No results</Command.Empty>
        {TOOLS.map((t) => (
          <Command.Tool key={t.name} tool={t} />
        ))}
      </Command.List>
      <Command.AgentHint />
      <Command.Approval />
      <Command.ToolResult />
      <Command.ActivityFeed />
    </Command>,
  )
}

async function ask(text: string) {
  const input = screen.getByPlaceholderText('Search...')
  await act(async () => {
    fireEvent.change(input, { target: { value: text } })
  })
  await act(async () => {
    fireEvent.keyDown(input, { key: 'Enter' })
  })
}

afterEach(() => cleanup())

describe('multi-step agent runs (maxSteps)', () => {
  it('feeds results back and keeps going until the model replies with text', async () => {
    const prompts: string[] = []
    const providerFn = vi.fn(async (prompt: string): Promise<AgentKPlan> => {
      const turn = prompts.push(prompt)
      if (turn === 1) return { summary: 'Looking first', calls: [{ toolName: 'list_rooms', parameters: {} }] }
      if (turn === 2) return { summary: 'Buying', calls: [{ toolName: 'buy_ticket', parameters: { room: 'blue' } }] }
      return { summary: 'You are in the blue room.', calls: [] }
    })
    const onToolExecute = vi.fn(async (name: string) => (name === 'list_rooms' ? { rooms: ['blue'] } : { ticket: 'ok' }))

    renderPalette({ onToolExecute, agent: { provider: 'custom', providerFn, requireApproval: false, maxSteps: 5 } })
    await ask('get me into the blue room')

    await waitFor(() => expect(providerFn).toHaveBeenCalledTimes(3))
    expect(onToolExecute.mock.calls.map((c) => c[0])).toEqual(['list_rooms', 'buy_ticket'])

    // turn 2's prompt carries the original intent and the first result
    expect(prompts[1]).toContain('get me into the blue room')
    expect(prompts[1]).toContain('list_rooms')
    expect(prompts[1]).toContain('blue')
    // the final text answer is surfaced
    await waitFor(() => expect(screen.getAllByText('You are in the blue room.').length).toBeGreaterThan(0))
  })

  it('stays single-shot by default, so a scripted provider cannot loop', async () => {
    const providerFn = vi.fn(async (): Promise<AgentKPlan> => ({ summary: 'Always the same', calls: [{ toolName: 'list_rooms', parameters: {} }] }))
    const onToolExecute = vi.fn(async () => ({ ok: true }))

    renderPalette({ onToolExecute, agent: { provider: 'custom', providerFn, requireApproval: false } })
    await ask('anything')

    await waitFor(() => expect(onToolExecute).toHaveBeenCalledTimes(1))
    await act(async () => {
      await new Promise((r) => setTimeout(r, 150))
    })
    expect(providerFn).toHaveBeenCalledTimes(1)
    expect(onToolExecute).toHaveBeenCalledTimes(1)
  })

  it('stops at maxSteps even if the model keeps calling tools', async () => {
    const providerFn = vi.fn(async (): Promise<AgentKPlan> => ({ summary: 'again', calls: [{ toolName: 'list_rooms', parameters: {} }] }))
    const onToolExecute = vi.fn(async () => ({ ok: true }))

    renderPalette({ onToolExecute, agent: { provider: 'custom', providerFn, requireApproval: false, maxSteps: 3 } })
    await ask('loop forever')

    await waitFor(() => expect(providerFn).toHaveBeenCalledTimes(3))
    await act(async () => {
      await new Promise((r) => setTimeout(r, 200))
    })
    expect(providerFn).toHaveBeenCalledTimes(3)
    expect(onToolExecute).toHaveBeenCalledTimes(3)
  })

  it('hands a tool error back to the model so it can recover', async () => {
    const prompts: string[] = []
    const providerFn = vi.fn(async (prompt: string): Promise<AgentKPlan> => {
      const turn = prompts.push(prompt)
      if (turn === 1) return { summary: 'Entering', calls: [{ toolName: 'enter_room', parameters: { room: 'blue' } }] }
      if (turn === 2) return { summary: 'Buying first', calls: [{ toolName: 'buy_ticket', parameters: { room: 'blue' } }] }
      return { summary: 'Done — bought a ticket, then entered.', calls: [] }
    })
    const onToolExecute = vi.fn(async (name: string) => {
      if (name === 'enter_room') throw new Error('No ticket for the blue room. buy_ticket("blue") first.')
      return { ticket: 'ok' }
    })

    renderPalette({ onToolExecute, agent: { provider: 'custom', providerFn, requireApproval: false, maxSteps: 5 } })
    await ask('take me to the blue room')

    await waitFor(() => expect(providerFn).toHaveBeenCalledTimes(3))
    expect(prompts[1]).toContain('ERROR: No ticket for the blue room')
    expect(onToolExecute.mock.calls.map((c) => c[0])).toEqual(['enter_room', 'buy_ticket'])
  })
})

describe('autoApproveReadOnly', () => {
  it('lets a read-only plan run but still stops for one that changes state', async () => {
    const providerFn = vi
      .fn<(p: string) => Promise<AgentKPlan>>()
      .mockResolvedValueOnce({ summary: 'Reading', calls: [{ toolName: 'list_rooms', parameters: {} }] })
      .mockResolvedValueOnce({ summary: 'Buying', calls: [{ toolName: 'buy_ticket', parameters: { room: 'blue' } }] })
    const onToolExecute = vi.fn(async () => ({ ok: true }))

    const agent = { provider: 'custom' as const, providerFn, requireApproval: true, autoApproveReadOnly: true }
    renderPalette({ onToolExecute, agent })
    await ask('what rooms are there')

    // read-only: ran without an approval panel
    await waitFor(() => expect(onToolExecute).toHaveBeenCalledWith('list_rooms', {}, expect.anything()))
    expect(screen.queryByText('Approve')).not.toBeInTheDocument()

    cleanup()
    renderPalette({ onToolExecute, agent })
    await ask('buy me a ticket')

    // state-changing: waits for a human
    await waitFor(() => expect(screen.getByText('Approve')).toBeInTheDocument())
    expect(onToolExecute).not.toHaveBeenCalledWith('buy_ticket', expect.anything(), expect.anything())
  })
})

describe('autoApproveReversible', () => {
  it('lets an unannotated write run but still stops for a consequential one', async () => {
    const providerFn = vi
      .fn<(p: string) => Promise<AgentKPlan>>()
      .mockResolvedValueOnce({ summary: 'Entering', calls: [{ toolName: 'enter_room', parameters: { room: 'blue' } }] })
      .mockResolvedValueOnce({ summary: 'Paying', calls: [{ toolName: 'pay', parameters: {} }] })
    const onToolExecute = vi.fn(async () => ({ ok: true }))

    const agent = { provider: 'custom' as const, providerFn, requireApproval: true, autoApproveReversible: true }
    renderPalette({ onToolExecute, agent })
    await ask('take me to the blue room')

    // a write with no consequential hint: the reversible middle, runs freely
    await waitFor(() => expect(onToolExecute).toHaveBeenCalledWith('enter_room', { room: 'blue' }, expect.anything()))
    expect(screen.queryByText('Approve')).not.toBeInTheDocument()

    cleanup()
    renderPalette({ onToolExecute, agent })
    await ask('pay for me')

    // consequential: waits for a human even though reversible writes are waved through
    await waitFor(() => expect(screen.getByText('Approve')).toBeInTheDocument())
    expect(onToolExecute).not.toHaveBeenCalledWith('pay', expect.anything(), expect.anything())
  })

  it('does not let a consequential call ride along on autoApproveReadOnly', async () => {
    const providerFn = vi.fn(async (): Promise<AgentKPlan> => ({
      summary: 'Looking, then paying',
      calls: [
        { toolName: 'list_rooms', parameters: {} },
        { toolName: 'pay', parameters: {} },
      ],
    }))
    const onToolExecute = vi.fn(async () => ({ ok: true }))

    renderPalette({
      onToolExecute,
      agent: { provider: 'custom', providerFn, requireApproval: true, autoApproveReadOnly: true, autoApproveReversible: true },
    })
    await ask('look around and pay')

    await waitFor(() => expect(screen.getByText('Approve')).toBeInTheDocument())
    expect(onToolExecute).not.toHaveBeenCalled()
  })
})

describe('multi-step with a human approval gate (the shape the demo app uses)', () => {
  it('continues to the next turn after the human approves each plan', async () => {
    const prompts: string[] = []
    const providerFn = vi.fn(async (prompt: string): Promise<AgentKPlan> => {
      const turn = prompts.push(prompt)
      if (turn === 1) return { summary: 'Loading the tour', calls: [{ toolName: 'buy_ticket', parameters: { room: 'blue' } }] }
      if (turn === 2) return { summary: 'Entering', calls: [{ toolName: 'enter_room', parameters: { room: 'blue' } }] }
      return { summary: 'Done.', calls: [] }
    })
    const onToolExecute = vi.fn(async () => ({ ok: true }))

    renderPalette({
      onToolExecute,
      agent: { provider: 'custom', providerFn, requireApproval: true, autoApproveReadOnly: true, maxSteps: 8 },
    })
    await ask('take me to the blue room')

    for (let i = 0; i < 2; i++) {
      const approve = await screen.findByText('Approve', {}, { timeout: 2000 }).catch(() => null)
      if (!approve) break
      await act(async () => {
        fireEvent.click(approve)
      })
      await act(async () => {
        await new Promise((r) => setTimeout(r, 60))
      })
    }

    await waitFor(() => expect(providerFn).toHaveBeenCalledTimes(3))
    expect(onToolExecute.mock.calls.map((c) => c[0])).toEqual(['buy_ticket', 'enter_room'])
  })
})

describe('multi-step when the tool surface changes as a result of the call', () => {
  it('keeps running after a tool whose own result rewrites the catalog', async () => {
    const providerFn = vi.fn(async (): Promise<AgentKPlan> => {
      const n = providerFn.mock.calls.length
      if (n === 1) return { summary: 'Loading', calls: [{ toolName: 'buy_ticket', parameters: { room: 'blue' } }] }
      if (n === 2) return { summary: 'Entering', calls: [{ toolName: 'enter_room', parameters: { room: 'blue' } }] }
      return { summary: 'Done.', calls: [] }
    })
    const onToolExecute = vi.fn(async () => ({ ok: true }))

    // A page whose catalog narrows once the ticket is bought — exactly what the
    // museum does (buy_ticket disappears, enter_room appears).
    function App() {
      const [bought, setBought] = React.useState(false)
      const tools = React.useMemo(
        () => (bought ? TOOLS.filter((t) => t.name !== 'buy_ticket') : TOOLS.filter((t) => t.name !== 'enter_room')),
        [bought],
      )
      return (
        <Command
          label="Test"
          tools={tools}
          onToolExecute={async (name: string, p: any) => {
            const r = await onToolExecute()
            if (name === 'buy_ticket') setBought(true)
            return r
          }}
          agent={{ provider: 'custom', providerFn, requireApproval: false, maxSteps: 8 }}
        >
          <Command.Input placeholder="Search..." />
          <Command.List>
            {tools.map((t) => (
              <Command.Tool key={t.name} tool={t} />
            ))}
          </Command.List>
          <Command.AgentHint />
          <Command.Approval />
          <Command.ToolResult />
        </Command>
      )
    }
    render(<App />)
    await ask('take me to the blue room')

    await waitFor(() => expect(providerFn).toHaveBeenCalledTimes(3), { timeout: 3000 })
    expect(onToolExecute).toHaveBeenCalledTimes(2)
  })
})

describe('approval panel parameter display', () => {
  it('labels each parameter and shortens long values instead of running them together', async () => {
    const long = Array.from({ length: 12 }, (_, i) => ({ artwork: `work ${i}` }))
    const providerFn = vi.fn(async (): Promise<AgentKPlan> => ({
      summary: 'Loading',
      calls: [{ toolName: 'buy_ticket', parameters: { room: 'blue', stops: long } }],
    }))
    renderPalette({ onToolExecute: vi.fn(async () => ({ ok: true })), agent: { provider: 'custom', providerFn, requireApproval: true } })
    await ask('do it')

    const call = await screen.findByText('Buy Ticket')
    const row = call.closest('[data-agentk-approval-call]')!
    // name= value, not "Buy Ticketblue[object Object]…"
    expect(row.textContent).toContain('room=')
    expect(row.textContent).toContain('blue')
    expect(row.textContent).toContain('stops=')
    expect(row.textContent).not.toContain('[object Object]')
    const value = row.querySelectorAll('[data-agentk-approval-param-value]')[1]
    expect(value.textContent!.length).toBeLessThanOrEqual(80)
    expect(value.textContent!.endsWith('…')).toBe(true)
  })
})
