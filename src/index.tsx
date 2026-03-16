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

/**
 * The possible modes of the AgentK state machine.
 *
 * - `'browse'`    — Default state. User browses and filters the tool list.
 * - `'form'`      — A tool has been selected and its parameter form is displayed.
 * - `'executing'` — A tool call is in progress.
 * - `'result'`    — Execution finished; result or error is displayed.
 * - `'planning'`  — The LLM agent is generating a plan (thinking).
 * - `'approval'`  — The agent's plan is shown for human approval.
 */
export type AgentKMode = 'browse' | 'form' | 'executing' | 'result' | 'planning' | 'approval'

/**
 * User-facing label overrides for internationalisation.
 * Every key is optional — omitted keys fall back to their English defaults.
 */
export type AgentKLabels = {
  cancel?: string
  execute?: string
  approve?: string
  reject?: string
  thinking?: string
  noResults?: string
  askAgent?: string
  done?: string
  executing?: string
  result?: string
  error?: string
  step?: string
  of?: string
  complete?: string
  planned?: string
  actions?: string
}

const DEFAULT_LABELS: Required<AgentKLabels> = {
  cancel: 'Cancel',
  execute: 'Execute',
  approve: 'Approve',
  reject: 'Reject',
  thinking: 'Thinking...',
  noResults: 'No results found.',
  askAgent: 'Ask the agent',
  done: 'Done',
  executing: 'Executing',
  result: 'Result',
  error: 'Error',
  step: 'Step',
  of: 'of',
  complete: 'complete',
  planned: 'planned',
  actions: 'actions',
}

/**
 * JSON-Schema-style description of a tool's input parameters.
 * Only `'object'` schemas are supported — each key in `properties` describes one parameter.
 */
export type ToolInputSchema = {
  type: 'object'
  description?: string
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

/**
 * Definition of a tool that can appear in the command palette.
 *
 * Tools can be passed directly via the `tools` prop on `Command`, or
 * discovered at runtime through the WebMCP `navigator.modelContext` API.
 *
 * @example
 * ```tsx
 * const myTool: AgentKToolDef = {
 *   name: 'set_brightness',
 *   description: 'Set display brightness',
 *   inputSchema: {
 *     type: 'object',
 *     properties: {
 *       level: { type: 'number', minimum: 0, maximum: 100 },
 *     },
 *     required: ['level'],
 *   },
 * }
 * ```
 */
export type AgentKToolDef = {
  /** Unique machine-readable identifier (e.g. `'set_brightness'`). */
  name: string
  /** Human-readable label. Falls back to humanised `name` if omitted. */
  label?: string
  /** Short text shown beneath the tool name in the list. */
  description?: string
  /** JSON-Schema definition of the tool's input parameters. When omitted the tool executes with no parameters. */
  inputSchema?: ToolInputSchema
  /** Icon rendered beside the tool name. Any valid React node. */
  icon?: React.ReactNode
  /** Extra keywords used when filtering the palette (not displayed). */
  keywords?: string[]
}

/** Converts snake_case/camelCase tool names to human-readable labels */
function humanizeToolName(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * Snapshot of a single tool execution.
 *
 * Lifecycle: when a tool begins executing, a `ToolExecution` is created with
 * `startedAt` set.  On success `result` is populated; on failure `error` is
 * set instead.  The object is available through `useAgentK().state.execution`.
 */
export type ToolExecution = {
  /** The `name` of the tool being executed. */
  toolName: string
  /** Parameter values passed to the tool. */
  parameters: Record<string, any>
  /** Populated on successful completion. */
  result?: any
  /** Populated when execution fails. */
  error?: string
  /** `Date.now()` timestamp of when execution began. */
  startedAt: number
  /** @internal Monotonic counter for dedup — not part of the public API. */
  _seq?: number
}

/**
 * A single entry in the agent activity log.
 *
 * Type values:
 * - `'intent'`       — The user's natural-language query was sent to the agent.
 * - `'plan'`         — The agent produced a plan (one or more tool calls).
 * - `'tool_start'`   — A tool call began executing.
 * - `'tool_complete'` — A tool call finished successfully.
 * - `'tool_error'`   — A tool call failed.
 */
export type ActivityEntry = {
  /** Unique identifier (auto-generated). */
  id: string
  /** `Date.now()` when the entry was created. */
  timestamp: number
  /** Discriminator for the kind of activity. */
  type: 'intent' | 'plan' | 'tool_start' | 'tool_complete' | 'tool_error'
  /** Present for tool-related entries. */
  toolName?: string
  /** Parameters passed to the tool (tool entries only). */
  parameters?: Record<string, any>
  /** Execution result (tool_complete only). */
  result?: any
  /** Error message (tool_error only). */
  error?: string
  /** Human-readable summary of the activity. */
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
  /** Abort the currently executing tool call and return to browse mode. */
  cancel: () => void
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
  /** Resolved i18n labels (defaults merged with user overrides). */
  labels: Required<AgentKLabels>
  /** Custom tool-name formatter. Falls back to `humanizeToolName`. */
  formatToolName: (name: string) => string
  /** @internal — validation gate registered by ToolForm. Returns true if valid. */
  _validateRef: React.MutableRefObject<(() => boolean) | null>
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
    onToolExecute?: (toolName: string, parameters: Record<string, any>, signal?: AbortSignal) => Promise<any>
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
    /**
     * Execution timeout in milliseconds. Defaults to `30000` (30 s).
     * Set to `0` or `Infinity` to disable.
     */
    timeout?: number
    /**
     * Override the default UI strings for internationalisation.
     * Any key that is omitted falls back to its English default.
     *
     * @example
     * ```tsx
     * <Command labels={{ execute: 'Ausführen', cancel: 'Abbrechen' }} />
     * ```
     */
    labels?: AgentKLabels
    /**
     * Custom function to convert machine tool names to display strings.
     * When provided, replaces the built-in `humanizeToolName` everywhere.
     *
     * @example
     * ```tsx
     * <Command formatToolName={(n) => n.toUpperCase()} />
     * ```
     */
    formatToolName?: (name: string) => string
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
  | { type: 'ADVANCE_PLAN'; result?: any }
  | { type: 'LOG_ACTIVITY'; entry: Omit<ActivityEntry, 'id' | 'timestamp'> }

let activityId = 0
let executionSeq = 0

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
          : { toolName: tool.name, parameters: defaults, startedAt: Date.now(), _seq: ++executionSeq },
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
          _seq: ++executionSeq,
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
          _seq: ++executionSeq,
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
        // All calls done — store the last tool's result on the execution
        return {
          ...state,
          mode: 'result' as AgentKMode,
          planIndex: nextIndex,
          execution: state.execution ? { ...state.execution, result: action.result } : null,
        }
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
          _seq: ++executionSeq,
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

/**
 * Root component of the command palette.
 *
 * Manages filtering, selection, keyboard navigation, the AgentK state
 * machine (browse → form → executing → result), and optional LLM agent
 * integration (planning → approval).
 *
 * Attach sub-components via `Command.List`, `Command.Input`, `Command.Tool`,
 * `Command.ToolForm`, `Command.ToolResult`, `Command.Approval`, etc.
 *
 * @example
 * ```tsx
 * <Command tools={tools} onToolExecute={exec}>
 *   <Command.Input placeholder="Type a command..." />
 *   <Command.List>
 *     <Command.Empty>No results found.</Command.Empty>
 *     {tools.map(t => <Command.Tool key={t.name} tool={t} />)}
 *   </Command.List>
 *   <Command.ToolForm />
 *   <Command.ToolResult />
 * </Command>
 * ```
 */
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
    timeout: timeoutMs = 30000,
    labels: labelOverrides,
    formatToolName: formatToolNameProp,
    // Agent mode props
    agent,
    onAgentPlan,
    onAgentApprove,
    onAgentReject,
    ...etc
  } = props

  // Merge user label overrides with defaults
  const resolvedLabels: Required<AgentKLabels> = React.useMemo(
    () => (labelOverrides ? { ...DEFAULT_LABELS, ...labelOverrides } : DEFAULT_LABELS),
    [labelOverrides],
  )

  // Resolve the tool-name formatter
  const resolvedFormatToolName = React.useCallback(
    (name: string) => (formatToolNameProp ? formatToolNameProp(name) : humanizeToolName(name)),
    [formatToolNameProp],
  )

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

  // ── P1.6: Cancellation via AbortController ──
  const abortControllerRef = React.useRef<AbortController | null>(null)

  // ── P0.1: Validation gate ref (registered by ToolForm) ──
  const validateRef = React.useRef<(() => boolean) | null>(null)

  // ── P1.10: Mode transition animation attributes ──
  const prevModeRef = React.useRef<AgentKMode>(akState.mode)
  const [transitionAttrs, setTransitionAttrs] = React.useState<{
    entering?: AgentKMode
    exiting?: AgentKMode
  }>({})

  // Notify mode changes + track transitions
  React.useEffect(() => {
    onModeChange?.(akState.mode)

    const prev = prevModeRef.current
    if (prev !== akState.mode) {
      setTransitionAttrs({ entering: akState.mode, exiting: prev })
      prevModeRef.current = akState.mode

      // Clear transition attributes after duration
      let timer: ReturnType<typeof setTimeout>
      const raf = requestAnimationFrame(() => {
        timer = setTimeout(() => {
          setTransitionAttrs({})
        }, 150) // --agentk-transition-duration default
      })

      return () => {
        cancelAnimationFrame(raf)
        clearTimeout(timer)
      }
    }
  }, [akState.mode])

  // Dedup guard: prevent double execution in React strict mode
  const lastExecutedSeq = React.useRef<number>(0)

  // Execute tool when entering 'executing' mode
  React.useEffect(() => {
    if (akState.mode === 'executing' && akState.execution) {
      const { toolName, parameters } = akState.execution
      const seq = akState.execution._seq ?? 0
      if (seq <= lastExecutedSeq.current) return
      lastExecutedSeq.current = seq
      const isPlanExecution = akState.plan !== null

      // ── P1.6: Tool call validation (agent-planned calls) ──
      if (isPlanExecution && tools && tools.length > 0) {
        const exists = tools.some((t) => t.name === toolName)
        if (!exists) {
          const available = tools.map((t) => t.name).join(', ')
          const errorMsg = `Unknown tool: ${toolName}. Available tools: ${available}`
          akDispatch({
            type: 'LOG_ACTIVITY',
            entry: { type: 'tool_error', toolName, error: errorMsg, message: `${toolName} failed: ${errorMsg}` },
          })
          akDispatch({ type: 'FAIL_EXECUTION', error: errorMsg })
          onToolError?.(toolName, errorMsg)
          return
        }
      }

      // ── P1.6: AbortController + timeout ──
      const controller = new AbortController()
      abortControllerRef.current = controller

      // Build combined signal: user cancel + timeout
      let signal: AbortSignal = controller.signal
      if (timeoutMs && timeoutMs > 0 && timeoutMs !== Infinity) {
        try {
          // AbortSignal.any & AbortSignal.timeout may not be available in all environments
          const timeoutSignal = AbortSignal.timeout(timeoutMs)
          signal = (AbortSignal as any).any
            ? (AbortSignal as any).any([controller.signal, timeoutSignal])
            : controller.signal
        } catch {
          // Fallback: just use the controller signal
        }
      }

      const doExecute = async () => {
        try {
          if (signal.aborted) return
          let result: any
          if (onToolExecute) {
            result = await onToolExecute(toolName, parameters, signal)
          } else if (typeof navigator !== 'undefined' && navigator.modelContextTesting) {
            result = await navigator.modelContextTesting.executeTool(toolName, JSON.stringify(parameters))
          } else {
            throw new Error('No executor available. Provide onToolExecute or enable WebMCP.')
          }
          if (signal.aborted) return
          // Log completion
          if (isPlanExecution) {
            akDispatch({
              type: 'LOG_ACTIVITY',
              entry: { type: 'tool_complete', toolName, result, message: `${toolName} completed` },
            })
            akDispatch({ type: 'ADVANCE_PLAN', result })
          } else {
            akDispatch({ type: 'COMPLETE_EXECUTION', result })
          }
          onToolResult?.(toolName, result)
        } catch (err: any) {
          if (signal.aborted) return
          const isTimeout = err?.name === 'TimeoutError'
          const errorMsg = isTimeout
            ? `Execution timed out after ${(timeoutMs / 1000).toFixed(0)}s`
            : (err?.message || String(err))
          if (isPlanExecution) {
            akDispatch({
              type: 'LOG_ACTIVITY',
              entry: { type: 'tool_error', toolName, error: errorMsg, message: `${toolName} failed: ${errorMsg}` },
            })
            akDispatch({ type: 'FAIL_EXECUTION', error: errorMsg })
          } else {
            akDispatch({ type: 'FAIL_EXECUTION', error: errorMsg })
          }
          onToolError?.(toolName, errorMsg)
        }
      }
      doExecute()

      // Fallback timeout for environments without AbortSignal.timeout
      let fallbackTimer: ReturnType<typeof setTimeout> | undefined
      if (timeoutMs && timeoutMs > 0 && timeoutMs !== Infinity && !(AbortSignal as any).any) {
        fallbackTimer = setTimeout(() => {
          if (!controller.signal.aborted) {
            const errorMsg = `Execution timed out after ${(timeoutMs / 1000).toFixed(0)}s`
            akDispatch({ type: 'FAIL_EXECUTION', error: errorMsg })
            onToolError?.(toolName, errorMsg)
            controller.abort()
          }
        }, timeoutMs)
      }

      return () => {
        if (fallbackTimer) clearTimeout(fallbackTimer)
      }
    }
  }, [akState.mode, akState.execution?._seq])

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

        // Auto-execute if approval not required (default: auto-approve)
        if (!agent.requireApproval) {
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
        // If a validation gate is registered (by ToolForm), run it first
        if (validateRef.current && !validateRef.current()) return
        const { activeTool, parameters } = akStateRef.current
        if (!activeTool) return
        akDispatch({ type: 'START_EXECUTION', toolName: activeTool.name, parameters })
      },
      reset: () => {
        abortControllerRef.current?.abort()
        abortControllerRef.current = null
        akDispatch({ type: 'RESET' })
      },
      cancel: () => {
        abortControllerRef.current?.abort()
        abortControllerRef.current = null
        akDispatch({ type: 'RESET' })
      },
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
      labels: resolvedLabels,
      formatToolName: resolvedFormatToolName,
      _validateRef: validateRef,
    }),
    [akState, webmcpAvailable, agent, tools, agentHintVisible, resolvedLabels, resolvedFormatToolName],
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
      data-agentk-entering={transitionAttrs.entering ?? undefined}
      data-agentk-exiting={transitionAttrs.exiting ?? undefined}
      style={{ ...((etc as any).style || {}), '--agentk-transition-duration': '150ms' } as React.CSSProperties}
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
              if (
                active?.tagName === 'SELECT' ||
                active?.tagName === 'TEXTAREA' ||
                active?.tagName === 'BUTTON' ||
                (active as HTMLInputElement)?.type === 'checkbox' ||
                active?.getAttribute('role') === 'button'
              ) return
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
Command.displayName = 'Command'

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

/**
 * Command palette rendered inside a Radix Dialog (modal overlay).
 *
 * Accepts all `Command` props plus `open`, `onOpenChange`, `overlayClassName`,
 * `contentClassName`, and `container`.
 *
 * @example
 * ```tsx
 * <Command.Dialog open={open} onOpenChange={setOpen} tools={tools}>
 *   <Command.Input />
 *   <Command.List>
 *     {tools.map(t => <Command.Tool key={t.name} tool={t} />)}
 *   </Command.List>
 *   <Command.ToolForm />
 *   <Command.ToolResult />
 * </Command.Dialog>
 * ```
 */
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
 * Shown when no tools match the current query but the agent can interpret it.
 * Replaces the dead-end "No matching tools." with an actionable prompt card.
 *
 * The component renders nothing unless the agent is configured and the palette
 * search yields zero tool matches.  Style with `[data-agentk-agent-hint]`.
 */
type AgentHintProps = Children & DivProps
const AgentHint = React.forwardRef<HTMLDivElement, AgentHintProps>((props, forwardedRef) => {
  const ak = React.useContext(AgentKContext)
  const search = useCmdk((state) => state.search)
  if (!ak?.agentHintVisible) return null
  return (
    <Primitive.div ref={forwardedRef} {...props} data-agentk-agent-hint="" role="status" aria-live="polite">
      {props.children || (
        <>
          <div data-agentk-agent-hint-icon="">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 1v3M8 12v3M1 8h3M12 8h3M3.5 3.5l2 2M10.5 10.5l2 2M12.5 3.5l-2 2M5.5 10.5l-2 2" />
            </svg>
          </div>
          <div data-agentk-agent-hint-content="">
            <div data-agentk-agent-hint-label="">{ak.labels.askAgent}</div>
            <div data-agentk-agent-hint-query="">"{search}"</div>
          </div>
          <kbd data-agentk-agent-hint-kbd="">↵</kbd>
        </>
      )}
    </Primitive.div>
  )
})
AgentHint.displayName = 'Command.AgentHint'

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
 *
 * When selected, transitions to form mode if the tool has parameters,
 * or executes immediately if it doesn't.  Renders the tool's icon, name,
 * and description by default, but accepts arbitrary children for full control.
 */
const ToolItem = React.forwardRef<HTMLDivElement, ToolItemProps>((props, forwardedRef) => {
  const { tool, onExecuted, ...itemProps } = props
  const ak = React.useContext(AgentKContext)
  const fmt = ak?.formatToolName ?? humanizeToolName

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
          <span data-agentk-tool-name="">{tool.label || fmt(tool.name)}</span>
          {tool.description && <span data-agentk-tool-description="">{tool.description}</span>}
        </>
      )}
    </Item>
  )
})
ToolItem.displayName = 'Command.Tool'

/**
 * Renders a parameter form for the active tool.
 *
 * Only visible when mode is `'form'`.  Generates fields from the tool's
 * `inputSchema` automatically, or delegates to `renderField` for full control.
 *
 * @example
 * ```tsx
 * <Command.ToolForm
 *   renderField={(name, schema, value, onChange) => (
 *     <MyCustomInput name={name} value={value} onChange={onChange} />
 *   )}
 * />
 * ```
 */
const ToolForm = React.forwardRef<HTMLDivElement, ToolFormProps>((props, forwardedRef) => {
  const { children, renderField, ...etc } = props
  const ak = React.useContext(AgentKContext)
  const firstInputRef = React.useRef<HTMLInputElement | HTMLSelectElement>(null)

  const activeTool = ak?.state.activeTool ?? null
  const parameters = ak?.state.parameters ?? {}
  const isVisible = ak?.state.mode === 'form' && !!activeTool
  const schema = activeTool?.inputSchema
  const fmt = ak?.formatToolName ?? humanizeToolName
  const labels = ak?.labels ?? DEFAULT_LABELS

  // ── P0.1: Validation state ──
  const [validationErrors, setValidationErrors] = React.useState<Record<string, string>>({})

  const validateForm = React.useCallback((): boolean => {
    if (!schema?.properties) return true
    const errors: Record<string, string> = {}
    const requiredFields = new Set(schema.required ?? [])
    const params = ak?.state.parameters ?? {}

    for (const [name, fieldSchema] of Object.entries(schema.properties)) {
      const val = params[name]

      // Required check
      if (requiredFields.has(name)) {
        if (val === undefined || val === null || val === '') {
          errors[name] = `${fmt(name)} is required`
          continue
        }
      }

      // Number range check
      if ((fieldSchema.type === 'number' || fieldSchema.type === 'integer') && val !== undefined && val !== '' && val !== null) {
        const num = Number(val)
        if (fieldSchema.minimum !== undefined && num < fieldSchema.minimum) {
          errors[name] = `Minimum is ${fieldSchema.minimum}`
        } else if (fieldSchema.maximum !== undefined && num > fieldSchema.maximum) {
          errors[name] = `Maximum is ${fieldSchema.maximum}`
        }
      }

      // Enum/select required check (value is still placeholder "")
      if (fieldSchema.enum && requiredFields.has(name) && (val === '' || val === undefined || val === null)) {
        errors[name] = `${fmt(name)} is required`
      }
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }, [schema, ak?.state.parameters, fmt])

  // Clear a single field's error when its value changes
  const handleFieldChange = React.useCallback((name: string, value: any) => {
    if (!ak) return
    ak.setParameter(name, value)
    setValidationErrors((prev) => {
      if (!(name in prev)) return prev
      const next = { ...prev }
      delete next[name]
      return next
    })
  }, [ak])

  // Register validation gate into context so Enter key also validates
  React.useEffect(() => {
    if (!ak || !isVisible) return
    ak._validateRef.current = validateForm
    return () => {
      ak._validateRef.current = null
    }
  }, [ak, isVisible, validateForm])

  // Validated submit (used by button; Enter key goes through context.execute → _validateRef)
  const handleSubmit = React.useCallback(() => {
    if (!ak) return
    ak.execute()
  }, [ak])

  // Clear errors on tool change or reset
  React.useEffect(() => {
    setValidationErrors({})
  }, [activeTool?.name, isVisible])

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
  const hasErrors = Object.keys(validationErrors).length > 0

  return (
    <Primitive.div
      ref={forwardedRef}
      {...etc}
      data-agentk-form=""
      data-agentk-form-invalid={hasErrors ? '' : undefined}
    >
      <div data-agentk-form-heading="">
        {activeTool.icon && <span data-agentk-tool-icon="">{activeTool.icon}</span>}
        <span data-agentk-form-title="">{activeTool.label || fmt(activeTool.name)}</span>
        {activeTool.description && <span data-agentk-form-description="">{activeTool.description}</span>}
      </div>
      <div data-agentk-form-fields="">
        {fields.map(([name, fieldSchema], i) => {
          const value = parameters[name] ?? fieldSchema.default ?? ''
          const isRequired = required.has(name)
          const fieldError = validationErrors[name]

          if (renderField) {
            return (
              <div key={name} data-agentk-form-field="" data-agentk-field-error={fieldError ? '' : undefined}>
                {renderField(name, fieldSchema, value, (v) => handleFieldChange(name, v))}
                {fieldError && (
                  <span data-agentk-field-error-message="" id={name + '-error'} role="alert">
                    {fieldError}
                  </span>
                )}
              </div>
            )
          }

          const humanLabel = fmt(name)
          const hintText = fieldSchema.description
          // Strip label prefix from hint to avoid "Brightness / Brightness 0–100" redundancy
          const hintLower = (hintText || '').toLowerCase()
          const labelLower = humanLabel.toLowerCase()
          // Only strip if hint starts with the full label followed by a non-letter (word boundary)
          const isExactPrefix = hintLower.startsWith(labelLower) &&
            (hintLower.length === labelLower.length || !/[a-z]/.test(hintLower[labelLower.length]))
          const dedupedHint = isExactPrefix
            ? hintText!.slice(humanLabel.length).replace(/^[\s:–—-]+/, '')
            : hintText
          const showHint = dedupedHint && dedupedHint.length > 0

          return (
            <div
              key={name}
              data-agentk-form-field=""
              data-agentk-field-error={fieldError ? '' : undefined}
              style={{ '--delay': `${(i + 1) * 60}ms` } as React.CSSProperties}
            >
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
                onChange={(v) => handleFieldChange(name, v)}
                error={fieldError}
              />
              {fieldError && (
                <span data-agentk-field-error-message="" id={name + '-error'} role="alert">
                  {fieldError}
                </span>
              )}
            </div>
          )
        })}
      </div>
      <div data-agentk-form-actions="">
        <button data-agentk-form-cancel="" onClick={() => ak.reset()} type="button">
          {labels.cancel}
        </button>
        <button data-agentk-form-submit="" onClick={handleSubmit} type="button">
          {labels.execute}
        </button>
      </div>
      {children}
    </Primitive.div>
  )
})
ToolForm.displayName = 'Command.ToolForm'

/**
 * Renders the result of a tool execution.
 *
 * Visible when mode is `'result'` or `'executing'`.  During execution it shows
 * a spinner and progress indicator; afterwards it shows the result or error.
 * Provide `renderResult` for fully custom result rendering.
 */
const ToolResult = React.forwardRef<HTMLDivElement, ToolResultProps>((props, forwardedRef) => {
  const { children, renderResult, ...etc } = props
  const ak = React.useContext(AgentKContext)

  if (!ak || (ak.state.mode !== 'result' && ak.state.mode !== 'executing')) return null

  const { execution, mode } = ak.state
  const fmt = ak.formatToolName
  const labels = ak.labels

  if (mode === 'executing') {
    const isPlan = !!ak.state.plan
    const planTotal = ak.state.plan?.calls.length || 0
    const planStep = ak.state.planIndex + 1
    return (
      <Primitive.div ref={forwardedRef} {...etc} data-agentk-result="" data-agentk-executing="">
        <div data-agentk-result-loading="">
          <span data-agentk-spinner="" role="status" aria-label="Loading" />
          <span>{labels.executing} {execution?.toolName ? fmt(execution.toolName) : ''}...</span>
        </div>
        {isPlan && planTotal > 1 && (
          <span data-agentk-progress="">{labels.step} {planStep} {labels.of} {planTotal}</span>
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
          {labels.done}
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
        {execution.error
          ? `${labels.error}: ${execution.toolName}`
          : ak.state.plan && ak.state.plan.calls.length > 1
            ? (ak.state.plan.summary || labels.result)
            : `${labels.result}: ${fmt(execution.toolName)}`}
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
        {labels.done}
      </button>
      {children}
    </Primitive.div>
  )
})
ToolResult.displayName = 'Command.ToolResult'

/**
 * Default form field renderer.
 *
 * Generates appropriate input elements based on JSON Schema type:
 * - `enum` → `<select>`
 * - `number`/`integer` with min+max → `<input type="range">`
 * - `number`/`integer` without → `<input type="number">`
 * - `boolean` → `<input type="checkbox">`
 * - anything else → `<input type="text">`
 */
const DefaultField = React.forwardRef<HTMLInputElement | HTMLSelectElement, {
  name: string
  schema: ToolInputSchema['properties'][string]
  value: any
  onChange: (value: any) => void
  error?: string
}>((props, ref) => {
  const { name, schema, value, onChange, error } = props
  const ak = React.useContext(AgentKContext)
  const fmt = ak?.formatToolName ?? humanizeToolName
  const ariaLabel = fmt(name)
  const ariaInvalid = error ? ('true' as const) : undefined
  const ariaDescribedBy = error ? name + '-error' : undefined

  if (schema.enum) {
    return (
      <select
        ref={ref as React.Ref<HTMLSelectElement>}
        data-agentk-field-select=""
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
      >
        <option value="">Select {name}...</option>
        {schema.enum.map((opt) => (
          <option key={opt} value={opt}>
            {fmt(String(opt))}
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
            aria-label={ariaLabel}
            aria-valuemin={schema.minimum}
            aria-valuemax={schema.maximum}
            aria-valuenow={value ?? schema.minimum}
            aria-invalid={ariaInvalid}
            aria-describedby={ariaDescribedBy}
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
        aria-label={ariaLabel}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
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
          aria-label={ariaLabel}
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedBy}
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
      aria-label={ariaLabel}
      aria-invalid={ariaInvalid}
      aria-describedby={ariaDescribedBy}
    />
  )
})
DefaultField.displayName = 'DefaultField'

// ─────────────────────────────────────────────────────────────
// Approval — shows the LLM's proposed plan for human review
// ─────────────────────────────────────────────────────────────

/**
 * @internal Focus trap wrapper for the Approval component.
 * Captures focus on mount and restores it on unmount.
 */
function ApprovalFocusTrap({
  children,
  containerRef,
  previousFocusRef,
  inputId: _inputId,
}: {
  children: React.ReactNode
  containerRef: React.RefObject<HTMLDivElement | null>
  previousFocusRef: React.MutableRefObject<HTMLElement | null>
  inputId?: string
}) {
  React.useEffect(() => {
    // Remember the element that had focus before we trapped
    previousFocusRef.current = document.activeElement as HTMLElement | null

    // Focus the first focusable element in the container
    const timer = requestAnimationFrame(() => {
      const container = containerRef.current
      if (!container) return
      const focusable = container.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      focusable?.focus()
    })

    // Handle Tab key to trap focus within the container
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const container = containerRef.current
      if (!container) return
      const focusables = container.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      if (focusables.length === 0) return

      const first = focusables[0]
      const last = focusables[focusables.length - 1]

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      cancelAnimationFrame(timer)
      document.removeEventListener('keydown', handleKeyDown)
      // Restore focus to the element that had it before
      previousFocusRef.current?.focus()
    }
  }, [])

  return <>{children}</>
}

/**
 * Displays the LLM agent's proposed plan for human review.
 *
 * Renders in two sub-modes:
 * - `planning` — shows a spinner while the LLM is thinking.
 * - `approval` — shows the list of proposed tool calls with Approve / Reject buttons.
 *
 * Provide `renderCall` and/or `renderSummary` for custom rendering.
 */
type ApprovalProps = Children &
  DivProps & {
    /** Custom renderer for each planned tool call. */
    renderCall?: (call: AgentKToolCall, index: number) => React.ReactNode
    /** Custom renderer for the plan summary line. */
    renderSummary?: (plan: AgentKPlan) => React.ReactNode
  }

const Approval = React.forwardRef<HTMLDivElement, ApprovalProps>((props, ref) => {
  const { children, renderCall, renderSummary, ...etc } = props
  const ak = React.useContext(AgentKContext)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const previousFocusRef = React.useRef<HTMLElement | null>(null)
  if (!ak) return null

  const { state, tools } = ak
  const fmt = ak.formatToolName
  const labels = ak.labels

  // Show spinner during planning
  if (state.mode === 'planning') {
    return (
      <Primitive.div ref={ref} {...etc} data-agentk-planning="">
        <div data-agentk-spinner="" role="status" aria-label="Loading" />
        <span data-agentk-planning-text="">{labels.thinking}</span>
      </Primitive.div>
    )
  }

  if (state.mode !== 'approval' || !state.plan) return null

  const { plan } = state

  // Build a lookup for tool icons
  const toolMap = new Map(tools.map((t) => [t.name, t]))

  // Build summary text using labels
  const defaultSummary = plan.calls.length === 1
    ? `1 ${labels.actions.replace(/s$/, '')} ${labels.planned}`
    : `${plan.calls.length} ${labels.actions} ${labels.planned}`

  return (
    <ApprovalFocusTrap
      containerRef={containerRef}
      previousFocusRef={previousFocusRef}
      inputId={ak.state.mode === 'approval' ? 'agentk-approval-trap' : undefined}
    >
      <Primitive.div
        ref={composeRefs(ref, containerRef)}
        {...etc}
        data-agentk-approval=""
        aria-live="polite"
        role="region"
        aria-label="Plan approval"
      >
        {children || (
          <>
            <div data-agentk-approval-summary="">
              {renderSummary ? renderSummary(plan) : (
                <span>{plan.summary || defaultSummary}</span>
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
                        <span data-agentk-approval-call-name="">{fmt(call.toolName)}</span>
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
                {labels.reject}
              </button>
              <button data-agentk-approval-approve="" onClick={() => ak.approvePlan()}>
                {labels.approve}
              </button>
            </div>
          </>
        )}
      </Primitive.div>
    </ApprovalFocusTrap>
  )
})
Approval.displayName = 'Command.Approval'

// ─────────────────────────────────────────────────────────────
// Activity Feed — shows running log of agent actions
// ─────────────────────────────────────────────────────────────

/**
 * Scrollable log of agent activity (intents, plans, tool calls).
 *
 * Hidden during `'approval'` mode so the user can focus on the plan.
 * Set `maxEntries` to cap how many entries are shown (default 20).
 * Provide `renderEntry` for fully custom entry rendering.
 */
type ActivityFeedProps = Children &
  DivProps & {
    /** Maximum number of entries to display. @default 20 */
    maxEntries?: number
    /** Custom renderer for individual activity entries. */
    renderEntry?: (entry: ActivityEntry) => React.ReactNode
  }

const ACTIVITY_ICONS: Record<ActivityEntry['type'], string> = {
  intent: '🔍',
  plan: '💡',
  tool_start: '⚡',
  tool_complete: '✓',
  tool_error: '✗',
}

const ACTIVITY_ARIA_LABELS: Record<ActivityEntry['type'], string> = {
  intent: 'Search intent',
  plan: 'Plan created',
  tool_start: 'Tool started',
  tool_complete: 'Tool completed',
  tool_error: 'Tool failed',
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

  const labels = ak.labels
  const completed = entries.filter((e) => e.type === 'tool_complete').length
  const total = ak.state.plan?.calls.length || 0
  const latest = entries[entries.length - 1]

  // Single-line status summary
  const statusText = ak.state.mode === 'executing' && total > 0
    ? `${completed} ${labels.of} ${total} ${labels.complete}`
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
                  <span data-agentk-activity-icon="" aria-label={ACTIVITY_ARIA_LABELS[entry.type]}>
                    {ACTIVITY_ICONS[entry.type]}
                  </span>
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
 * Discovers WebMCP tools from the browser's `navigator.modelContext` API.
 *
 * Returns an object with:
 * - `tools` — an array of `AgentKToolDef` discovered from the page.
 * - `available` — `true` when the WebMCP API is present in the browser.
 * - `refresh()` — re-scan for tools (e.g. after a page mutation).
 * - `executeTool(name, params)` — execute a tool via the WebMCP testing API.
 *
 * @example
 * ```tsx
 * function App() {
 *   const { tools, available } = useWebMCPTools()
 *   return <Command tools={tools} />
 * }
 * ```
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

/**
 * Access the full AgentK state and actions from any component inside
 * the `<Command>` tree.
 *
 * Returns an object with the current state, action dispatchers (`selectTool`,
 * `execute`, `cancel`, `reset`, `sendIntent`, `approvePlan`, `rejectPlan`),
 * and derived values like `agentHintVisible`, `labels`, and `formatToolName`.
 *
 * @throws {Error} If called outside a `<Command>` provider.
 *
 * @example
 * ```tsx
 * function MyWidget() {
 *   const { state, execute, cancel, labels } = useAgentK()
 *   if (state.mode === 'executing') return <p>{labels.executing}...</p>
 *   return <button onClick={execute}>Go</button>
 * }
 * ```
 */
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
  AgentHintProps,
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
