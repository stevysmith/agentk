'use client'

// ============================================================
// agentk — a command palette for the agentic web
// forked from cmdk by Paco Coursey
//
// Extends cmdk with WebMCP tool discovery, parameter forms,
// execution lifecycle, and natural language intent matching.
// ============================================================

import * as RadixDialog from '@radix-ui/react-dialog'
import * as React from 'react'
import { commandScore } from './command-score'
import { Primitive } from '@radix-ui/react-primitive'
import { useId } from '@radix-ui/react-id'
import { composeRefs } from '@radix-ui/react-compose-refs'
import { resolveProvider, type AgentKAgentConfig, type AgentKPlan, type AgentKToolCall } from './providers'

// WebMCP type augmentation
declare global {
  interface Navigator {
    modelContext?: {
      registerTool: (tool: any) => void
      unregisterTool: (name: string) => void
    }
    modelContextTesting?: {
      listTools: () => any[]
      executeTool: (name: string, params: string) => Promise<any>
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Types — original cmdk
// ─────────────────────────────────────────────────────────────

type Children = { children?: React.ReactNode }
type DivProps = React.ComponentPropsWithoutRef<typeof Primitive.div>

type LoadingProps = Children &
  DivProps & {
    progress?: number
    label?: string
  }

type EmptyProps = Children & DivProps & {}
type SeparatorProps = DivProps & {
  alwaysRender?: boolean
}
type DialogProps = RadixDialog.DialogProps &
  CommandProps & {
    overlayClassName?: string
    contentClassName?: string
    container?: HTMLElement
  }
type ListProps = Children &
  DivProps & {
    label?: string
  }
type ItemProps = Children &
  Omit<DivProps, 'disabled' | 'onSelect' | 'value'> & {
    disabled?: boolean
    onSelect?: (value: string) => void
    value?: string
    keywords?: string[]
    forceMount?: boolean
  }
type GroupProps = Children &
  Omit<DivProps, 'heading' | 'value'> & {
    heading?: React.ReactNode
    value?: string
    forceMount?: boolean
  }
type InputProps = Omit<React.ComponentPropsWithoutRef<typeof Primitive.input>, 'value' | 'onChange' | 'type'> & {
  value?: string
  onValueChange?: (search: string) => void
}
type CommandFilter = (value: string, search: string, keywords?: string[]) => number

// ─────────────────────────────────────────────────────────────
// Types — AgentK extensions
// ─────────────────────────────────────────────────────────────

export type AgentKMode = 'browse' | 'form' | 'executing' | 'result' | 'planning' | 'approval'

export type ToolInputSchema = {
  type: 'object'
  properties: Record<
    string,
    {
      type: string
      description?: string
      enum?: string[]
      minimum?: number
      maximum?: number
      default?: any
    }
  >
  required?: string[]
}

export type AgentKToolDef = {
  name: string
  /** Human-readable label. Falls back to humanized `name` if omitted. */
  label?: string
  description?: string
  inputSchema?: ToolInputSchema
  icon?: React.ReactNode
  keywords?: string[]
}

/** Converts snake_case/camelCase tool names to human-readable labels */
function humanizeToolName(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export type ToolExecution = {
  toolName: string
  parameters: Record<string, any>
  result?: any
  error?: string
  startedAt: number
}

export type ActivityEntry = {
  id: string
  timestamp: number
  type: 'intent' | 'plan' | 'tool_start' | 'tool_complete' | 'tool_error'
  toolName?: string
  parameters?: Record<string, any>
  result?: any
  error?: string
  message: string
}

type AgentKInternalState = {
  mode: AgentKMode
  activeTool: AgentKToolDef | null
  parameters: Record<string, any>
  execution: ToolExecution | null
  // Agent mode
  pendingPrompt: string | null
  plan: AgentKPlan | null
  planIndex: number
  activityLog: ActivityEntry[]
}

type AgentKContextValue = {
  state: AgentKInternalState
  setMode: (mode: AgentKMode) => void
  selectTool: (tool: AgentKToolDef) => void
  setParameter: (name: string, value: any) => void
  execute: () => void
  reset: () => void
  webmcpAvailable: boolean
  // Agent mode
  agentAvailable: boolean
  sendIntent: (prompt: string) => void
  approvePlan: () => void
  rejectPlan: () => void
  modifyPlanCall: (index: number, params: Record<string, any>) => void
  activityLog: ActivityEntry[]
  tools: AgentKToolDef[]
  /** True when no tools match the current search but the agent can interpret it */
  agentHintVisible: boolean
}

type ToolItemProps = Children &
  Omit<DivProps, 'disabled' | 'onSelect' | 'value'> & {
    disabled?: boolean
    onSelect?: (value: string) => void
    value?: string
    keywords?: string[]
    forceMount?: boolean
    /** The WebMCP tool definition */
    tool: AgentKToolDef
    /** Called after tool execution completes */
    onExecuted?: (result: any) => void
  }

type ToolFormProps = Children &
  DivProps & {
    /** Custom field renderer */
    renderField?: (
      name: string,
      schema: ToolInputSchema['properties'][string],
      value: any,
      onChange: (value: any) => void,
    ) => React.ReactNode
  }

type ToolResultProps = Children &
  DivProps & {
    /** Custom result renderer */
    renderResult?: (execution: ToolExecution) => React.ReactNode
  }

type CommandProps = Children &
  DivProps & {
    label?: string
    shouldFilter?: boolean
    filter?: CommandFilter
    defaultValue?: string
    value?: string
    onValueChange?: (value: string) => void
    loop?: boolean
    disablePointerSelection?: boolean
    vimBindings?: boolean
    onEmpty?: (search: string) => void
    // AgentK extensions
    /** Tool definitions to register in the palette */
    tools?: AgentKToolDef[]
    /** Execute a tool. If omitted, uses WebMCP navigator.modelContextTesting.executeTool */
    onToolExecute?: (toolName: string, parameters: Record<string, any>) => Promise<any>
    /** Called when a tool execution completes */
    onToolResult?: (toolName: string, result: any) => void
    /** Called when a tool execution fails */
    onToolError?: (toolName: string, error: string) => void
    /** Called when mode changes */
    onModeChange?: (mode: AgentKMode) => void
    /** LLM agent config. If omitted, agent mode is disabled. */
    agent?: AgentKAgentConfig
    /** Called when the LLM returns a plan */
    onAgentPlan?: (plan: AgentKPlan) => void
    /** Called when user approves a plan */
    onAgentApprove?: (plan: AgentKPlan) => void
    /** Called when user rejects a plan */
    onAgentReject?: (plan: AgentKPlan) => void
  }

// ─────────────────────────────────────────────────────────────
// Internal types
// ─────────────────────────────────────────────────────────────

type Context = {
  value: (id: string, value: string, keywords?: string[]) => void
  item: (id: string, groupId: string) => () => void
  group: (id: string) => () => void
  filter: () => boolean
  label: string
  getDisablePointerSelection: () => boolean
  listId: string
  labelId: string
  inputId: string
  listInnerRef: React.RefObject<HTMLDivElement | null>
}
type State = {
  search: string
  value: string
  selectedItemId?: string
  filtered: { count: number; items: Map<string, number>; groups: Set<string> }
}
type Store = {
  subscribe: (callback: () => void) => () => void
  snapshot: () => State
  setState: <K extends keyof State>(key: K, value: State[K], opts?: any) => void
  emit: () => void
}
type Group = {
  id: string
  forceMount?: boolean
}

// ─────────────────────────────────────────────────────────────
// Constants & selectors
// ─────────────────────────────────────────────────────────────

const GROUP_SELECTOR = `[cmdk-group=""]`
const GROUP_ITEMS_SELECTOR = `[cmdk-group-items=""]`
const GROUP_HEADING_SELECTOR = `[cmdk-group-heading=""]`
const ITEM_SELECTOR = `[cmdk-item=""]`
const VALID_ITEM_SELECTOR = `${ITEM_SELECTOR}:not([aria-disabled="true"])`
const SELECT_EVENT = `cmdk-item-select`
const VALUE_ATTR = `data-value`
const defaultFilter: CommandFilter = (value, search, keywords) => commandScore(value, search, keywords)

// ─────────────────────────────────────────────────────────────
// Contexts
// ─────────────────────────────────────────────────────────────

const CommandContext = React.createContext<Context>(undefined as any)
const useCommand = () => React.useContext(CommandContext)
const StoreContext = React.createContext<Store>(undefined as any)
const useStore = () => React.useContext(StoreContext)
const GroupContext = React.createContext<Group>(undefined as any)
const AgentKContext = React.createContext<AgentKContextValue | null>(null)

// ─────────────────────────────────────────────────────────────
// AgentK state machine
// ─────────────────────────────────────────────────────────────

type AgentKAction =
  | { type: 'SELECT_TOOL'; tool: AgentKToolDef }
  | { type: 'SET_MODE'; mode: AgentKMode }
  | { type: 'SET_PARAMETER'; name: string; value: any }
  | { type: 'START_EXECUTION'; toolName: string; parameters: Record<string, any> }
  | { type: 'COMPLETE_EXECUTION'; result: any }
  | { type: 'FAIL_EXECUTION'; error: string }
  | { type: 'RESET' }
  // Agent mode actions
  | { type: 'START_PLANNING'; prompt: string }
  | { type: 'SET_PLAN'; plan: AgentKPlan }
  | { type: 'APPROVE_PLAN' }
  | { type: 'REJECT_PLAN' }
  | { type: 'MODIFY_PLAN_CALL'; index: number; parameters: Record<string, any> }
  | { type: 'ADVANCE_PLAN' }
  | { type: 'LOG_ACTIVITY'; entry: Omit<ActivityEntry, 'id' | 'timestamp'> }

let activityId = 0

const initialAgentKState: AgentKInternalState = {
  mode: 'browse',
  activeTool: null,
  parameters: {},
  execution: null,
  pendingPrompt: null,
  plan: null,
  planIndex: 0,
  activityLog: [],
}

function agentKReducer(state: AgentKInternalState, action: AgentKAction): AgentKInternalState {
  switch (action.type) {
    case 'SELECT_TOOL': {
      const tool = action.tool
      const hasParams = tool.inputSchema && Object.keys(tool.inputSchema.properties || {}).length > 0
      // Pre-fill defaults from schema
      const defaults: Record<string, any> = {}
      if (tool.inputSchema?.properties) {
        for (const [key, prop] of Object.entries(tool.inputSchema.properties)) {
          if (prop.default !== undefined) defaults[key] = prop.default
        }
      }
      return {
        ...state,
        activeTool: tool,
        parameters: defaults,
        mode: hasParams ? 'form' : 'executing',
        execution: hasParams
          ? null
          : { toolName: tool.name, parameters: defaults, startedAt: Date.now() },
      }
    }
    case 'SET_MODE':
      return { ...state, mode: action.mode }
    case 'SET_PARAMETER':
      return { ...state, parameters: { ...state.parameters, [action.name]: action.value } }
    case 'START_EXECUTION':
      return {
        ...state,
        mode: 'executing',
        execution: {
          toolName: action.toolName,
          parameters: action.parameters,
          startedAt: Date.now(),
        },
      }
    case 'COMPLETE_EXECUTION':
      return {
        ...state,
        mode: 'result',
        execution: state.execution ? { ...state.execution, result: action.result } : null,
      }
    case 'FAIL_EXECUTION':
      return {
        ...state,
        mode: 'result',
        execution: state.execution ? { ...state.execution, error: action.error } : null,
      }
    case 'RESET':
      return { ...initialAgentKState, activityLog: state.activityLog }
    // ── Agent mode ──
    case 'START_PLANNING': {
      const entry: ActivityEntry = {
        id: `act-${++activityId}`,
        timestamp: Date.now(),
        type: 'intent',
        message: action.prompt,
      }
      return {
        ...state,
        mode: 'planning' as AgentKMode,
        pendingPrompt: action.prompt,
        plan: null,
        planIndex: 0,
        activityLog: [...state.activityLog, entry],
      }
    }
    case 'SET_PLAN': {
      const entry: ActivityEntry = {
        id: `act-${++activityId}`,
        timestamp: Date.now(),
        type: 'plan',
        message: action.plan.summary || `Plan: ${action.plan.calls.length} tool call(s)`,
      }
      return {
        ...state,
        mode: 'approval' as AgentKMode,
        plan: action.plan,
        planIndex: 0,
        activityLog: [...state.activityLog, entry],
      }
    }
    case 'APPROVE_PLAN': {
      if (!state.plan || state.plan.calls.length === 0) return { ...state, mode: 'browse' as AgentKMode }
      const call = state.plan.calls[0]
      const entry: ActivityEntry = {
        id: `act-${++activityId}`,
        timestamp: Date.now(),
        type: 'tool_start',
        toolName: call.toolName,
        parameters: call.parameters,
        message: `Executing ${call.toolName}`,
      }
      return {
        ...state,
        mode: 'executing' as AgentKMode,
        execution: {
          toolName: call.toolName,
          parameters: call.parameters,
          startedAt: Date.now(),
        },
        activityLog: [...state.activityLog, entry],
      }
    }
    case 'REJECT_PLAN': {
      return {
        ...state,
        mode: 'browse' as AgentKMode,
        plan: null,
        planIndex: 0,
        pendingPrompt: null,
      }
    }
    case 'MODIFY_PLAN_CALL': {
      if (!state.plan) return state
      const newCalls = [...state.plan.calls]
      newCalls[action.index] = { ...newCalls[action.index], parameters: action.parameters }
      return { ...state, plan: { ...state.plan, calls: newCalls } }
    }
    case 'ADVANCE_PLAN': {
      if (!state.plan) return { ...state, mode: 'result' as AgentKMode }
      const nextIndex = state.planIndex + 1
      if (nextIndex >= state.plan.calls.length) {
        // All calls done
        return { ...state, mode: 'result' as AgentKMode, planIndex: nextIndex }
      }
      // Execute next call in the plan
      const nextCall = state.plan.calls[nextIndex]
      const entry: ActivityEntry = {
        id: `act-${++activityId}`,
        timestamp: Date.now(),
        type: 'tool_start',
        toolName: nextCall.toolName,
        parameters: nextCall.parameters,
        message: `Executing ${nextCall.toolName}`,
      }
      return {
        ...state,
        mode: 'executing' as AgentKMode,
        planIndex: nextIndex,
        execution: {
          toolName: nextCall.toolName,
          parameters: nextCall.parameters,
          startedAt: Date.now(),
        },
        activityLog: [...state.activityLog, entry],
      }
    }
    case 'LOG_ACTIVITY': {
      const entry: ActivityEntry = {
        ...action.entry,
        id: `act-${++activityId}`,
        timestamp: Date.now(),
      }
      return { ...state, activityLog: [...state.activityLog, entry] }
    }
    default:
      return state
  }
}

// ─────────────────────────────────────────────────────────────
// Command root — extended with AgentK mode handling
// ─────────────────────────────────────────────────────────────

const Command = React.forwardRef<HTMLDivElement, CommandProps>((props, forwardedRef) => {
  const state = useLazyRef<State>(() => ({
    search: '',
    value: props.value ?? props.defaultValue ?? '',
    selectedItemId: undefined,
    filtered: {
      count: 0,
      items: new Map(),
      groups: new Set(),
    },
  }))
  const allItems = useLazyRef<Set<string>>(() => new Set())
  const allGroups = useLazyRef<Map<string, Set<string>>>(() => new Map())
  const ids = useLazyRef<Map<string, { value: string; keywords?: string[] }>>(() => new Map())
  const listeners = useLazyRef<Set<() => void>>(() => new Set())
  const propsRef = useAsRef(props)
  const {
    label,
    children,
    value,
    onValueChange,
    filter,
    shouldFilter,
    loop,
    disablePointerSelection = false,
    vimBindings = true,
    onEmpty,
    // AgentK props
    tools,
    onToolExecute,
    onToolResult,
    onToolError,
    onModeChange,
    // Agent mode props
    agent,
    onAgentPlan,
    onAgentApprove,
    onAgentReject,
    ...etc
  } = props

  const listId = useId()
  const labelId = useId()
  const inputId = useId()

  const listInnerRef = React.useRef<HTMLDivElement>(null)

  const schedule = useScheduleLayoutEffect()

  // AgentK state
  const [akState, akDispatch] = React.useReducer(agentKReducer, initialAgentKState)
  const akStateRef = React.useRef(akState)
  akStateRef.current = akState

  // Track when agent hint should show (no matches + has search + has agent + browse mode)
  const [agentHintVisible, setAgentHintVisible] = React.useState(false)

  // Notify mode changes
  React.useEffect(() => {
    onModeChange?.(akState.mode)
  }, [akState.mode])

  // Dedup guard: prevent double execution in React strict mode
  const lastExecutedAt = React.useRef<number>(0)

  // Execute tool when entering 'executing' mode
  React.useEffect(() => {
    if (akState.mode === 'executing' && akState.execution) {
      const { toolName, parameters, startedAt } = akState.execution
      if (startedAt <= lastExecutedAt.current) return
      lastExecutedAt.current = startedAt
      const isPlanExecution = akState.plan !== null
      const doExecute = async () => {
        try {
          let result: any
          if (onToolExecute) {
            result = await onToolExecute(toolName, parameters)
          } else if (typeof navigator !== 'undefined' && navigator.modelContextTesting) {
            result = await navigator.modelContextTesting.executeTool(toolName, JSON.stringify(parameters))
          } else {
            throw new Error('No executor available. Provide onToolExecute or enable WebMCP.')
          }
          // Log completion
          if (isPlanExecution) {
            akDispatch({
              type: 'LOG_ACTIVITY',
              entry: { type: 'tool_complete', toolName, result, message: `${toolName} completed` },
            })
            akDispatch({ type: 'ADVANCE_PLAN' })
          } else {
            akDispatch({ type: 'COMPLETE_EXECUTION', result })
          }
          onToolResult?.(toolName, result)
        } catch (err: any) {
          const errorMsg = err?.message || String(err)
          if (isPlanExecution) {
            akDispatch({
              type: 'LOG_ACTIVITY',
              entry: { type: 'tool_error', toolName, error: errorMsg, message: `${toolName} failed: ${errorMsg}` },
            })
            // Stop plan on error, show result
            akDispatch({ type: 'FAIL_EXECUTION', error: errorMsg })
          } else {
            akDispatch({ type: 'FAIL_EXECUTION', error: errorMsg })
          }
          onToolError?.(toolName, errorMsg)
        }
      }
      doExecute()
    }
  }, [akState.mode, akState.execution?.startedAt])

  // Planning effect — call LLM when entering 'planning' mode
  const lastPlanningAt = React.useRef<number>(0)

  React.useEffect(() => {
    if (akState.mode !== 'planning' || !akState.pendingPrompt || !agent) return

    const timestamp = Date.now()
    if (timestamp - lastPlanningAt.current < 100) return
    lastPlanningAt.current = timestamp

    const doPlanning = async () => {
      try {
        const provider = resolveProvider(agent)
        // Collect all available tools: prop-based + WebMCP-discovered
        const allTools = tools || []
        const plan = await provider(akState.pendingPrompt!, allTools, agent)

        if (plan.calls.length === 0) {
          // LLM responded with text only, no tool calls — return to browse
          akDispatch({
            type: 'LOG_ACTIVITY',
            entry: { type: 'plan', message: plan.summary || 'No actions needed' },
          })
          akDispatch({ type: 'SET_MODE', mode: 'browse' })
          return
        }

        akDispatch({ type: 'SET_PLAN', plan })
        onAgentPlan?.(plan)

        // Auto-execute if approval not required
        if (agent.requireApproval === false) {
          akDispatch({ type: 'APPROVE_PLAN' })
          onAgentApprove?.(plan)
        }
      } catch (err: any) {
        const errorMsg = err?.message || String(err)
        akDispatch({
          type: 'LOG_ACTIVITY',
          entry: { type: 'tool_error', error: errorMsg, message: `Agent error: ${errorMsg}` },
        })
        akDispatch({ type: 'FAIL_EXECUTION', error: errorMsg })
      }
    }
    doPlanning()
  }, [akState.mode, akState.pendingPrompt])

  // Check WebMCP availability
  const webmcpAvailable = React.useMemo(() => {
    return typeof navigator !== 'undefined' && !!navigator.modelContext
  }, [])

  const agentKContext: AgentKContextValue = React.useMemo(
    () => ({
      state: akState,
      setMode: (mode: AgentKMode) => akDispatch({ type: 'SET_MODE', mode }),
      selectTool: (tool: AgentKToolDef) => akDispatch({ type: 'SELECT_TOOL', tool }),
      setParameter: (name: string, value: any) => akDispatch({ type: 'SET_PARAMETER', name, value }),
      execute: () => {
        const { activeTool, parameters } = akStateRef.current
        if (!activeTool) return
        akDispatch({ type: 'START_EXECUTION', toolName: activeTool.name, parameters })
      },
      reset: () => akDispatch({ type: 'RESET' }),
      webmcpAvailable,
      // Agent mode
      agentAvailable: !!agent,
      sendIntent: (prompt: string) => akDispatch({ type: 'START_PLANNING', prompt }),
      approvePlan: () => {
        const plan = akStateRef.current.plan
        if (plan) {
          akDispatch({ type: 'APPROVE_PLAN' })
          onAgentApprove?.(plan)
        }
      },
      rejectPlan: () => {
        const plan = akStateRef.current.plan
        if (plan) onAgentReject?.(plan)
        akDispatch({ type: 'REJECT_PLAN' })
      },
      modifyPlanCall: (index: number, params: Record<string, any>) =>
        akDispatch({ type: 'MODIFY_PLAN_CALL', index, parameters: params }),
      activityLog: akState.activityLog,
      tools: tools || [],
      agentHintVisible,
    }),
    [akState, webmcpAvailable, agent, tools, agentHintVisible],
  )

  /** Controlled mode `value` handling. */
  useLayoutEffect(() => {
    if (value !== undefined) {
      const v = value.trim()
      state.current.value = v
      store.emit()
    }
  }, [value])

  useLayoutEffect(() => {
    schedule(6, scrollSelectedIntoView)
  }, [])

  const store: Store = React.useMemo(() => {
    return {
      subscribe: (cb) => {
        listeners.current.add(cb)
        return () => listeners.current.delete(cb)
      },
      snapshot: () => {
        return state.current
      },
      setState: (key, value, opts) => {
        if (Object.is(state.current[key], value)) return
        state.current[key] = value

        if (key === 'search') {
          filterItems()
          sort()
          schedule(1, selectFirstItem)

          const search = value as string
          const isEmpty = state.current.filtered.count === 0 && search.trim().length > 0
          if (isEmpty) {
            propsRef.current.onEmpty?.(search)
          }
          // Update agent hint visibility
          setAgentHintVisible(isEmpty && !!propsRef.current.agent)
        } else if (key === 'value') {
          if (
            document.activeElement?.hasAttribute('cmdk-input') ||
            document.activeElement?.hasAttribute('cmdk-root')
          ) {
            const input = document.getElementById(inputId)
            if (input) input.focus()
            else document.getElementById(listId)?.focus()
          }

          schedule(7, () => {
            state.current.selectedItemId = getSelectedItem()?.id
            store.emit()
          })

          if (!opts) {
            schedule(5, scrollSelectedIntoView)
          }
          if (propsRef.current?.value !== undefined) {
            const newValue = (value ?? '') as string
            propsRef.current.onValueChange?.(newValue)
            return
          }
        }

        store.emit()
      },
      emit: () => {
        listeners.current.forEach((l) => l())
      },
    }
  }, [])

  const context: Context = React.useMemo(
    () => ({
      value: (id, value, keywords) => {
        if (value !== ids.current.get(id)?.value) {
          ids.current.set(id, { value, keywords })
          state.current.filtered.items.set(id, score(value, keywords))
          schedule(2, () => {
            sort()
            store.emit()
          })
        }
      },
      item: (id, groupId) => {
        allItems.current.add(id)

        if (groupId) {
          if (!allGroups.current.has(groupId)) {
            allGroups.current.set(groupId, new Set([id]))
          } else {
            allGroups.current.get(groupId)!.add(id)
          }
        }

        schedule(3, () => {
          filterItems()
          sort()

          if (!state.current.value) {
            selectFirstItem()
          }

          store.emit()
        })

        return () => {
          ids.current.delete(id)
          allItems.current.delete(id)
          state.current.filtered.items.delete(id)
          const selectedItem = getSelectedItem()

          schedule(4, () => {
            filterItems()

            if (selectedItem?.getAttribute('id') === id) selectFirstItem()

            store.emit()
          })
        }
      },
      group: (id) => {
        if (!allGroups.current.has(id)) {
          allGroups.current.set(id, new Set())
        }

        return () => {
          ids.current.delete(id)
          allGroups.current.delete(id)
        }
      },
      filter: () => {
        return propsRef.current.shouldFilter as any
      },
      label: label || props['aria-label'] || '',
      getDisablePointerSelection: () => {
        return propsRef.current.disablePointerSelection ?? false
      },
      listId,
      inputId,
      labelId,
      listInnerRef,
    }),
    [],
  )

  function score(value: string, keywords?: string[]) {
    const filter = propsRef.current?.filter ?? defaultFilter
    return value ? filter(value, state.current.search, keywords) : 0
  }

  function sort() {
    if (!state.current.search || propsRef.current.shouldFilter === false) {
      return
    }

    const scores = state.current.filtered.items

    const groups: [string, number][] = []
    state.current.filtered.groups.forEach((value) => {
      const items = allGroups.current.get(value)
      let max = 0
      items?.forEach((item) => {
        const score = scores.get(item)
        max = Math.max(score ?? 0, max)
      })
      groups.push([value, max])
    })

    const listInsertionElement = listInnerRef.current

    getValidItems()
      .sort((a, b) => {
        const valueA = a.getAttribute('id')
        const valueB = b.getAttribute('id')
        return (scores.get(valueB!) ?? 0) - (scores.get(valueA!) ?? 0)
      })
      .forEach((item) => {
        const group = item.closest(GROUP_ITEMS_SELECTOR)

        if (group) {
          group.appendChild(item.parentElement === group ? item : item.closest(`${GROUP_ITEMS_SELECTOR} > *`)!)
        } else {
          listInsertionElement?.appendChild(
            item.parentElement === listInsertionElement ? item : item.closest(`${GROUP_ITEMS_SELECTOR} > *`)!,
          )
        }
      })

    groups
      .sort((a, b) => b[1] - a[1])
      .forEach((group) => {
        const element = listInnerRef.current?.querySelector(
          `${GROUP_SELECTOR}[${VALUE_ATTR}="${encodeURIComponent(group[0])}"]`,
        )
        element?.parentElement?.appendChild(element)
      })
  }

  function selectFirstItem() {
    const item = getValidItems().find((item) => item.getAttribute('aria-disabled') !== 'true')
    const value = item?.getAttribute(VALUE_ATTR)
    store.setState('value', value || undefined as any)
  }

  function filterItems() {
    if (!state.current.search || propsRef.current.shouldFilter === false) {
      state.current.filtered.count = allItems.current.size
      return
    }

    state.current.filtered.groups = new Set()
    let itemCount = 0

    for (const id of allItems.current) {
      const value = ids.current.get(id)?.value ?? ''
      const keywords = ids.current.get(id)?.keywords ?? []
      const rank = score(value, keywords)
      state.current.filtered.items.set(id, rank)
      if (rank > 0) itemCount++
    }

    for (const [groupId, group] of allGroups.current) {
      for (const itemId of group) {
        if ((state.current.filtered.items.get(itemId) ?? 0) > 0) {
          state.current.filtered.groups.add(groupId)
          break
        }
      }
    }

    state.current.filtered.count = itemCount
  }

  function scrollSelectedIntoView() {
    const item = getSelectedItem()

    if (item) {
      if (item.parentElement?.firstChild === item) {
        item.closest(GROUP_SELECTOR)?.querySelector(GROUP_HEADING_SELECTOR)?.scrollIntoView({ block: 'nearest' })
      }
      item.scrollIntoView({ block: 'nearest' })
    }
  }

  function getSelectedItem() {
    return listInnerRef.current?.querySelector(`${ITEM_SELECTOR}[aria-selected="true"]`)
  }

  function getValidItems() {
    return Array.from(listInnerRef.current?.querySelectorAll(VALID_ITEM_SELECTOR) || [])
  }

  function updateSelectedToIndex(index: number) {
    const items = getValidItems()
    const item = items[index]
    if (item) store.setState('value', item.getAttribute(VALUE_ATTR)!)
  }

  function updateSelectedByItem(change: 1 | -1) {
    const selected = getSelectedItem()
    const items = getValidItems()
    const index = items.findIndex((item) => item === selected)

    let newSelected = items[index + change]

    if (propsRef.current?.loop) {
      newSelected =
        index + change < 0
          ? items[items.length - 1]
          : index + change === items.length
            ? items[0]
            : items[index + change]
    }

    if (newSelected) store.setState('value', newSelected.getAttribute(VALUE_ATTR)!)
  }

  function updateSelectedByGroup(change: 1 | -1) {
    const selected = getSelectedItem()
    let group = selected?.closest(GROUP_SELECTOR)
    let item: Element | undefined | null

    while (group && !item) {
      group = change > 0 ? findNextSibling(group, GROUP_SELECTOR) : findPreviousSibling(group, GROUP_SELECTOR)
      item = group?.querySelector(VALID_ITEM_SELECTOR)
    }

    if (item) {
      store.setState('value', item.getAttribute(VALUE_ATTR)!)
    } else {
      updateSelectedByItem(change)
    }
  }

  const last = () => updateSelectedToIndex(getValidItems().length - 1)

  const next = (e: React.KeyboardEvent) => {
    e.preventDefault()
    if (e.metaKey) last()
    else if (e.altKey) updateSelectedByGroup(1)
    else updateSelectedByItem(1)
  }

  const prev = (e: React.KeyboardEvent) => {
    e.preventDefault()
    if (e.metaKey) updateSelectedToIndex(0)
    else if (e.altKey) updateSelectedByGroup(-1)
    else updateSelectedByItem(-1)
  }

  return (
    <Primitive.div
      ref={forwardedRef}
      tabIndex={-1}
      {...etc}
      cmdk-root=""
      data-agentk-mode={akState.mode}
      data-agentk-agent={agent ? '' : undefined}
      data-agentk-hint={agentHintVisible ? '' : undefined}
      onKeyDown={(e) => {
        etc.onKeyDown?.(e)

        const isComposing = e.nativeEvent.isComposing || e.keyCode === 229
        if (e.defaultPrevented || isComposing) return

        const currentMode = akStateRef.current.mode

        // ── AgentK mode-aware keyboard handling ──
        if (currentMode === 'form') {
          switch (e.key) {
            case 'Escape': {
              e.preventDefault()
              e.stopPropagation()
              akDispatch({ type: 'RESET' })
              return
            }
            case 'Enter': {
              // Only submit if not focused on a form field that needs Enter
              const active = document.activeElement
              if (active?.tagName === 'SELECT' || active?.tagName === 'TEXTAREA') return
              e.preventDefault()
              agentKContext.execute()
              return
            }
          }
          // Let Tab, arrow keys work naturally in form fields
          return
        }

        if (currentMode === 'planning') {
          // Block all input while LLM is thinking
          if (e.key === 'Escape') {
            e.preventDefault()
            e.stopPropagation()
            akDispatch({ type: 'RESET' })
          }
          return
        }

        if (currentMode === 'approval') {
          switch (e.key) {
            case 'Escape': {
              e.preventDefault()
              e.stopPropagation()
              agentKContext.rejectPlan()
              return
            }
            case 'Enter': {
              e.preventDefault()
              agentKContext.approvePlan()
              return
            }
          }
          return
        }

        if (currentMode === 'executing') {
          e.preventDefault()
          return
        }

        if (currentMode === 'result') {
          switch (e.key) {
            case 'Escape':
            case 'Enter': {
              e.preventDefault()
              e.stopPropagation()
              akDispatch({ type: 'RESET' })
              return
            }
          }
          return
        }

        // ── Original cmdk keyboard handling (browse mode) ──
        switch (e.key) {
          case 'n':
          case 'j': {
            if (vimBindings && e.ctrlKey) next(e)
            break
          }
          case 'ArrowDown': {
            next(e)
            break
          }
          case 'p':
          case 'k': {
            if (vimBindings && e.ctrlKey) prev(e)
            break
          }
          case 'ArrowUp': {
            prev(e)
            break
          }
          case 'Home': {
            e.preventDefault()
            updateSelectedToIndex(0)
            break
          }
          case 'End': {
            e.preventDefault()
            last()
            break
          }
          case 'Enter': {
            e.preventDefault()
            const item = getSelectedItem()
            if (item) {
              const event = new Event(SELECT_EVENT)
              item.dispatchEvent(event)
            } else if (agent) {
              // No item selected — treat as NL intent
              const search = state.current.search.trim()
              if (search) {
                akDispatch({ type: 'START_PLANNING', prompt: search })
              }
            }
          }
        }
      }}
    >
      <label
        cmdk-label=""
        htmlFor={context.inputId}
        id={context.labelId}
        style={srOnlyStyles}
      >
        {label}
      </label>
      {SlottableWithNestedChildren(props, (child) => (
        <StoreContext.Provider value={store}>
          <CommandContext.Provider value={context}>
            <AgentKContext.Provider value={agentKContext}>{child}</AgentKContext.Provider>
          </CommandContext.Provider>
        </StoreContext.Provider>
      ))}
    </Primitive.div>
  )
})

// ─────────────────────────────────────────────────────────────
// Original cmdk components
// ─────────────────────────────────────────────────────────────

const Item = React.forwardRef<HTMLDivElement, ItemProps>((props, forwardedRef) => {
  const id = useId()
  const ref = React.useRef<HTMLDivElement>(null)
  const groupContext = React.useContext(GroupContext)
  const context = useCommand()
  const propsRef = useAsRef(props)
  const forceMount = propsRef.current?.forceMount ?? groupContext?.forceMount

  useLayoutEffect(() => {
    if (!forceMount) {
      return context.item(id, groupContext?.id)
    }
  }, [forceMount])

  const value = useValue(id, ref, [props.value, props.children, ref], props.keywords)

  const store = useStore()
  const selected = useCmdk((state) => state.value && state.value === value.current)
  const render = useCmdk((state) =>
    forceMount ? true : context.filter() === false ? true : !state.search ? true : (state.filtered.items.get(id) ?? 0) > 0,
  )

  React.useEffect(() => {
    const element = ref.current
    if (!element || props.disabled) return
    element.addEventListener(SELECT_EVENT, onSelect)
    return () => element.removeEventListener(SELECT_EVENT, onSelect)
  }, [render, props.onSelect, props.disabled])

  function onSelect() {
    select()
    propsRef.current.onSelect?.(value.current!)
  }

  function select() {
    store.setState('value', value.current!, true)
  }

  if (!render) return null

  const { disabled, value: _, onSelect: __, forceMount: ___, keywords: ____, ...rest } = props

  return (
    <Primitive.div
      ref={composeRefs(ref, forwardedRef)}
      {...rest}
      id={id}
      cmdk-item=""
      role="option"
      aria-disabled={Boolean(disabled)}
      aria-selected={Boolean(selected)}
      data-disabled={Boolean(disabled)}
      data-selected={Boolean(selected)}
      onPointerMove={disabled || context.getDisablePointerSelection() ? undefined : select}
      onClick={disabled ? undefined : onSelect}
    >
      {props.children}
    </Primitive.div>
  )
})

const CommandGroup = React.forwardRef<HTMLDivElement, GroupProps>((props, forwardedRef) => {
  const { heading, children, forceMount, ...etc } = props
  const id = useId()
  const ref = React.useRef<HTMLDivElement>(null)
  const headingRef = React.useRef<HTMLDivElement>(null)
  const headingId = useId()
  const context = useCommand()
  const render = useCmdk((state) =>
    forceMount ? true : context.filter() === false ? true : !state.search ? true : state.filtered.groups.has(id),
  )

  useLayoutEffect(() => {
    return context.group(id)
  }, [])

  useValue(id, ref, [props.value, props.heading, headingRef])

  const contextValue = React.useMemo(() => ({ id, forceMount }), [forceMount])

  return (
    <Primitive.div
      ref={composeRefs(ref, forwardedRef)}
      {...etc}
      cmdk-group=""
      role="presentation"
      hidden={render ? undefined : true}
    >
      {heading && (
        <div ref={headingRef} cmdk-group-heading="" aria-hidden id={headingId}>
          {heading}
        </div>
      )}
      {SlottableWithNestedChildren(props, (child) => (
        <div cmdk-group-items="" role="group" aria-labelledby={heading ? headingId : undefined}>
          <GroupContext.Provider value={contextValue}>{child}</GroupContext.Provider>
        </div>
      ))}
    </Primitive.div>
  )
})

const Separator = React.forwardRef<HTMLDivElement, SeparatorProps>((props, forwardedRef) => {
  const { alwaysRender, ...etc } = props
  const ref = React.useRef<HTMLDivElement>(null)
  const render = useCmdk((state) => !state.search)

  if (!alwaysRender && !render) return null
  return <Primitive.div ref={composeRefs(ref, forwardedRef)} {...etc} cmdk-separator="" role="separator" />
})

const Input = React.forwardRef<HTMLInputElement, InputProps>((props, forwardedRef) => {
  const { onValueChange, ...etc } = props
  const isControlled = props.value != null
  const store = useStore()
  const search = useCmdk((state) => state.search)
  const selectedItemId = useCmdk((state) => state.selectedItemId)
  const context = useCommand()

  React.useEffect(() => {
    if (props.value != null) {
      store.setState('search', props.value)
    }
  }, [props.value])

  return (
    <Primitive.input
      ref={forwardedRef}
      {...etc}
      cmdk-input=""
      autoComplete="off"
      autoCorrect="off"
      spellCheck={false}
      aria-autocomplete="list"
      role="combobox"
      aria-expanded={true}
      aria-controls={context.listId}
      aria-labelledby={context.labelId}
      aria-activedescendant={selectedItemId}
      id={context.inputId}
      type="text"
      value={isControlled ? props.value : search}
      onChange={(e) => {
        if (!isControlled) {
          store.setState('search', e.target.value)
        }
        onValueChange?.(e.target.value)
      }}
    />
  )
})

const List = React.forwardRef<HTMLDivElement, ListProps>((props, forwardedRef) => {
  const { children, label = 'Suggestions', ...etc } = props
  const ref = React.useRef<HTMLDivElement>(null)
  const height = React.useRef<HTMLDivElement>(null)
  const selectedItemId = useCmdk((state) => state.selectedItemId)
  const context = useCommand()

  React.useEffect(() => {
    if (height.current && ref.current) {
      const el = height.current
      const wrapper = ref.current
      let animationFrame: number
      const observer = new ResizeObserver(() => {
        animationFrame = requestAnimationFrame(() => {
          const h = el.offsetHeight
          wrapper.style.setProperty(`--cmdk-list-height`, h.toFixed(1) + 'px')
        })
      })
      observer.observe(el)
      return () => {
        cancelAnimationFrame(animationFrame)
        observer.unobserve(el)
      }
    }
  }, [])

  return (
    <Primitive.div
      ref={composeRefs(ref, forwardedRef)}
      {...etc}
      cmdk-list=""
      role="listbox"
      tabIndex={-1}
      aria-activedescendant={selectedItemId}
      aria-label={label}
      id={context.listId}
    >
      {SlottableWithNestedChildren(props, (child) => (
        <div ref={composeRefs(height, context.listInnerRef)} cmdk-list-sizer="">
          {child}
        </div>
      ))}
    </Primitive.div>
  )
})

const Dialog = React.forwardRef<HTMLDivElement, DialogProps>((props, forwardedRef) => {
  const { open, onOpenChange, overlayClassName, contentClassName, container, ...etc } = props
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal container={container}>
        <RadixDialog.Overlay cmdk-overlay="" className={overlayClassName} />
        <RadixDialog.Content aria-label={props.label} cmdk-dialog="" className={contentClassName}>
          <RadixDialog.Title style={srOnlyStyles as any}>{props.label ?? 'Command menu'}</RadixDialog.Title>
          <RadixDialog.Description style={srOnlyStyles as any}>
            Search for tools, scenes, and commands
          </RadixDialog.Description>
          <Command ref={forwardedRef} {...etc} />
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
})

const Empty = React.forwardRef<HTMLDivElement, EmptyProps>((props, forwardedRef) => {
  const render = useCmdk((state) => state.filtered.count === 0)
  const ak = React.useContext(AgentKContext)
  // Hide the default empty state when agent hint is showing
  if (!render || ak?.agentHintVisible) return null
  return <Primitive.div ref={forwardedRef} {...props} cmdk-empty="" role="presentation" />
})

/**
 * AgentHint — shown when no tools match but the agent can interpret the query.
 * Replaces the dead-end "No matching tools." with an actionable prompt card.
 */
type AgentHintProps = Children & DivProps
const AgentHint = React.forwardRef<HTMLDivElement, AgentHintProps>((props, forwardedRef) => {
  const ak = React.useContext(AgentKContext)
  const search = useCmdk((state) => state.search)
  if (!ak?.agentHintVisible) return null
  return (
    <Primitive.div ref={forwardedRef} {...props} data-agentk-agent-hint="" role="presentation">
      {props.children || (
        <>
          <div data-agentk-agent-hint-icon="">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 1v3M8 12v3M1 8h3M12 8h3M3.5 3.5l2 2M10.5 10.5l2 2M12.5 3.5l-2 2M5.5 10.5l-2 2" />
            </svg>
          </div>
          <div data-agentk-agent-hint-content="">
            <div data-agentk-agent-hint-label="">Ask the agent</div>
            <div data-agentk-agent-hint-query="">"{search}"</div>
          </div>
          <kbd data-agentk-agent-hint-kbd="">↵</kbd>
        </>
      )}
    </Primitive.div>
  )
})

const Loading = React.forwardRef<HTMLDivElement, LoadingProps>((props, forwardedRef) => {
  const { progress, children, label = 'Loading...', ...etc } = props
  return (
    <Primitive.div
      ref={forwardedRef}
      {...etc}
      cmdk-loading=""
      role="progressbar"
      aria-valuenow={progress}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      {SlottableWithNestedChildren(props, (child) => (
        <div aria-hidden>{child}</div>
      ))}
    </Primitive.div>
  )
})

// ─────────────────────────────────────────────────────────────
// AgentK components — new primitives for tool interaction
// ─────────────────────────────────────────────────────────────

/**
 * A command item that represents a WebMCP tool.
 * When selected, transitions to form mode if the tool has parameters,
 * or executes immediately if it doesn't.
 */
const ToolItem = React.forwardRef<HTMLDivElement, ToolItemProps>((props, forwardedRef) => {
  const { tool, onExecuted, ...itemProps } = props
  const ak = React.useContext(AgentKContext)

  return (
    <Item
      ref={forwardedRef}
      {...itemProps}
      value={itemProps.value ?? tool.name}
      keywords={[...(itemProps.keywords ?? []), ...(tool.keywords ?? []), tool.description ?? ''].filter(Boolean)}
      onSelect={(val) => {
        ak?.selectTool(tool)
        itemProps.onSelect?.(val)
      }}
      data-agentk-tool={tool.name}
    >
      {props.children ?? (
        <>
          {tool.icon && <span data-agentk-tool-icon="">{tool.icon}</span>}
          <span data-agentk-tool-name="">{tool.label || humanizeToolName(tool.name)}</span>
          {tool.description && <span data-agentk-tool-description="">{tool.description}</span>}
        </>
      )}
    </Item>
  )
})

/**
 * Renders a parameter form for the active tool.
 * Only visible when mode is 'form'. Generates fields from the tool's inputSchema.
 */
const ToolForm = React.forwardRef<HTMLDivElement, ToolFormProps>((props, forwardedRef) => {
  const { children, renderField, ...etc } = props
  const ak = React.useContext(AgentKContext)
  const firstInputRef = React.useRef<HTMLInputElement | HTMLSelectElement>(null)

  const activeTool = ak?.state.activeTool ?? null
  const parameters = ak?.state.parameters ?? {}
  const isVisible = ak?.state.mode === 'form' && !!activeTool
  const schema = activeTool?.inputSchema

  // Seed default values for range/number fields that have min+max (browser renders midpoint but state is empty)
  React.useEffect(() => {
    if (!isVisible || !schema?.properties || !ak) return
    const fields = Object.entries(schema.properties)
    for (const [name, fieldSchema] of fields) {
      if (parameters[name] !== undefined) continue
      if ((fieldSchema.type === 'number' || fieldSchema.type === 'integer') && fieldSchema.minimum !== undefined && fieldSchema.maximum !== undefined) {
        const mid = Math.round((fieldSchema.minimum + fieldSchema.maximum) / 2)
        ak.setParameter(name, fieldSchema.default ?? mid)
      }
    }
  }, [isVisible, activeTool?.name])

  // Auto-focus first input when form appears
  React.useEffect(() => {
    if (!isVisible) return
    requestAnimationFrame(() => {
      firstInputRef.current?.focus()
    })
  }, [isVisible, activeTool?.name])

  if (!isVisible || !schema?.properties) {
    return null
  }

  const fields = Object.entries(schema.properties)
  const required = new Set(schema.required ?? [])

  return (
    <Primitive.div ref={forwardedRef} {...etc} data-agentk-form="">
      <div data-agentk-form-heading="">
        {activeTool.icon && <span data-agentk-tool-icon="">{activeTool.icon}</span>}
        <span data-agentk-form-title="">{activeTool.label || humanizeToolName(activeTool.name)}</span>
        {activeTool.description && <span data-agentk-form-description="">{activeTool.description}</span>}
      </div>
      <div data-agentk-form-fields="">
        {fields.map(([name, fieldSchema], i) => {
          const value = parameters[name] ?? fieldSchema.default ?? ''
          const isRequired = required.has(name)

          if (renderField) {
            return (
              <div key={name} data-agentk-form-field="">
                {renderField(name, fieldSchema, value, (v) => ak.setParameter(name, v))}
              </div>
            )
          }

          const humanLabel = humanizeToolName(name)
          const hintText = fieldSchema.description
          // Strip label prefix from hint to avoid "Brightness / Brightness 0–100" redundancy
          const hintLower = (hintText || '').toLowerCase()
          const labelLower = humanLabel.toLowerCase()
          const dedupedHint = hintLower.startsWith(labelLower)
            ? hintText!.slice(humanLabel.length).replace(/^[\s:–—-]+/, '')
            : hintText
          const showHint = dedupedHint && dedupedHint.length > 0

          return (
            <div key={name} data-agentk-form-field="" style={{ '--delay': `${(i + 1) * 60}ms` } as React.CSSProperties}>
              <label data-agentk-form-label="">
                {humanLabel}
                {isRequired && <span data-agentk-required="">*</span>}
              </label>
              {showHint && (
                <span data-agentk-form-hint="">{dedupedHint}</span>
              )}
              <DefaultField
                ref={i === 0 ? firstInputRef : undefined}
                name={name}
                schema={fieldSchema}
                value={value}
                onChange={(v) => ak.setParameter(name, v)}
              />
            </div>
          )
        })}
      </div>
      <div data-agentk-form-actions="">
        <button data-agentk-form-cancel="" onClick={() => ak.reset()} type="button">
          Cancel
        </button>
        <button data-agentk-form-submit="" onClick={() => ak.execute()} type="button">
          Execute
        </button>
      </div>
      {children}
    </Primitive.div>
  )
})

/**
 * Renders the result of a tool execution.
 * Visible when mode is 'result' or 'executing'.
 */
const ToolResult = React.forwardRef<HTMLDivElement, ToolResultProps>((props, forwardedRef) => {
  const { children, renderResult, ...etc } = props
  const ak = React.useContext(AgentKContext)

  if (!ak || (ak.state.mode !== 'result' && ak.state.mode !== 'executing')) return null

  const { execution, mode } = ak.state

  if (mode === 'executing') {
    const isPlan = !!ak.state.plan
    const planTotal = ak.state.plan?.calls.length || 0
    const planStep = ak.state.planIndex + 1
    return (
      <Primitive.div ref={forwardedRef} {...etc} data-agentk-result="" data-agentk-executing="">
        <div data-agentk-result-loading="">
          <span data-agentk-spinner="" />
          <span>Executing {execution?.toolName ? humanizeToolName(execution.toolName) : ''}...</span>
        </div>
        {isPlan && planTotal > 1 && (
          <span data-agentk-progress="">Step {planStep} of {planTotal}</span>
        )}
        {children}
      </Primitive.div>
    )
  }

  if (!execution) return null

  if (renderResult) {
    return (
      <Primitive.div ref={forwardedRef} {...etc} data-agentk-result="">
        {renderResult(execution)}
        <button data-agentk-result-dismiss="" onClick={() => ak.reset()} type="button">
          Done
        </button>
        {children}
      </Primitive.div>
    )
  }

  return (
    <Primitive.div
      ref={forwardedRef}
      {...etc}
      data-agentk-result=""
      data-agentk-success={execution.error ? undefined : ''}
      data-agentk-error={execution.error ? '' : undefined}
    >
      <div data-agentk-result-heading="">
        {execution.error ? 'Error' : 'Result'}: {execution.toolName}
      </div>
      <div data-agentk-result-body="">
        {execution.error ? (
          <pre data-agentk-result-error="">{execution.error}</pre>
        ) : (
          <pre data-agentk-result-data="">
            {typeof execution.result === 'string' ? execution.result : JSON.stringify(execution.result, null, 2)}
          </pre>
        )}
      </div>
      <div data-agentk-result-meta="">
        <span>
          {execution.startedAt && `${((Date.now() - execution.startedAt) / 1000).toFixed(1)}s`}
        </span>
      </div>
      <button data-agentk-result-dismiss="" onClick={() => ak.reset()} type="button">
        Done
      </button>
      {children}
    </Primitive.div>
  )
})

/**
 * Default form field renderer. Generates appropriate input elements based on JSON Schema type.
 */
const DefaultField = React.forwardRef<HTMLInputElement | HTMLSelectElement, {
  name: string
  schema: ToolInputSchema['properties'][string]
  value: any
  onChange: (value: any) => void
}>((props, ref) => {
  const { name, schema, value, onChange } = props

  if (schema.enum) {
    return (
      <select
        ref={ref as React.Ref<HTMLSelectElement>}
        data-agentk-field-select=""
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Select {name}...</option>
        {schema.enum.map((opt) => (
          <option key={opt} value={opt}>
            {humanizeToolName(String(opt))}
          </option>
        ))}
      </select>
    )
  }

  if (schema.type === 'number' || schema.type === 'integer') {
    if (schema.minimum !== undefined && schema.maximum !== undefined) {
      return (
        <div data-agentk-field-range="">
          <input
            ref={ref as React.Ref<HTMLInputElement>}
            type="range"
            min={schema.minimum}
            max={schema.maximum}
            value={value ?? schema.minimum}
            onChange={(e) => onChange(Number(e.target.value))}
          />
          <span data-agentk-field-range-value="">{value ?? schema.minimum}</span>
        </div>
      )
    }
    return (
      <input
        ref={ref as React.Ref<HTMLInputElement>}
        data-agentk-field-number=""
        type="number"
        min={schema.minimum}
        max={schema.maximum}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        placeholder={name}
      />
    )
  }

  if (schema.type === 'boolean') {
    return (
      <label data-agentk-field-checkbox="">
        <input
          ref={ref as React.Ref<HTMLInputElement>}
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
        />
        {name}
      </label>
    )
  }

  // Default: text input
  return (
    <input
      ref={ref as React.Ref<HTMLInputElement>}
      data-agentk-field-text=""
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={schema.description || name}
    />
  )
})

// ─────────────────────────────────────────────────────────────
// Approval — shows the LLM's proposed plan for human review
// ─────────────────────────────────────────────────────────────

type ApprovalProps = Children &
  DivProps & {
    renderCall?: (call: AgentKToolCall, index: number) => React.ReactNode
    renderSummary?: (plan: AgentKPlan) => React.ReactNode
  }

const Approval = React.forwardRef<HTMLDivElement, ApprovalProps>((props, ref) => {
  const { children, renderCall, renderSummary, ...etc } = props
  const ak = React.useContext(AgentKContext)
  if (!ak) return null

  const { state, tools } = ak

  // Show spinner during planning
  if (state.mode === 'planning') {
    return (
      <Primitive.div ref={ref} {...etc} data-agentk-planning="">
        <div data-agentk-spinner="" />
        <span data-agentk-planning-text="">Thinking...</span>
      </Primitive.div>
    )
  }

  if (state.mode !== 'approval' || !state.plan) return null

  const { plan } = state

  // Build a lookup for tool icons
  const toolMap = new Map(tools.map((t) => [t.name, t]))

  return (
    <Primitive.div ref={ref} {...etc} data-agentk-approval="">
      {children || (
        <>
          <div data-agentk-approval-summary="">
            {renderSummary ? renderSummary(plan) : (
              <span>{plan.summary || `${plan.calls.length} action${plan.calls.length > 1 ? 's' : ''} planned`}</span>
            )}
          </div>
          <div data-agentk-approval-calls="">
            {plan.calls.map((call, i) => {
              const toolDef = toolMap.get(call.toolName)
              return (
                <div key={i} data-agentk-approval-call="">
                  {renderCall ? renderCall(call, i) : (
                    <>
                      {toolDef?.icon && <span data-agentk-approval-call-icon="">{toolDef.icon}</span>}
                      <span data-agentk-approval-call-name="">{humanizeToolName(call.toolName)}</span>
                      {Object.keys(call.parameters).length > 0 && (
                        <span data-agentk-approval-call-params="">
                          {Object.entries(call.parameters).map(([k, v]) => (
                            <span key={k} data-agentk-approval-param="">
                              <span data-agentk-approval-param-value="">{String(v)}</span>
                            </span>
                          ))}
                        </span>
                      )}
                    </>
                  )}
                </div>
              )
            })}
          </div>
          <div data-agentk-approval-actions="">
            <button data-agentk-approval-reject="" onClick={() => ak.rejectPlan()}>
              Reject
            </button>
            <button data-agentk-approval-approve="" onClick={() => ak.approvePlan()}>
              Approve
            </button>
          </div>
        </>
      )}
    </Primitive.div>
  )
})
Approval.displayName = 'Command.Approval'

// ─────────────────────────────────────────────────────────────
// Activity Feed — shows running log of agent actions
// ─────────────────────────────────────────────────────────────

type ActivityFeedProps = Children &
  DivProps & {
    maxEntries?: number
    renderEntry?: (entry: ActivityEntry) => React.ReactNode
  }

const ACTIVITY_ICONS: Record<ActivityEntry['type'], string> = {
  intent: '🔍',
  plan: '💡',
  tool_start: '⚡',
  tool_complete: '✓',
  tool_error: '✗',
}

const ActivityFeed = React.forwardRef<HTMLDivElement, ActivityFeedProps>((props, ref) => {
  const { children, maxEntries = 20, renderEntry, ...etc } = props
  const ak = React.useContext(AgentKContext)
  const [expanded, setExpanded] = React.useState(false)
  if (!ak) return null

  // Hide during approval — user needs to focus on the plan
  if (ak.state.mode === 'approval') return null

  const entries = ak.activityLog.slice(-maxEntries)
  if (entries.length === 0) return null

  const completed = entries.filter((e) => e.type === 'tool_complete').length
  const total = ak.state.plan?.calls.length || 0
  const latest = entries[entries.length - 1]

  // Single-line status summary
  const statusText = ak.state.mode === 'executing' && total > 0
    ? `${completed} of ${total} complete`
    : latest?.message || ''

  return (
    <Primitive.div
      ref={ref}
      {...etc}
      data-agentk-activity=""
      data-agentk-activity-expanded={expanded ? '' : undefined}
    >
      {children || (
        <>
          <button
            data-agentk-activity-toggle=""
            onClick={() => setExpanded((e) => !e)}
            type="button"
          >
            <span data-agentk-activity-status="">{statusText}</span>
            <span data-agentk-activity-chevron="" data-expanded={expanded ? '' : undefined}>
              {expanded ? '▾' : '▸'}
            </span>
          </button>
          {expanded && entries.map((entry) => (
            <div
              key={entry.id}
              data-agentk-activity-entry=""
              data-agentk-activity-type={entry.type}
            >
              {renderEntry ? renderEntry(entry) : (
                <>
                  <span data-agentk-activity-icon="">{ACTIVITY_ICONS[entry.type]}</span>
                  <span data-agentk-activity-message="">{entry.message}</span>
                </>
              )}
            </div>
          ))}
        </>
      )}
    </Primitive.div>
  )
})
ActivityFeed.displayName = 'Command.ActivityFeed'

// ─────────────────────────────────────────────────────────────
// WebMCP discovery hook
// ─────────────────────────────────────────────────────────────

/**
 * Discovers WebMCP tools from the browser's navigator.modelContext API.
 * Returns tools that can be passed to Command's tools prop.
 */
export function useWebMCPTools() {
  const [tools, setTools] = React.useState<AgentKToolDef[]>([])
  const [available, setAvailable] = React.useState(false)

  React.useEffect(() => {
    const hasWebMCP = typeof navigator !== 'undefined' && !!(navigator as any).modelContext
    setAvailable(hasWebMCP)

    if (hasWebMCP && (navigator as any).modelContextTesting) {
      try {
        const discovered = (navigator as any).modelContextTesting.listTools()
        setTools(
          discovered.map((t: any) => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema,
          })),
        )
      } catch {
        // WebMCP available but testing API not enabled
      }
    }
  }, [])

  const refresh = React.useCallback(() => {
    if ((navigator as any).modelContextTesting) {
      try {
        const discovered = (navigator as any).modelContextTesting.listTools()
        setTools(
          discovered.map((t: any) => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema,
          })),
        )
      } catch {}
    }
  }, [])

  const executeTool = React.useCallback(async (name: string, parameters: Record<string, any>) => {
    if (!(navigator as any).modelContextTesting) {
      throw new Error('WebMCP testing API not available')
    }
    return (navigator as any).modelContextTesting.executeTool(name, JSON.stringify(parameters))
  }, [])

  return { tools, available, refresh, executeTool }
}

// ─────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────

const pkg = Object.assign(Command, {
  List,
  Item,
  Input,
  Group: CommandGroup,
  Separator,
  Dialog,
  Empty,
  Loading,
  // AgentK primitives
  Tool: ToolItem,
  ToolForm,
  ToolResult,
  // Agent mode
  Approval,
  ActivityFeed,
  AgentHint,
})

// Hook to access AgentK state from within Command tree
export function useAgentK() {
  const ctx = React.useContext(AgentKContext)
  if (!ctx) throw new Error('useAgentK must be used within a <Command> component')
  return ctx
}

// cmdk-compatible exports
export { useCmdk as useCommandState }
export { pkg as Command }
export { defaultFilter }

export { Command as CommandRoot }
export { List as CommandList }
export { Item as CommandItem }
export { Input as CommandInput }
export { CommandGroup }
export { Separator as CommandSeparator }
export { Dialog as CommandDialog }
export { Empty as CommandEmpty }
export { Loading as CommandLoading }

// AgentK exports
export { ToolItem as CommandTool }
export { ToolForm as CommandToolForm }
export { ToolResult as CommandToolResult }
export { Approval as CommandApproval }
export { ActivityFeed as CommandActivityFeed }
export { AgentHint as CommandAgentHint }

// Re-export provider types
export type { AgentKAgentConfig, AgentKPlan, AgentKToolCall, AgentKProvider } from './providers'

// Re-export types
export type {
  CommandProps,
  CommandFilter,
  ItemProps,
  GroupProps,
  InputProps,
  ListProps,
  SeparatorProps,
  DialogProps,
  LoadingProps,
  EmptyProps,
  ToolItemProps,
  ToolFormProps,
  ToolResultProps,
  ApprovalProps,
  ActivityFeedProps,
}

// ─────────────────────────────────────────────────────────────
// Helpers — original cmdk
// ─────────────────────────────────────────────────────────────

function findNextSibling(el: Element, selector: string) {
  let sibling = el.nextElementSibling
  while (sibling) {
    if (sibling.matches(selector)) return sibling
    sibling = sibling.nextElementSibling
  }
}

function findPreviousSibling(el: Element, selector: string) {
  let sibling = el.previousElementSibling
  while (sibling) {
    if (sibling.matches(selector)) return sibling
    sibling = sibling.previousElementSibling
  }
}

function useAsRef<T>(data: T) {
  const ref = React.useRef<T>(data)
  useLayoutEffect(() => {
    ref.current = data
  })
  return ref
}

const useLayoutEffect = typeof window === 'undefined' ? React.useEffect : React.useLayoutEffect

function useLazyRef<T>(fn: () => T) {
  const ref = React.useRef<T>()
  if (ref.current === undefined) {
    ref.current = fn()
  }
  return ref as React.MutableRefObject<T>
}

function useCmdk<T = any>(selector: (state: State) => T): T {
  const store = useStore()
  const cb = () => selector(store.snapshot())
  return React.useSyncExternalStore(store.subscribe, cb, cb)
}

function useValue(
  id: string,
  ref: React.RefObject<HTMLElement | null>,
  deps: (string | React.ReactNode | React.RefObject<HTMLElement | null>)[],
  aliases: string[] = [],
) {
  const valueRef = React.useRef<string>()
  const context = useCommand()

  useLayoutEffect(() => {
    const value = (() => {
      for (const part of deps) {
        if (typeof part === 'string') {
          return part.trim()
        }
        if (typeof part === 'object' && part !== null && 'current' in part) {
          if ((part as React.RefObject<HTMLElement>).current) {
            return (part as React.RefObject<HTMLElement>).current!.textContent?.trim()
          }
          return valueRef.current
        }
      }
    })()

    const keywords = aliases.map((alias) => alias.trim())

    context.value(id, value!, keywords)
    ref.current?.setAttribute(VALUE_ATTR, value!)
    valueRef.current = value
  })

  return valueRef
}

const useScheduleLayoutEffect = () => {
  const [s, ss] = React.useState<object>()
  const fns = useLazyRef(() => new Map<string | number, () => void>())

  useLayoutEffect(() => {
    fns.current.forEach((f) => f())
    fns.current = new Map()
  }, [s])

  return (id: string | number, cb: () => void) => {
    fns.current.set(id, cb)
    ss({})
  }
}

function renderChildren(children: React.ReactElement) {
  const childrenType = children.type as any
  if (typeof childrenType === 'function') return childrenType(children.props)
  else if ('render' in childrenType) return childrenType.render(children.props)
  else return children
}

function SlottableWithNestedChildren(
  { asChild, children }: { asChild?: boolean; children?: React.ReactNode },
  render: (child: React.ReactNode) => React.JSX.Element,
) {
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(renderChildren(children), { ref: (children as any).ref }, render(children.props.children))
  }
  return render(children)
}

const srOnlyStyles = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: '0',
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  borderWidth: '0',
} as const
