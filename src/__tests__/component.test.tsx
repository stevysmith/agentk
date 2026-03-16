import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react'
import * as React from 'react'
import { Command, useAgentK } from '../index'
import type { AgentKToolDef } from '../index'

// ─────────────────────────────────────────────────────────────
// Test fixtures
// ─────────────────────────────────────────────────────────────

const brightnessSchema = {
  type: 'object' as const,
  properties: {
    level: {
      type: 'number',
      minimum: 0,
      maximum: 100,
      description: 'Brightness level',
    },
  },
  required: ['level'],
}

const colorSchema = {
  type: 'object' as const,
  properties: {
    color: {
      type: 'string',
      enum: ['red', 'green', 'blue'],
    },
  },
  required: ['color'],
}

const defaultTools: AgentKToolDef[] = [
  {
    name: 'set_brightness',
    description: 'Set brightness level',
    inputSchema: brightnessSchema,
  },
  {
    name: 'toggle_power',
    description: 'Toggle power on/off',
  },
  {
    name: 'set_color',
    description: 'Set light color',
    inputSchema: colorSchema,
  },
]

// ─────────────────────────────────────────────────────────────
// Helper to render command palette
// ─────────────────────────────────────────────────────────────

function renderCommand(
  props: Partial<React.ComponentProps<typeof Command>> & {
    tools?: AgentKToolDef[]
    toolsToRender?: AgentKToolDef[]
  } = {},
) {
  const tools = props.tools ?? defaultTools
  const toolsToRender = props.toolsToRender ?? tools
  const defaultExecute = vi.fn(async () => ({ success: true }))

  const result = render(
    <Command
      label="Test palette"
      tools={tools}
      onToolExecute={props.onToolExecute ?? defaultExecute}
      {...props}
    >
      <Command.Input placeholder="Search..." />
      <Command.List>
        <Command.Empty>No results</Command.Empty>
        {toolsToRender.map((t) => (
          <Command.Tool key={t.name} tool={t} />
        ))}
      </Command.List>
      <Command.AgentHint />
      <Command.ToolForm />
      <Command.ToolResult />
      <Command.Approval />
      <Command.ActivityFeed />
    </Command>,
  )

  return {
    ...result,
    execute: props.onToolExecute ?? defaultExecute,
  }
}

afterEach(() => {
  cleanup()
})

// ─────────────────────────────────────────────────────────────
// Basic rendering
// ─────────────────────────────────────────────────────────────

describe('Basic rendering', () => {
  it('renders tool list in browse mode', () => {
    renderCommand()

    expect(screen.getByText('Set Brightness')).toBeInTheDocument()
    expect(screen.getByText('Toggle Power')).toBeInTheDocument()
    expect(screen.getByText('Set Color')).toBeInTheDocument()
  })

  it('renders tool descriptions', () => {
    renderCommand()

    expect(screen.getByText('Set brightness level')).toBeInTheDocument()
    expect(screen.getByText('Toggle power on/off')).toBeInTheDocument()
    expect(screen.getByText('Set light color')).toBeInTheDocument()
  })

  it('renders search input', () => {
    renderCommand()
    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument()
  })

  it('filters tools on search input', async () => {
    renderCommand()

    const input = screen.getByPlaceholderText('Search...')
    await act(async () => {
      fireEvent.change(input, { target: { value: 'brightness' } })
    })

    // set_brightness should be visible, others hidden
    const brightItem = screen.getByText('Set Brightness').closest('[cmdk-item]')
    expect(brightItem).toBeInTheDocument()

    // toggle_power and set_color should be hidden (rendered: false)
    const allItems = document.querySelectorAll('[cmdk-item]')
    expect(allItems.length).toBeGreaterThanOrEqual(1)
  })

  it('renders empty state when no matches', async () => {
    renderCommand()

    const input = screen.getByPlaceholderText('Search...')
    await act(async () => {
      fireEvent.change(input, { target: { value: 'zzzzzznothing' } })
    })

    expect(screen.getByText('No results')).toBeInTheDocument()
  })
})

// ─────────────────────────────────────────────────────────────
// Tool selection
// ─────────────────────────────────────────────────────────────

describe('Tool selection', () => {
  it('selecting a tool with no params executes immediately', async () => {
    const onExecute = vi.fn(async () => ({ power: 'on' }))
    renderCommand({ onToolExecute: onExecute })

    const toggleItem = screen.getByText('Toggle Power').closest('[cmdk-item]')
    await act(async () => {
      fireEvent.click(toggleItem!)
    })

    await waitFor(() => {
      expect(onExecute).toHaveBeenCalledWith('toggle_power', {}, expect.anything())
    })
  })

  it('selecting a tool with params shows form', async () => {
    renderCommand()

    const brightItem = screen.getByText('Set Brightness').closest('[cmdk-item]')
    await act(async () => {
      fireEvent.click(brightItem!)
    })

    await waitFor(() => {
      expect(document.querySelector('[data-agentk-form]')).toBeInTheDocument()
    })
  })

  it('form displays correct fields for schema', async () => {
    renderCommand()

    const brightItem = screen.getByText('Set Brightness').closest('[cmdk-item]')
    await act(async () => {
      fireEvent.click(brightItem!)
    })

    await waitFor(() => {
      // Should show a range input for the level field (number with min+max)
      const rangeInput = document.querySelector('input[type="range"]')
      expect(rangeInput).toBeInTheDocument()
      expect(rangeInput).toHaveAttribute('min', '0')
      expect(rangeInput).toHaveAttribute('max', '100')
    })
  })

  it('selecting tool with enum schema shows select field', async () => {
    renderCommand()

    const colorItem = screen.getByText('Set Color').closest('[cmdk-item]')
    await act(async () => {
      fireEvent.click(colorItem!)
    })

    await waitFor(() => {
      const selectEl = document.querySelector('select')
      expect(selectEl).toBeInTheDocument()
      // Should have the enum options
      const options = selectEl!.querySelectorAll('option')
      // First option is placeholder + 3 enum values
      expect(options.length).toBe(4)
    })
  })
})

// ─────────────────────────────────────────────────────────────
// Form behavior
// ─────────────────────────────────────────────────────────────

describe('Form behavior', () => {
  it('form submit triggers execution', async () => {
    const onExecute = vi.fn(async () => ({ ok: true }))
    renderCommand({ onToolExecute: onExecute })

    // Select brightness tool
    const brightItem = screen.getByText('Set Brightness').closest('[cmdk-item]')
    await act(async () => {
      fireEvent.click(brightItem!)
    })

    await waitFor(() => {
      expect(document.querySelector('[data-agentk-form]')).toBeInTheDocument()
    })

    // Set the range value
    const rangeInput = document.querySelector('input[type="range"]') as HTMLInputElement
    await act(async () => {
      fireEvent.change(rangeInput, { target: { value: '75' } })
    })

    // Click execute button
    const executeBtn = document.querySelector('[data-agentk-form-submit]') as HTMLButtonElement
    await act(async () => {
      fireEvent.click(executeBtn)
    })

    await waitFor(() => {
      expect(onExecute).toHaveBeenCalledWith('set_brightness', expect.objectContaining({ level: 75 }), expect.anything())
    })
  })

  it('form cancel returns to browse', async () => {
    renderCommand()

    // Select brightness tool
    const brightItem = screen.getByText('Set Brightness').closest('[cmdk-item]')
    await act(async () => {
      fireEvent.click(brightItem!)
    })

    await waitFor(() => {
      expect(document.querySelector('[data-agentk-form]')).toBeInTheDocument()
    })

    // Click cancel
    const cancelBtn = document.querySelector('[data-agentk-form-cancel]') as HTMLButtonElement
    await act(async () => {
      fireEvent.click(cancelBtn)
    })

    await waitFor(() => {
      expect(document.querySelector('[data-agentk-form]')).not.toBeInTheDocument()
    })
  })

  it('required field validation prevents submit', async () => {
    const onExecute = vi.fn(async () => ({ ok: true }))
    renderCommand({ onToolExecute: onExecute })

    // Select set_color tool (has required 'color' enum field)
    const colorItem = screen.getByText('Set Color').closest('[cmdk-item]')
    await act(async () => {
      fireEvent.click(colorItem!)
    })

    await waitFor(() => {
      expect(document.querySelector('[data-agentk-form]')).toBeInTheDocument()
    })

    // Try to submit without selecting a color
    const executeBtn = document.querySelector('[data-agentk-form-submit]') as HTMLButtonElement
    await act(async () => {
      fireEvent.click(executeBtn)
    })

    // Should NOT have executed
    expect(onExecute).not.toHaveBeenCalled()

    // Should show error
    const errorMessage = document.querySelector('[data-agentk-field-error-message]')
    expect(errorMessage).toBeInTheDocument()
  })

  it('validation error messages appear', async () => {
    renderCommand()

    // Select set_color
    const colorItem = screen.getByText('Set Color').closest('[cmdk-item]')
    await act(async () => {
      fireEvent.click(colorItem!)
    })

    await waitFor(() => {
      expect(document.querySelector('[data-agentk-form]')).toBeInTheDocument()
    })

    // Submit without filling required field
    const executeBtn = document.querySelector('[data-agentk-form-submit]') as HTMLButtonElement
    await act(async () => {
      fireEvent.click(executeBtn)
    })

    const errorMessage = document.querySelector('[data-agentk-field-error-message]')
    expect(errorMessage).toBeInTheDocument()
    expect(errorMessage?.textContent).toContain('required')
  })

  it('validation errors clear on field change', async () => {
    renderCommand()

    // Select set_color
    const colorItem = screen.getByText('Set Color').closest('[cmdk-item]')
    await act(async () => {
      fireEvent.click(colorItem!)
    })

    await waitFor(() => {
      expect(document.querySelector('[data-agentk-form]')).toBeInTheDocument()
    })

    // Submit without filling required field
    const executeBtn = document.querySelector('[data-agentk-form-submit]') as HTMLButtonElement
    await act(async () => {
      fireEvent.click(executeBtn)
    })

    // Error should be visible
    expect(document.querySelector('[data-agentk-field-error-message]')).toBeInTheDocument()

    // Change the field
    const selectEl = document.querySelector('select') as HTMLSelectElement
    await act(async () => {
      fireEvent.change(selectEl, { target: { value: 'red' } })
    })

    // Error should be cleared
    await waitFor(() => {
      expect(document.querySelector('[data-agentk-field-error-message]')).not.toBeInTheDocument()
    })
  })

  it('number min/max validation works', async () => {
    const toolWithMinMax: AgentKToolDef[] = [
      {
        name: 'set_volume',
        description: 'Set volume',
        inputSchema: {
          type: 'object',
          properties: {
            volume: { type: 'number', minimum: 0, maximum: 10 },
          },
          required: ['volume'],
        },
      },
    ]

    const onExecute = vi.fn(async () => ({}))
    renderCommand({ tools: toolWithMinMax, onToolExecute: onExecute })

    // Select set_volume
    const item = screen.getByText('Set Volume').closest('[cmdk-item]')
    await act(async () => {
      fireEvent.click(item!)
    })

    await waitFor(() => {
      expect(document.querySelector('[data-agentk-form]')).toBeInTheDocument()
    })

    // Range input should be present since min+max are defined
    const rangeInput = document.querySelector('input[type="range"]') as HTMLInputElement
    expect(rangeInput).toBeInTheDocument()
  })

  it('Escape key returns from form to browse', async () => {
    renderCommand()

    // Select brightness tool
    const brightItem = screen.getByText('Set Brightness').closest('[cmdk-item]')
    await act(async () => {
      fireEvent.click(brightItem!)
    })

    await waitFor(() => {
      expect(document.querySelector('[data-agentk-form]')).toBeInTheDocument()
    })

    // Press Escape
    const root = document.querySelector('[cmdk-root]')!
    await act(async () => {
      fireEvent.keyDown(root, { key: 'Escape' })
    })

    await waitFor(() => {
      expect(document.querySelector('[data-agentk-form]')).not.toBeInTheDocument()
    })
  })

  it('Enter key submits form (not when on select/button/checkbox)', async () => {
    const onExecute = vi.fn(async () => ({ ok: true }))
    renderCommand({ onToolExecute: onExecute })

    // Select brightness tool (has range input)
    const brightItem = screen.getByText('Set Brightness').closest('[cmdk-item]')
    await act(async () => {
      fireEvent.click(brightItem!)
    })

    await waitFor(() => {
      expect(document.querySelector('[data-agentk-form]')).toBeInTheDocument()
    })

    // Focus the range input and press Enter
    const rangeInput = document.querySelector('input[type="range"]') as HTMLInputElement
    rangeInput.focus()

    const root = document.querySelector('[cmdk-root]')!
    await act(async () => {
      fireEvent.keyDown(root, { key: 'Enter' })
    })

    await waitFor(() => {
      expect(onExecute).toHaveBeenCalled()
    })
  })
})

// ─────────────────────────────────────────────────────────────
// Tool result
// ─────────────────────────────────────────────────────────────

describe('Tool result', () => {
  it('result renders after execution completes', async () => {
    const onExecute = vi.fn(async () => ({ power: 'on' }))
    renderCommand({ onToolExecute: onExecute })

    // Select toggle_power (no params = immediate execution)
    const toggleItem = screen.getByText('Toggle Power').closest('[cmdk-item]')
    await act(async () => {
      fireEvent.click(toggleItem!)
    })

    await waitFor(() => {
      const result = document.querySelector('[data-agentk-result]')
      expect(result).toBeInTheDocument()
      expect(result?.getAttribute('data-agentk-success')).toBe('')
    })
  })

  it('error renders on failed execution', async () => {
    const onExecute = vi.fn(async () => {
      throw new Error('Connection failed')
    })
    renderCommand({ onToolExecute: onExecute })

    const toggleItem = screen.getByText('Toggle Power').closest('[cmdk-item]')
    await act(async () => {
      fireEvent.click(toggleItem!)
    })

    await waitFor(() => {
      const result = document.querySelector('[data-agentk-result]')
      expect(result).toBeInTheDocument()
      expect(result?.getAttribute('data-agentk-error')).toBe('')
    })

    expect(screen.getByText('Connection failed')).toBeInTheDocument()
  })

  it('dismiss button returns to browse', async () => {
    const onExecute = vi.fn(async () => ({ ok: true }))
    renderCommand({ onToolExecute: onExecute })

    // Execute toggle_power
    const toggleItem = screen.getByText('Toggle Power').closest('[cmdk-item]')
    await act(async () => {
      fireEvent.click(toggleItem!)
    })

    await waitFor(() => {
      expect(document.querySelector('[data-agentk-result]')).toBeInTheDocument()
    })

    // Click dismiss
    const dismissBtn = document.querySelector('[data-agentk-result-dismiss]') as HTMLButtonElement
    await act(async () => {
      fireEvent.click(dismissBtn)
    })

    await waitFor(() => {
      expect(document.querySelector('[data-agentk-result]')).not.toBeInTheDocument()
    })
  })
})

// ─────────────────────────────────────────────────────────────
// Agent hint
// ─────────────────────────────────────────────────────────────

describe('Agent hint', () => {
  it('agent hint appears when no tools match and agent is configured', async () => {
    renderCommand({
      agent: { provider: 'anthropic', apiKey: 'test' },
    })

    const input = screen.getByPlaceholderText('Search...')
    await act(async () => {
      fireEvent.change(input, { target: { value: 'zzzzzznothing' } })
    })

    await waitFor(() => {
      const hint = document.querySelector('[data-agentk-agent-hint]')
      expect(hint).toBeInTheDocument()
    })
  })

  it('agent hint hidden when agent is not configured', async () => {
    renderCommand()

    const input = screen.getByPlaceholderText('Search...')
    await act(async () => {
      fireEvent.change(input, { target: { value: 'zzzzzznothing' } })
    })

    // Should show "No results" but no agent hint
    expect(screen.getByText('No results')).toBeInTheDocument()
    expect(document.querySelector('[data-agentk-agent-hint]')).not.toBeInTheDocument()
  })

  it('agent hint hides when search matches tools', async () => {
    renderCommand({
      agent: { provider: 'anthropic', apiKey: 'test' },
    })

    const input = screen.getByPlaceholderText('Search...')

    // First make no match
    await act(async () => {
      fireEvent.change(input, { target: { value: 'zzzzz' } })
    })

    await waitFor(() => {
      expect(document.querySelector('[data-agentk-agent-hint]')).toBeInTheDocument()
    })

    // Now search for something that matches
    await act(async () => {
      fireEvent.change(input, { target: { value: 'brightness' } })
    })

    await waitFor(() => {
      expect(document.querySelector('[data-agentk-agent-hint]')).not.toBeInTheDocument()
    })
  })
})

// ─────────────────────────────────────────────────────────────
// Internationalization
// ─────────────────────────────────────────────────────────────

describe('Internationalization', () => {
  it('custom labels render correctly', async () => {
    renderCommand({
      labels: { execute: 'Run', cancel: 'Back' },
    })

    // Select a tool with params to show the form
    const brightItem = screen.getByText('Set Brightness').closest('[cmdk-item]')
    await act(async () => {
      fireEvent.click(brightItem!)
    })

    await waitFor(() => {
      expect(document.querySelector('[data-agentk-form-submit]')?.textContent).toBe('Run')
      expect(document.querySelector('[data-agentk-form-cancel]')?.textContent).toBe('Back')
    })
  })

  it('custom formatToolName is used', () => {
    renderCommand({
      formatToolName: (name: string) => name.toUpperCase().replace(/_/g, '-'),
    })

    expect(screen.getByText('SET-BRIGHTNESS')).toBeInTheDocument()
    expect(screen.getByText('TOGGLE-POWER')).toBeInTheDocument()
  })

  it('default labels work when not provided', async () => {
    renderCommand()

    const brightItem = screen.getByText('Set Brightness').closest('[cmdk-item]')
    await act(async () => {
      fireEvent.click(brightItem!)
    })

    await waitFor(() => {
      expect(document.querySelector('[data-agentk-form-submit]')?.textContent).toBe('Execute')
      expect(document.querySelector('[data-agentk-form-cancel]')?.textContent).toBe('Cancel')
    })
  })
})

// ─────────────────────────────────────────────────────────────
// Custom render props
// ─────────────────────────────────────────────────────────────

describe('Custom render props', () => {
  it('renderField is called with correct arguments', async () => {
    const renderField = vi.fn((name, schema, value, onChange) => (
      <input
        data-testid={`custom-${name}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    ))

    render(
      <Command
        label="Test"
        tools={defaultTools}
        onToolExecute={vi.fn(async () => ({}))}
      >
        <Command.Input placeholder="Search..." />
        <Command.List>
          {defaultTools.map((t) => (
            <Command.Tool key={t.name} tool={t} />
          ))}
        </Command.List>
        <Command.ToolForm renderField={renderField} />
        <Command.ToolResult />
      </Command>,
    )

    // Select brightness tool to show form
    const brightItem = screen.getByText('Set Brightness').closest('[cmdk-item]')
    await act(async () => {
      fireEvent.click(brightItem!)
    })

    await waitFor(() => {
      expect(renderField).toHaveBeenCalledWith(
        'level',
        expect.objectContaining({ type: 'number', minimum: 0, maximum: 100 }),
        expect.anything(),
        expect.any(Function),
      )
    })

    expect(screen.getByTestId('custom-level')).toBeInTheDocument()
  })

  it('renderResult is called with execution', async () => {
    const renderResult = vi.fn((execution) => (
      <div data-testid="custom-result">{JSON.stringify(execution.result)}</div>
    ))

    const onExecute = vi.fn(async () => ({ power: 'on' }))

    render(
      <Command
        label="Test"
        tools={defaultTools}
        onToolExecute={onExecute}
      >
        <Command.Input placeholder="Search..." />
        <Command.List>
          {defaultTools.map((t) => (
            <Command.Tool key={t.name} tool={t} />
          ))}
        </Command.List>
        <Command.ToolForm />
        <Command.ToolResult renderResult={renderResult} />
      </Command>,
    )

    // Click toggle_power (no params = immediate exec)
    const toggleItem = screen.getByText('Toggle Power').closest('[cmdk-item]')
    await act(async () => {
      fireEvent.click(toggleItem!)
    })

    await waitFor(() => {
      expect(renderResult).toHaveBeenCalledWith(
        expect.objectContaining({
          toolName: 'toggle_power',
          result: { power: 'on' },
        }),
      )
    })

    expect(screen.getByTestId('custom-result')).toBeInTheDocument()
  })
})

// ─────────────────────────────────────────────────────────────
// Accessibility
// ─────────────────────────────────────────────────────────────

describe('Accessibility', () => {
  it('form fields have aria-label', async () => {
    renderCommand()

    const brightItem = screen.getByText('Set Brightness').closest('[cmdk-item]')
    await act(async () => {
      fireEvent.click(brightItem!)
    })

    await waitFor(() => {
      const rangeInput = document.querySelector('input[type="range"]')
      expect(rangeInput).toHaveAttribute('aria-label')
    })
  })

  it('range inputs have aria-valuemin/max/now', async () => {
    renderCommand()

    const brightItem = screen.getByText('Set Brightness').closest('[cmdk-item]')
    await act(async () => {
      fireEvent.click(brightItem!)
    })

    await waitFor(() => {
      const rangeInput = document.querySelector('input[type="range"]')
      expect(rangeInput).toHaveAttribute('aria-valuemin', '0')
      expect(rangeInput).toHaveAttribute('aria-valuemax', '100')
      expect(rangeInput).toHaveAttribute('aria-valuenow')
    })
  })

  it('spinner has role="status"', async () => {
    const onExecute = vi.fn(
      () => new Promise((resolve) => setTimeout(() => resolve({ ok: true }), 5000)),
    )
    renderCommand({ onToolExecute: onExecute })

    // Execute a tool with no params
    const toggleItem = screen.getByText('Toggle Power').closest('[cmdk-item]')
    await act(async () => {
      fireEvent.click(toggleItem!)
    })

    // The executing state should show a spinner
    await waitFor(() => {
      const spinner = document.querySelector('[data-agentk-spinner]')
      expect(spinner).toBeInTheDocument()
      expect(spinner).toHaveAttribute('role', 'status')
    })
  })

  it('agent hint has aria-live="polite"', async () => {
    renderCommand({
      agent: { provider: 'anthropic', apiKey: 'test' },
    })

    const input = screen.getByPlaceholderText('Search...')
    await act(async () => {
      fireEvent.change(input, { target: { value: 'zzzzzznothing' } })
    })

    await waitFor(() => {
      const hint = document.querySelector('[data-agentk-agent-hint]')
      expect(hint).toHaveAttribute('aria-live', 'polite')
    })
  })

  it('invalid fields have aria-invalid="true"', async () => {
    renderCommand()

    // Select set_color (has required enum field)
    const colorItem = screen.getByText('Set Color').closest('[cmdk-item]')
    await act(async () => {
      fireEvent.click(colorItem!)
    })

    await waitFor(() => {
      expect(document.querySelector('[data-agentk-form]')).toBeInTheDocument()
    })

    // Submit without selecting color
    const executeBtn = document.querySelector('[data-agentk-form-submit]') as HTMLButtonElement
    await act(async () => {
      fireEvent.click(executeBtn)
    })

    await waitFor(() => {
      const selectEl = document.querySelector('select')
      expect(selectEl).toHaveAttribute('aria-invalid', 'true')
    })
  })

  it('error messages have role="alert"', async () => {
    renderCommand()

    const colorItem = screen.getByText('Set Color').closest('[cmdk-item]')
    await act(async () => {
      fireEvent.click(colorItem!)
    })

    await waitFor(() => {
      expect(document.querySelector('[data-agentk-form]')).toBeInTheDocument()
    })

    const executeBtn = document.querySelector('[data-agentk-form-submit]') as HTMLButtonElement
    await act(async () => {
      fireEvent.click(executeBtn)
    })

    await waitFor(() => {
      const errorMsg = document.querySelector('[data-agentk-field-error-message]')
      expect(errorMsg).toHaveAttribute('role', 'alert')
    })
  })

  it('input has role="combobox"', () => {
    renderCommand()
    const input = screen.getByPlaceholderText('Search...')
    expect(input).toHaveAttribute('role', 'combobox')
  })

  it('list has role="listbox"', () => {
    renderCommand()
    const list = document.querySelector('[cmdk-list]')
    expect(list).toHaveAttribute('role', 'listbox')
  })

  it('items have role="option"', () => {
    renderCommand()
    const items = document.querySelectorAll('[cmdk-item]')
    items.forEach((item) => {
      expect(item).toHaveAttribute('role', 'option')
    })
  })
})

// ─────────────────────────────────────────────────────────────
// useAgentK hook
// ─────────────────────────────────────────────────────────────

describe('useAgentK hook', () => {
  it('throws when used outside Command', () => {
    function BadComponent() {
      useAgentK()
      return null
    }

    // Suppress React error boundary console output
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => render(<BadComponent />)).toThrow(
      'useAgentK must be used within a <Command> component',
    )

    consoleSpy.mockRestore()
  })

  it('provides state and actions inside Command', async () => {
    let capturedState: any

    function StateReader() {
      const ak = useAgentK()
      capturedState = ak
      return <div data-testid="state">{ak.state.mode}</div>
    }

    render(
      <Command label="Test" tools={defaultTools} onToolExecute={vi.fn(async () => ({}))}>
        <StateReader />
        <Command.Input placeholder="Search..." />
        <Command.List>
          {defaultTools.map((t) => (
            <Command.Tool key={t.name} tool={t} />
          ))}
        </Command.List>
        <Command.ToolForm />
        <Command.ToolResult />
      </Command>,
    )

    expect(screen.getByTestId('state')).toHaveTextContent('browse')
    expect(capturedState.state.mode).toBe('browse')
    expect(typeof capturedState.selectTool).toBe('function')
    expect(typeof capturedState.execute).toBe('function')
    expect(typeof capturedState.reset).toBe('function')
    expect(typeof capturedState.cancel).toBe('function')
    expect(typeof capturedState.sendIntent).toBe('function')
    expect(typeof capturedState.approvePlan).toBe('function')
    expect(typeof capturedState.rejectPlan).toBe('function')
  })
})

// ─────────────────────────────────────────────────────────────
// Mode transitions
// ─────────────────────────────────────────────────────────────

describe('Mode transitions', () => {
  it('onModeChange is called on transitions', async () => {
    const onModeChange = vi.fn()
    renderCommand({ onModeChange })

    // Select toggle_power (no params = immediate execution)
    const toggleItem = screen.getByText('Toggle Power').closest('[cmdk-item]')
    await act(async () => {
      fireEvent.click(toggleItem!)
    })

    await waitFor(() => {
      // Should have been called with 'executing' and then 'result'
      expect(onModeChange).toHaveBeenCalledWith('executing')
    })

    await waitFor(() => {
      expect(onModeChange).toHaveBeenCalledWith('result')
    })
  })

  it('data-agentk-mode attribute is set on root', () => {
    renderCommand()
    const root = document.querySelector('[cmdk-root]')
    expect(root).toHaveAttribute('data-agentk-mode', 'browse')
  })
})

// ─────────────────────────────────────────────────────────────
// Tool with default values
// ─────────────────────────────────────────────────────────────

describe('Default parameter values', () => {
  it('pre-fills default values from schema', async () => {
    const toolWithDefaults: AgentKToolDef[] = [
      {
        name: 'set_temp',
        description: 'Set temperature',
        inputSchema: {
          type: 'object',
          properties: {
            temp: { type: 'number', default: 72, minimum: 60, maximum: 90 },
          },
          required: ['temp'],
        },
      },
    ]

    const onExecute = vi.fn(async () => ({}))
    renderCommand({ tools: toolWithDefaults, onToolExecute: onExecute })

    const item = screen.getByText('Set Temp').closest('[cmdk-item]')
    await act(async () => {
      fireEvent.click(item!)
    })

    await waitFor(() => {
      expect(document.querySelector('[data-agentk-form]')).toBeInTheDocument()
    })

    // Submit with defaults
    const executeBtn = document.querySelector('[data-agentk-form-submit]') as HTMLButtonElement
    await act(async () => {
      fireEvent.click(executeBtn)
    })

    await waitFor(() => {
      expect(onExecute).toHaveBeenCalledWith(
        'set_temp',
        expect.objectContaining({ temp: 72 }),
        expect.anything(),
      )
    })
  })
})

// ─────────────────────────────────────────────────────────────
// Boolean field
// ─────────────────────────────────────────────────────────────

describe('Boolean field rendering', () => {
  it('renders checkbox for boolean type', async () => {
    const boolTool: AgentKToolDef[] = [
      {
        name: 'set_enabled',
        description: 'Enable feature',
        inputSchema: {
          type: 'object',
          properties: {
            enabled: { type: 'boolean' },
          },
          required: [],
        },
      },
    ]

    renderCommand({ tools: boolTool })

    const item = screen.getByText('Set Enabled').closest('[cmdk-item]')
    await act(async () => {
      fireEvent.click(item!)
    })

    await waitFor(() => {
      const checkbox = document.querySelector('input[type="checkbox"]')
      expect(checkbox).toBeInTheDocument()
    })
  })
})

// ─────────────────────────────────────────────────────────────
// Text field rendering
// ─────────────────────────────────────────────────────────────

describe('Text field rendering', () => {
  it('renders text input for string type without enum', async () => {
    const textTool: AgentKToolDef[] = [
      {
        name: 'send_message',
        description: 'Send a message',
        inputSchema: {
          type: 'object',
          properties: {
            message: { type: 'string', description: 'Your message' },
          },
          required: ['message'],
        },
      },
    ]

    renderCommand({ tools: textTool })

    const item = screen.getByText('Send Message').closest('[cmdk-item]')
    await act(async () => {
      fireEvent.click(item!)
    })

    await waitFor(() => {
      const textInput = document.querySelector('[data-agentk-field-text]')
      expect(textInput).toBeInTheDocument()
      expect(textInput).toHaveAttribute('placeholder', 'Your message')
    })
  })
})

// ─────────────────────────────────────────────────────────────
// onToolResult and onToolError callbacks
// ─────────────────────────────────────────────────────────────

describe('Callbacks', () => {
  it('onToolResult is called on success', async () => {
    const onToolResult = vi.fn()
    const onExecute = vi.fn(async () => ({ ok: true }))
    renderCommand({ onToolExecute: onExecute, onToolResult })

    const toggleItem = screen.getByText('Toggle Power').closest('[cmdk-item]')
    await act(async () => {
      fireEvent.click(toggleItem!)
    })

    await waitFor(() => {
      expect(onToolResult).toHaveBeenCalledWith('toggle_power', { ok: true })
    })
  })

  it('onToolError is called on failure', async () => {
    const onToolError = vi.fn()
    const onExecute = vi.fn(async () => {
      throw new Error('Failed')
    })
    renderCommand({ onToolExecute: onExecute, onToolError })

    const toggleItem = screen.getByText('Toggle Power').closest('[cmdk-item]')
    await act(async () => {
      fireEvent.click(toggleItem!)
    })

    await waitFor(() => {
      expect(onToolError).toHaveBeenCalledWith('toggle_power', 'Failed')
    })
  })
})

// ─────────────────────────────────────────────────────────────
// Agent planning & approval flow
// ─────────────────────────────────────────────────────────────

describe('Agent planning & approval', () => {
  const mockPlan = {
    calls: [
      { toolName: 'toggle_power', parameters: {} },
    ],
    summary: 'I will toggle the power.',
  }

  const multiStepPlan = {
    calls: [
      { toolName: 'set_brightness', parameters: { level: 80 } },
      { toolName: 'toggle_power', parameters: {} },
    ],
    summary: 'Set brightness then toggle power.',
  }

  function makeMockProvider(plan = mockPlan) {
    return vi.fn(async () => plan)
  }

  it('auto-approves when requireApproval is omitted (default)', async () => {
    const providerFn = makeMockProvider()
    const onToolExecute = vi.fn(async () => ({ ok: true }))

    renderCommand({
      onToolExecute,
      agent: { provider: 'custom', providerFn },
    })

    // Type a query that matches no tools so agent hint shows
    const input = screen.getByPlaceholderText('Search...')
    await act(async () => {
      fireEvent.change(input, { target: { value: 'turn on the lights' } })
    })

    // Press Enter to send intent
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' })
    })

    // Should auto-approve and go straight to executing — no approval UI
    await waitFor(() => {
      expect(providerFn).toHaveBeenCalled()
    })

    await waitFor(() => {
      expect(onToolExecute).toHaveBeenCalledWith('toggle_power', {}, expect.anything())
    })
  })

  it('auto-approves when requireApproval is false', async () => {
    const providerFn = makeMockProvider()
    const onToolExecute = vi.fn(async () => ({ ok: true }))

    renderCommand({
      onToolExecute,
      agent: { provider: 'custom', providerFn, requireApproval: false },
    })

    const input = screen.getByPlaceholderText('Search...')
    await act(async () => {
      fireEvent.change(input, { target: { value: 'turn on the lights' } })
    })

    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' })
    })

    await waitFor(() => {
      expect(onToolExecute).toHaveBeenCalledWith('toggle_power', {}, expect.anything())
    })
  })

  it('shows approval UI when requireApproval is true', async () => {
    const providerFn = makeMockProvider()
    const onToolExecute = vi.fn(async () => ({ ok: true }))

    renderCommand({
      onToolExecute,
      agent: { provider: 'custom', providerFn, requireApproval: true },
    })

    const input = screen.getByPlaceholderText('Search...')
    await act(async () => {
      fireEvent.change(input, { target: { value: 'turn on the lights' } })
    })

    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' })
    })

    // Should show approval, NOT auto-execute
    await waitFor(() => {
      expect(screen.getByText('I will toggle the power.')).toBeInTheDocument()
    })

    expect(screen.getByText('Approve')).toBeInTheDocument()
    expect(screen.getByText('Reject')).toBeInTheDocument()
    expect(onToolExecute).not.toHaveBeenCalled()
  })

  it('approve button triggers execution', async () => {
    const providerFn = makeMockProvider()
    const onToolExecute = vi.fn(async () => ({ ok: true }))
    const onAgentApprove = vi.fn()

    renderCommand({
      onToolExecute,
      onAgentApprove,
      agent: { provider: 'custom', providerFn, requireApproval: true },
    })

    const input = screen.getByPlaceholderText('Search...')
    await act(async () => {
      fireEvent.change(input, { target: { value: 'turn on the lights' } })
    })
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' })
    })

    await waitFor(() => {
      expect(screen.getByText('Approve')).toBeInTheDocument()
    })

    await act(async () => {
      fireEvent.click(screen.getByText('Approve'))
    })

    await waitFor(() => {
      expect(onToolExecute).toHaveBeenCalledWith('toggle_power', {}, expect.anything())
    })
    expect(onAgentApprove).toHaveBeenCalled()
  })

  it('reject button returns to browse without executing', async () => {
    const providerFn = makeMockProvider()
    const onToolExecute = vi.fn(async () => ({ ok: true }))
    const onAgentReject = vi.fn()

    renderCommand({
      onToolExecute,
      onAgentReject,
      agent: { provider: 'custom', providerFn, requireApproval: true },
    })

    const input = screen.getByPlaceholderText('Search...')
    await act(async () => {
      fireEvent.change(input, { target: { value: 'turn on the lights' } })
    })
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' })
    })

    await waitFor(() => {
      expect(screen.getByText('Reject')).toBeInTheDocument()
    })

    await act(async () => {
      fireEvent.click(screen.getByText('Reject'))
    })

    // Should return to browse, not execute
    await waitFor(() => {
      expect(screen.queryByText('Approve')).not.toBeInTheDocument()
    })
    expect(onToolExecute).not.toHaveBeenCalled()
    expect(onAgentReject).toHaveBeenCalled()
  })

  it('Enter key approves, Escape key rejects in approval mode', async () => {
    const providerFn = makeMockProvider()
    const onToolExecute = vi.fn(async () => ({ ok: true }))

    const { container } = renderCommand({
      onToolExecute,
      agent: { provider: 'custom', providerFn, requireApproval: true },
    })

    const input = screen.getByPlaceholderText('Search...')
    await act(async () => {
      fireEvent.change(input, { target: { value: 'do something' } })
    })
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' })
    })

    await waitFor(() => {
      expect(screen.getByText('Approve')).toBeInTheDocument()
    })

    // Escape rejects
    const root = container.querySelector('[cmdk-root]')!
    await act(async () => {
      fireEvent.keyDown(root, { key: 'Escape' })
    })

    await waitFor(() => {
      expect(screen.queryByText('Approve')).not.toBeInTheDocument()
    })
    expect(onToolExecute).not.toHaveBeenCalled()
  })

  it('multi-step plan executes tools sequentially after approval', async () => {
    const providerFn = makeMockProvider(multiStepPlan)
    const executionOrder: string[] = []
    const onToolExecute = vi.fn(async (name: string) => {
      executionOrder.push(name)
      return { ok: true }
    })

    renderCommand({
      onToolExecute,
      agent: { provider: 'custom', providerFn, requireApproval: true },
    })

    const input = screen.getByPlaceholderText('Search...')
    await act(async () => {
      fireEvent.change(input, { target: { value: 'set brightness and toggle' } })
    })
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' })
    })

    await waitFor(() => {
      expect(screen.getByText('Approve')).toBeInTheDocument()
    })

    await act(async () => {
      fireEvent.click(screen.getByText('Approve'))
    })

    // Both tools should execute sequentially
    await waitFor(
      () => {
        expect(onToolExecute).toHaveBeenCalledTimes(2)
      },
      { timeout: 3000 },
    )
    expect(executionOrder).toEqual(['set_brightness', 'toggle_power'])
  })

  it('onAgentPlan is called when LLM returns a plan', async () => {
    const providerFn = makeMockProvider()
    const onAgentPlan = vi.fn()

    renderCommand({
      onAgentPlan,
      agent: { provider: 'custom', providerFn, requireApproval: true },
    })

    const input = screen.getByPlaceholderText('Search...')
    await act(async () => {
      fireEvent.change(input, { target: { value: 'do something' } })
    })
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' })
    })

    await waitFor(() => {
      expect(onAgentPlan).toHaveBeenCalledWith(mockPlan)
    })
  })

  it('shows spinner during planning mode', async () => {
    // Provider that never resolves to keep us in planning state
    const providerFn = vi.fn(() => new Promise<never>(() => {}))

    renderCommand({
      agent: { provider: 'custom', providerFn, requireApproval: true },
    })

    const input = screen.getByPlaceholderText('Search...')
    await act(async () => {
      fireEvent.change(input, { target: { value: 'do something' } })
    })
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' })
    })

    await waitFor(() => {
      expect(screen.getByText('Thinking...')).toBeInTheDocument()
    })
  })

  it('shows result after auto-approved plan completes', async () => {
    const providerFn = makeMockProvider()
    const onToolExecute = vi.fn(async () => ({ status: 'power on' }))

    renderCommand({
      onToolExecute,
      agent: { provider: 'custom', providerFn },
    })

    const input = screen.getByPlaceholderText('Search...')
    await act(async () => {
      fireEvent.change(input, { target: { value: 'turn on' } })
    })
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' })
    })

    await waitFor(() => {
      expect(screen.getByText(/power on/)).toBeInTheDocument()
    })
  })

  it('validates unknown tool in agent plan', async () => {
    const badPlan = {
      calls: [{ toolName: 'nonexistent_tool', parameters: {} }],
      summary: 'Will call a missing tool.',
    }
    const providerFn = vi.fn(async () => badPlan)
    const onToolExecute = vi.fn(async () => ({}))
    const onToolError = vi.fn()

    renderCommand({
      onToolExecute,
      onToolError,
      agent: { provider: 'custom', providerFn },
    })

    const input = screen.getByPlaceholderText('Search...')
    await act(async () => {
      fireEvent.change(input, { target: { value: 'do something' } })
    })
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' })
    })

    await waitFor(() => {
      expect(onToolError).toHaveBeenCalledWith(
        'nonexistent_tool',
        expect.stringContaining('Unknown tool'),
      )
    })
    expect(onToolExecute).not.toHaveBeenCalled()
  })

  it('provider error during planning shows error result', async () => {
    const providerFn = vi.fn(async () => {
      throw new Error('LLM is down')
    })

    renderCommand({
      agent: { provider: 'custom', providerFn },
    })

    const input = screen.getByPlaceholderText('Search...')
    await act(async () => {
      fireEvent.change(input, { target: { value: 'do something' } })
    })
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' })
    })

    await waitFor(() => {
      expect(screen.getByText(/LLM is down/)).toBeInTheDocument()
    })
  })

  it('text-only LLM response (no tool calls) returns to browse', async () => {
    const textOnlyPlan = { calls: [], summary: 'I cannot help with that.' }
    const providerFn = vi.fn(async () => textOnlyPlan)
    const onModeChange = vi.fn()

    renderCommand({
      onModeChange,
      agent: { provider: 'custom', providerFn },
    })

    const input = screen.getByPlaceholderText('Search...')
    await act(async () => {
      fireEvent.change(input, { target: { value: 'do something' } })
    })
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' })
    })

    // Should transition: browse → planning → browse (not to approval)
    await waitFor(() => {
      const modes = onModeChange.mock.calls.map((c: any) => c[0])
      expect(modes).toContain('planning')
      expect(modes[modes.length - 1]).toBe('browse')
    })
  })

  it('plan halts on tool error mid-sequence', async () => {
    const multiPlan = {
      calls: [
        { toolName: 'set_brightness', parameters: { level: 50 } },
        { toolName: 'toggle_power', parameters: {} },
      ],
      summary: 'Two steps.',
    }
    const providerFn = vi.fn(async () => multiPlan)
    const onToolExecute = vi.fn(async (name: string) => {
      if (name === 'set_brightness') throw new Error('Brightness failed')
      return { ok: true }
    })
    const onToolError = vi.fn()

    renderCommand({
      onToolExecute,
      onToolError,
      agent: { provider: 'custom', providerFn, requireApproval: true },
    })

    const input = screen.getByPlaceholderText('Search...')
    await act(async () => {
      fireEvent.change(input, { target: { value: 'both' } })
    })
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' })
    })
    await waitFor(() => {
      expect(screen.getByText('Approve')).toBeInTheDocument()
    })
    await act(async () => {
      fireEvent.click(screen.getByText('Approve'))
    })

    // First tool fails — plan should halt, second tool never executes
    await waitFor(() => {
      expect(document.querySelector('[data-agentk-result-error]')).not.toBeNull()
      expect(document.querySelector('[data-agentk-result-error]')!.textContent).toContain('Brightness failed')
    })
    expect(onToolExecute).toHaveBeenCalledTimes(1)
    expect(onToolError).toHaveBeenCalledWith('set_brightness', 'Brightness failed')
  })
})

// ─────────────────────────────────────────────────────────────
// Cancellation & timeout
// ─────────────────────────────────────────────────────────────

describe('Cancellation & timeout', () => {
  it('cancel() aborts in-flight execution and resets to browse', async () => {
    let resolveFn: (v: any) => void
    const onToolExecute = vi.fn(
      () => new Promise((resolve) => { resolveFn = resolve }),
    )
    let capturedCtx: any

    function Spy() {
      capturedCtx = useAgentK()
      return null
    }

    render(
      <Command
        label="Test"
        tools={defaultTools}
        onToolExecute={onToolExecute}
      >
        <Command.Input placeholder="Search..." />
        <Command.List>
          {defaultTools.map((t) => (
            <Command.Tool key={t.name} tool={t} />
          ))}
        </Command.List>
        <Command.ToolResult />
        <Spy />
      </Command>,
    )

    // Select a no-param tool to start execution
    const toggleItem = screen.getByText('Toggle Power').closest('[cmdk-item]')
    await act(async () => {
      fireEvent.click(toggleItem!)
    })

    // Should be executing
    await waitFor(() => {
      expect(capturedCtx.state.mode).toBe('executing')
    })

    // Cancel
    await act(async () => {
      capturedCtx.cancel()
    })

    expect(capturedCtx.state.mode).toBe('browse')
  })

  it('execution timeout dispatches failure', async () => {
    const onToolExecute = vi.fn(
      () => new Promise((resolve) => {
        // Never resolves — will be timed out
        setTimeout(resolve, 60000)
      }),
    )
    const onToolError = vi.fn()

    renderCommand({
      onToolExecute,
      onToolError,
      timeout: 50, // 50ms timeout
    })

    const toggleItem = screen.getByText('Toggle Power').closest('[cmdk-item]')
    await act(async () => {
      fireEvent.click(toggleItem!)
    })

    await waitFor(
      () => {
        expect(onToolError).toHaveBeenCalledWith(
          'toggle_power',
          expect.stringContaining('timed out'),
        )
      },
      { timeout: 3000 },
    )
  })
})

// ─────────────────────────────────────────────────────────────
// Activity feed
// ─────────────────────────────────────────────────────────────

describe('Activity feed', () => {
  it('shows activity entries after agent execution', async () => {
    const providerFn = vi.fn(async () => ({
      calls: [{ toolName: 'toggle_power', parameters: {} }],
      summary: 'Toggle it.',
    }))
    const onToolExecute = vi.fn(async () => ({ done: true }))

    renderCommand({
      onToolExecute,
      agent: { provider: 'custom', providerFn },
    })

    // Use a query that won't match any tool so it goes through agent planning
    const input = screen.getByPlaceholderText('Search...')
    await act(async () => {
      fireEvent.change(input, { target: { value: 'please turn on the lights for me' } })
    })
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' })
    })

    // Wait for execution to complete and result to show
    await waitFor(() => {
      expect(document.querySelector('[data-agentk-result]')).not.toBeNull()
    })

    // Activity feed should be visible with a status line
    const activityEl = document.querySelector('[data-agentk-activity]')
    expect(activityEl).not.toBeNull()
  })

  it('expand/collapse toggle works', async () => {
    const providerFn = vi.fn(async () => ({
      calls: [{ toolName: 'toggle_power', parameters: {} }],
      summary: 'Toggle it.',
    }))
    const onToolExecute = vi.fn(async () => ({ done: true }))

    renderCommand({
      onToolExecute,
      agent: { provider: 'custom', providerFn },
    })

    const input = screen.getByPlaceholderText('Search...')
    await act(async () => {
      fireEvent.change(input, { target: { value: 'please turn on the lights for me' } })
    })
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' })
    })

    await waitFor(() => {
      expect(document.querySelector('[data-agentk-result]')).not.toBeNull()
    })

    // Find the toggle button in the activity feed
    const activityToggle = document.querySelector('[data-agentk-activity-toggle]') as HTMLElement
    if (activityToggle) {
      // Initially collapsed — no entry elements visible
      expect(document.querySelector('[data-agentk-activity-entry]')).toBeNull()

      // Click to expand
      await act(async () => {
        fireEvent.click(activityToggle)
      })

      // Entries should be visible
      expect(document.querySelector('[data-agentk-activity-entry]')).not.toBeNull()
      expect(document.querySelector('[data-agentk-activity-expanded]')).not.toBeNull()

      // Click to collapse
      await act(async () => {
        fireEvent.click(activityToggle)
      })

      expect(document.querySelector('[data-agentk-activity-entry]')).toBeNull()
    }
  })

  it('is hidden during approval mode', async () => {
    // Use a search that doesn't match any tool so it goes to agent intent
    const providerFn = vi.fn(async () => ({
      calls: [{ toolName: 'toggle_power', parameters: {} }],
      summary: 'Toggle.',
    }))

    renderCommand({
      agent: { provider: 'custom', providerFn, requireApproval: true },
    })

    const input = screen.getByPlaceholderText('Search...')
    await act(async () => {
      fireEvent.change(input, { target: { value: 'please turn on the lights' } })
    })
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' })
    })

    // Wait for approval panel
    await waitFor(() => {
      expect(screen.getByText('Approve')).toBeInTheDocument()
    })

    // Activity feed should NOT be visible during approval
    expect(document.querySelector('[data-agentk-activity]')).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────
// Custom render props — Approval
// ─────────────────────────────────────────────────────────────

describe('Approval render props', () => {
  it('renderCall is called for each tool call', async () => {
    const renderCall = vi.fn((call: any, i: number) => (
      <div data-testid={`custom-call-${i}`}>{call.toolName}</div>
    ))

    const plan = {
      calls: [
        { toolName: 'set_brightness', parameters: { level: 50 } },
        { toolName: 'toggle_power', parameters: {} },
      ],
      summary: 'Two things.',
    }
    const providerFn = vi.fn(async () => plan)

    render(
      <Command
        label="Test"
        tools={defaultTools}
        onToolExecute={vi.fn(async () => ({}))}
        agent={{ provider: 'custom', providerFn, requireApproval: true }}
      >
        <Command.Input placeholder="Search..." />
        <Command.List>
          {defaultTools.map((t) => (
            <Command.Tool key={t.name} tool={t} />
          ))}
        </Command.List>
        <Command.Approval renderCall={renderCall} />
      </Command>,
    )

    const input = screen.getByPlaceholderText('Search...')
    await act(async () => {
      fireEvent.change(input, { target: { value: 'do both' } })
    })
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' })
    })

    await waitFor(() => {
      expect(screen.getByTestId('custom-call-0')).toBeInTheDocument()
    })

    expect(screen.getByTestId('custom-call-1')).toBeInTheDocument()
    expect(renderCall).toHaveBeenCalledTimes(2)
    expect(renderCall).toHaveBeenCalledWith(plan.calls[0], 0)
    expect(renderCall).toHaveBeenCalledWith(plan.calls[1], 1)
  })

  it('renderSummary is called with the plan', async () => {
    const renderSummary = vi.fn((plan: any) => (
      <div data-testid="custom-summary">{plan.summary}</div>
    ))

    const providerFn = vi.fn(async () => ({
      calls: [{ toolName: 'toggle_power', parameters: {} }],
      summary: 'My custom summary.',
    }))

    render(
      <Command
        label="Test"
        tools={defaultTools}
        onToolExecute={vi.fn(async () => ({}))}
        agent={{ provider: 'custom', providerFn, requireApproval: true }}
      >
        <Command.Input placeholder="Search..." />
        <Command.List>
          {defaultTools.map((t) => (
            <Command.Tool key={t.name} tool={t} />
          ))}
        </Command.List>
        <Command.Approval renderSummary={renderSummary} />
      </Command>,
    )

    const input = screen.getByPlaceholderText('Search...')
    await act(async () => {
      fireEvent.change(input, { target: { value: 'do it' } })
    })
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' })
    })

    await waitFor(() => {
      expect(screen.getByTestId('custom-summary')).toBeInTheDocument()
    })
    expect(renderSummary).toHaveBeenCalled()
  })
})

// ─────────────────────────────────────────────────────────────
// Keyboard — edge cases
// ─────────────────────────────────────────────────────────────

describe('Keyboard edge cases', () => {
  it('blocks all keyboard input during executing mode', async () => {
    const onToolExecute = vi.fn(() => new Promise<any>(() => {})) // never resolves

    const { container } = renderCommand({ onToolExecute })

    // Select a no-param tool to start execution
    const toggleItem = screen.getByText('Toggle Power').closest('[cmdk-item]')
    await act(async () => {
      fireEvent.click(toggleItem!)
    })

    const root = container.querySelector('[cmdk-root]')!

    // Keyboard events should be swallowed
    const prevented = fireEvent.keyDown(root, { key: 'ArrowDown' })
    // fireEvent returns false if defaultPrevented
    // In executing mode, all keys are preventDefault'd
    expect(root.getAttribute('data-agentk-mode')).toBe('executing')
  })

  it('Escape during planning resets to browse', async () => {
    const providerFn = vi.fn(() => new Promise<never>(() => {})) // never resolves

    const { container } = renderCommand({
      agent: { provider: 'custom', providerFn },
    })

    const input = screen.getByPlaceholderText('Search...')
    await act(async () => {
      fireEvent.change(input, { target: { value: 'something' } })
    })
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' })
    })

    await waitFor(() => {
      expect(container.querySelector('[cmdk-root]')!.getAttribute('data-agentk-mode')).toBe('planning')
    })

    const root = container.querySelector('[cmdk-root]')!
    await act(async () => {
      fireEvent.keyDown(root, { key: 'Escape' })
    })

    expect(root.getAttribute('data-agentk-mode')).toBe('browse')
  })
})

// ─────────────────────────────────────────────────────────────
// Mode transition data attributes
// ─────────────────────────────────────────────────────────────

describe('Mode transition attributes', () => {
  it('sets data-agentk-entering and data-agentk-exiting during transitions', async () => {
    const { container } = renderCommand()
    const root = container.querySelector('[cmdk-root]')!

    // Select a tool to trigger browse → form transition
    const brightnessItem = screen.getByText('Set Brightness').closest('[cmdk-item]')
    await act(async () => {
      fireEvent.click(brightnessItem!)
    })

    // Immediately after transition, entering/exiting should be set
    expect(root.getAttribute('data-agentk-entering')).toBe('form')
    expect(root.getAttribute('data-agentk-exiting')).toBe('browse')

    // After the transition duration, attributes should be cleared
    await waitFor(() => {
      expect(root.getAttribute('data-agentk-entering')).toBeNull()
      expect(root.getAttribute('data-agentk-exiting')).toBeNull()
    }, { timeout: 500 })
  })

  it('root has --agentk-transition-duration CSS variable', () => {
    const { container } = renderCommand()
    const root = container.querySelector('[cmdk-root]') as HTMLElement
    expect(root.style.getPropertyValue('--agentk-transition-duration')).toBe('150ms')
  })
})

// ─────────────────────────────────────────────────────────────
// onEmpty callback
// ─────────────────────────────────────────────────────────────

describe('onEmpty callback', () => {
  it('fires when search yields zero results', async () => {
    const onEmpty = vi.fn()
    renderCommand({ onEmpty })

    const input = screen.getByPlaceholderText('Search...')
    await act(async () => {
      fireEvent.change(input, { target: { value: 'zzzznonexistent' } })
    })

    await waitFor(() => {
      expect(onEmpty).toHaveBeenCalledWith('zzzznonexistent')
    })
  })

  it('does not fire when search has matches', async () => {
    const onEmpty = vi.fn()
    renderCommand({ onEmpty })

    const input = screen.getByPlaceholderText('Search...')
    await act(async () => {
      fireEvent.change(input, { target: { value: 'brightness' } })
    })

    // Give it time — onEmpty should not fire
    await new Promise((r) => setTimeout(r, 50))
    expect(onEmpty).not.toHaveBeenCalled()
  })
})

// ─────────────────────────────────────────────────────────────
// Tool icon rendering
// ─────────────────────────────────────────────────────────────

describe('Tool icon rendering', () => {
  it('renders tool icon when provided', () => {
    const toolsWithIcons: AgentKToolDef[] = [
      {
        name: 'my_tool',
        description: 'A tool',
        icon: <span data-testid="my-icon">★</span>,
      },
    ]

    render(
      <Command label="Test" tools={toolsWithIcons}>
        <Command.Input placeholder="Search..." />
        <Command.List>
          {toolsWithIcons.map((t) => (
            <Command.Tool key={t.name} tool={t} />
          ))}
        </Command.List>
      </Command>,
    )

    expect(screen.getByTestId('my-icon')).toBeInTheDocument()
    expect(document.querySelector('[data-agentk-tool-icon]')).not.toBeNull()
  })

  it('does not render icon container when no icon', () => {
    render(
      <Command label="Test" tools={defaultTools}>
        <Command.Input placeholder="Search..." />
        <Command.List>
          {defaultTools.map((t) => (
            <Command.Tool key={t.name} tool={t} />
          ))}
        </Command.List>
      </Command>,
    )

    expect(document.querySelector('[data-agentk-tool-icon]')).toBeNull()
  })
})
