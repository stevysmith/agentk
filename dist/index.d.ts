import * as RadixDialog from '@radix-ui/react-dialog';
import * as React from 'react';
import { Primitive } from '@radix-ui/react-primitive';
import { A as AgentKToolCall, a as AgentKPlan, b as AgentKAgentConfig } from './types-DnREXcny.js';
export { c as AgentKProvider } from './types-DnREXcny.js';

type WebMCPModelContext = {
    registerTool: (tool: any) => void;
    unregisterTool: (name: string) => void;
    getTools?: () => any[];
    executeTool?: (name: string, params: string) => Promise<any>;
};
type WebMCPModelContextTesting = {
    listTools: () => any[];
    executeTool: (name: string, params: string) => Promise<any>;
};
declare global {
    interface Navigator {
        modelContext?: WebMCPModelContext;
        modelContextTesting?: WebMCPModelContextTesting;
    }
    interface Document {
        modelContext?: WebMCPModelContext;
    }
}
type Children = {
    children?: React.ReactNode;
};
type DivProps = React.ComponentPropsWithoutRef<typeof Primitive.div>;
type LoadingProps = Children & DivProps & {
    progress?: number;
    label?: string;
};
type EmptyProps = Children & DivProps & {};
type SeparatorProps = DivProps & {
    alwaysRender?: boolean;
};
type DialogProps = RadixDialog.DialogProps & CommandProps & {
    overlayClassName?: string;
    contentClassName?: string;
    container?: HTMLElement;
};
type ListProps = Children & DivProps & {
    label?: string;
};
type ItemProps = Children & Omit<DivProps, 'disabled' | 'onSelect' | 'value'> & {
    disabled?: boolean;
    onSelect?: (value: string) => void;
    value?: string;
    keywords?: string[];
    forceMount?: boolean;
};
type GroupProps = Children & Omit<DivProps, 'heading' | 'value'> & {
    heading?: React.ReactNode;
    value?: string;
    forceMount?: boolean;
};
type InputProps = Omit<React.ComponentPropsWithoutRef<typeof Primitive.input>, 'value' | 'onChange' | 'type'> & {
    value?: string;
    onValueChange?: (search: string) => void;
};
type CommandFilter = (value: string, search: string, keywords?: string[]) => number;
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
type AgentKMode = 'browse' | 'form' | 'executing' | 'result' | 'planning' | 'approval';
/**
 * User-facing label overrides for internationalisation.
 * Every key is optional — omitted keys fall back to their English defaults.
 */
type AgentKLabels = {
    cancel?: string;
    execute?: string;
    approve?: string;
    reject?: string;
    thinking?: string;
    noResults?: string;
    askAgent?: string;
    done?: string;
    executing?: string;
    result?: string;
    error?: string;
    step?: string;
    of?: string;
    complete?: string;
    planned?: string;
    actions?: string;
};
/**
 * JSON-Schema-style description of a tool's input parameters.
 * Only `'object'` schemas are supported — each key in `properties` describes one parameter.
 */
type ToolInputSchema = {
    type: 'object';
    description?: string;
    properties: Record<string, {
        type: string;
        description?: string;
        enum?: string[];
        minimum?: number;
        maximum?: number;
        default?: any;
    }>;
    required?: string[];
};
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
type AgentKToolDef = {
    /** Unique machine-readable identifier (e.g. `'set_brightness'`). */
    name: string;
    /** Human-readable label. Falls back to humanised `name` if omitted. */
    label?: string;
    /** Short text shown beneath the tool name in the list. */
    description?: string;
    /** JSON-Schema definition of the tool's input parameters. When omitted the tool executes with no parameters. */
    inputSchema?: ToolInputSchema;
    /** Icon rendered beside the tool name. Any valid React node. */
    icon?: React.ReactNode;
    /** Extra keywords used when filtering the palette (not displayed). */
    keywords?: string[];
};
/**
 * Snapshot of a single tool execution.
 *
 * Lifecycle: when a tool begins executing, a `ToolExecution` is created with
 * `startedAt` set.  On success `result` is populated; on failure `error` is
 * set instead.  The object is available through `useAgentK().state.execution`.
 */
type ToolExecution = {
    /** The `name` of the tool being executed. */
    toolName: string;
    /** Parameter values passed to the tool. */
    parameters: Record<string, any>;
    /** Populated on successful completion. */
    result?: any;
    /** Populated when execution fails. */
    error?: string;
    /** `Date.now()` timestamp of when execution began. */
    startedAt: number;
    /** @internal Monotonic counter for dedup — not part of the public API. */
    _seq?: number;
};
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
type ActivityEntry = {
    /** Unique identifier (auto-generated). */
    id: string;
    /** `Date.now()` when the entry was created. */
    timestamp: number;
    /** Discriminator for the kind of activity. */
    type: 'intent' | 'plan' | 'tool_start' | 'tool_complete' | 'tool_error';
    /** Present for tool-related entries. */
    toolName?: string;
    /** Parameters passed to the tool (tool entries only). */
    parameters?: Record<string, any>;
    /** Execution result (tool_complete only). */
    result?: any;
    /** Error message (tool_error only). */
    error?: string;
    /** Human-readable summary of the activity. */
    message: string;
};
type AgentKInternalState = {
    mode: AgentKMode;
    activeTool: AgentKToolDef | null;
    parameters: Record<string, any>;
    execution: ToolExecution | null;
    pendingPrompt: string | null;
    plan: AgentKPlan | null;
    planIndex: number;
    activityLog: ActivityEntry[];
};
type AgentKContextValue = {
    state: AgentKInternalState;
    setMode: (mode: AgentKMode) => void;
    selectTool: (tool: AgentKToolDef) => void;
    setParameter: (name: string, value: any) => void;
    execute: () => void;
    reset: () => void;
    /** Abort the currently executing tool call and return to browse mode. */
    cancel: () => void;
    webmcpAvailable: boolean;
    agentAvailable: boolean;
    sendIntent: (prompt: string) => void;
    approvePlan: () => void;
    rejectPlan: () => void;
    modifyPlanCall: (index: number, params: Record<string, any>) => void;
    activityLog: ActivityEntry[];
    tools: AgentKToolDef[];
    /** True when no tools match the current search but the agent can interpret it */
    agentHintVisible: boolean;
    /** Resolved i18n labels (defaults merged with user overrides). */
    labels: Required<AgentKLabels>;
    /** Custom tool-name formatter. Falls back to `humanizeToolName`. */
    formatToolName: (name: string) => string;
    /** @internal — validation gate registered by ToolForm. Returns true if valid. */
    _validateRef: React.MutableRefObject<(() => boolean) | null>;
};
type ToolItemProps = Children & Omit<DivProps, 'disabled' | 'onSelect' | 'value'> & {
    disabled?: boolean;
    onSelect?: (value: string) => void;
    value?: string;
    keywords?: string[];
    forceMount?: boolean;
    /** The WebMCP tool definition */
    tool: AgentKToolDef;
    /** Called after tool execution completes */
    onExecuted?: (result: any) => void;
};
type ToolFormProps = Children & DivProps & {
    /** Custom field renderer */
    renderField?: (name: string, schema: ToolInputSchema['properties'][string], value: any, onChange: (value: any) => void) => React.ReactNode;
    /**
     * Custom renderer for the cancel + submit action row. When provided, fully
     * replaces the default `[data-agentk-form-actions]` block.
     */
    renderActions?: (actions: {
        cancel: () => void;
        submit: () => void;
        canSubmit: boolean;
    }) => React.ReactNode;
};
type ToolResultProps = Children & DivProps & {
    /** Custom result renderer */
    renderResult?: (execution: ToolExecution) => React.ReactNode;
    /**
     * Custom renderer for the dismiss button. When provided, replaces the
     * default `[data-agentk-result-dismiss]` button.
     */
    renderDismiss?: (actions: {
        dismiss: () => void;
    }) => React.ReactNode;
    /**
     * Automatically dismiss the result panel after the given number of
     * milliseconds. Only fires for successful results (errors stay visible).
     * Set to `0` or omit to disable.
     */
    autoDismissAfterMs?: number;
};
type CommandProps = Children & DivProps & {
    label?: string;
    shouldFilter?: boolean;
    filter?: CommandFilter;
    defaultValue?: string;
    value?: string;
    onValueChange?: (value: string) => void;
    loop?: boolean;
    disablePointerSelection?: boolean;
    vimBindings?: boolean;
    onEmpty?: (search: string) => void;
    /** Tool definitions to register in the palette */
    tools?: AgentKToolDef[];
    /**
     * Execute a tool. If omitted, uses WebMCP navigator.modelContextTesting.executeTool.
     *
     * Return value determines how the result is rendered:
     * - `string` — displayed as plain text
     * - `Record<string, unknown>` — displayed as formatted JSON
     */
    onToolExecute?: (toolName: string, parameters: Record<string, any>, signal?: AbortSignal) => Promise<string | Record<string, unknown>>;
    /** Called when a tool execution completes */
    onToolResult?: (toolName: string, result: any) => void;
    /** Called when a tool execution fails */
    onToolError?: (toolName: string, error: string) => void;
    /** Called when mode changes */
    onModeChange?: (mode: AgentKMode) => void;
    /** LLM agent config. If omitted, agent mode is disabled. */
    agent?: AgentKAgentConfig;
    /** Called when the LLM returns a plan */
    onAgentPlan?: (plan: AgentKPlan) => void;
    /** Called when user approves a plan */
    onAgentApprove?: (plan: AgentKPlan) => void;
    /** Called when user rejects a plan */
    onAgentReject?: (plan: AgentKPlan) => void;
    /**
     * Execution timeout in milliseconds. Defaults to `30000` (30 s).
     * Set to `0` or `Infinity` to disable.
     */
    timeout?: number;
    /**
     * Override the default UI strings for internationalisation.
     * Any key that is omitted falls back to its English default.
     *
     * @example
     * ```tsx
     * <Command labels={{ execute: 'Ausführen', cancel: 'Abbrechen' }} />
     * ```
     */
    labels?: AgentKLabels;
    /**
     * Custom function to convert machine tool names to display strings.
     * When provided, replaces the built-in `humanizeToolName` everywhere.
     *
     * @example
     * ```tsx
     * <Command formatToolName={(n) => n.toUpperCase()} />
     * ```
     */
    formatToolName?: (name: string) => string;
};
type State = {
    search: string;
    value: string;
    selectedItemId?: string;
    filtered: {
        count: number;
        items: Map<string, number>;
        groups: Set<string>;
    };
};
declare const defaultFilter: CommandFilter;
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
declare const Command: React.ForwardRefExoticComponent<Children & Omit<Omit<React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>, "ref"> & {
    ref?: ((instance: HTMLDivElement | null) => void | React.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES[keyof React.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES]) | React.RefObject<HTMLDivElement> | null | undefined;
} & {
    asChild?: boolean;
}, "ref"> & {
    label?: string;
    shouldFilter?: boolean;
    filter?: CommandFilter;
    defaultValue?: string;
    value?: string;
    onValueChange?: (value: string) => void;
    loop?: boolean;
    disablePointerSelection?: boolean;
    vimBindings?: boolean;
    onEmpty?: (search: string) => void;
    /** Tool definitions to register in the palette */
    tools?: AgentKToolDef[];
    /**
     * Execute a tool. If omitted, uses WebMCP navigator.modelContextTesting.executeTool.
     *
     * Return value determines how the result is rendered:
     * - `string` — displayed as plain text
     * - `Record<string, unknown>` — displayed as formatted JSON
     */
    onToolExecute?: (toolName: string, parameters: Record<string, any>, signal?: AbortSignal) => Promise<string | Record<string, unknown>>;
    /** Called when a tool execution completes */
    onToolResult?: (toolName: string, result: any) => void;
    /** Called when a tool execution fails */
    onToolError?: (toolName: string, error: string) => void;
    /** Called when mode changes */
    onModeChange?: (mode: AgentKMode) => void;
    /** LLM agent config. If omitted, agent mode is disabled. */
    agent?: AgentKAgentConfig;
    /** Called when the LLM returns a plan */
    onAgentPlan?: (plan: AgentKPlan) => void;
    /** Called when user approves a plan */
    onAgentApprove?: (plan: AgentKPlan) => void;
    /** Called when user rejects a plan */
    onAgentReject?: (plan: AgentKPlan) => void;
    /**
     * Execution timeout in milliseconds. Defaults to `30000` (30 s).
     * Set to `0` or `Infinity` to disable.
     */
    timeout?: number;
    /**
     * Override the default UI strings for internationalisation.
     * Any key that is omitted falls back to its English default.
     *
     * @example
     * ```tsx
     * <Command labels={{ execute: 'Ausführen', cancel: 'Abbrechen' }} />
     * ```
     */
    labels?: AgentKLabels;
    /**
     * Custom function to convert machine tool names to display strings.
     * When provided, replaces the built-in `humanizeToolName` everywhere.
     *
     * @example
     * ```tsx
     * <Command formatToolName={(n) => n.toUpperCase()} />
     * ```
     */
    formatToolName?: (name: string) => string;
} & React.RefAttributes<HTMLDivElement>>;
declare const Item: React.ForwardRefExoticComponent<Children & Omit<Omit<Omit<React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>, "ref"> & {
    ref?: ((instance: HTMLDivElement | null) => void | React.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES[keyof React.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES]) | React.RefObject<HTMLDivElement> | null | undefined;
} & {
    asChild?: boolean;
}, "ref">, "onSelect" | "disabled" | "value"> & {
    disabled?: boolean;
    onSelect?: (value: string) => void;
    value?: string;
    keywords?: string[];
    forceMount?: boolean;
} & React.RefAttributes<HTMLDivElement>>;
declare const CommandGroup: React.ForwardRefExoticComponent<Children & Omit<Omit<Omit<React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>, "ref"> & {
    ref?: ((instance: HTMLDivElement | null) => void | React.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES[keyof React.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES]) | React.RefObject<HTMLDivElement> | null | undefined;
} & {
    asChild?: boolean;
}, "ref">, "value" | "heading"> & {
    heading?: React.ReactNode;
    value?: string;
    forceMount?: boolean;
} & React.RefAttributes<HTMLDivElement>>;
declare const Separator: React.ForwardRefExoticComponent<Omit<Omit<React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>, "ref"> & {
    ref?: ((instance: HTMLDivElement | null) => void | React.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES[keyof React.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES]) | React.RefObject<HTMLDivElement> | null | undefined;
} & {
    asChild?: boolean;
}, "ref"> & {
    alwaysRender?: boolean;
} & React.RefAttributes<HTMLDivElement>>;
declare const Input: React.ForwardRefExoticComponent<Omit<Omit<Omit<React.DetailedHTMLProps<React.InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>, "ref"> & {
    ref?: ((instance: HTMLInputElement | null) => void | React.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES[keyof React.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES]) | React.RefObject<HTMLInputElement> | null | undefined;
} & {
    asChild?: boolean;
}, "ref">, "onChange" | "value" | "type"> & {
    value?: string;
    onValueChange?: (search: string) => void;
} & React.RefAttributes<HTMLInputElement>>;
declare const List: React.ForwardRefExoticComponent<Children & Omit<Omit<React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>, "ref"> & {
    ref?: ((instance: HTMLDivElement | null) => void | React.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES[keyof React.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES]) | React.RefObject<HTMLDivElement> | null | undefined;
} & {
    asChild?: boolean;
}, "ref"> & {
    label?: string;
} & React.RefAttributes<HTMLDivElement>>;
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
declare const Dialog: React.ForwardRefExoticComponent<RadixDialog.DialogProps & Children & Omit<Omit<React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>, "ref"> & {
    ref?: ((instance: HTMLDivElement | null) => void | React.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES[keyof React.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES]) | React.RefObject<HTMLDivElement> | null | undefined;
} & {
    asChild?: boolean;
}, "ref"> & {
    label?: string;
    shouldFilter?: boolean;
    filter?: CommandFilter;
    defaultValue?: string;
    value?: string;
    onValueChange?: (value: string) => void;
    loop?: boolean;
    disablePointerSelection?: boolean;
    vimBindings?: boolean;
    onEmpty?: (search: string) => void;
    /** Tool definitions to register in the palette */
    tools?: AgentKToolDef[];
    /**
     * Execute a tool. If omitted, uses WebMCP navigator.modelContextTesting.executeTool.
     *
     * Return value determines how the result is rendered:
     * - `string` — displayed as plain text
     * - `Record<string, unknown>` — displayed as formatted JSON
     */
    onToolExecute?: (toolName: string, parameters: Record<string, any>, signal?: AbortSignal) => Promise<string | Record<string, unknown>>;
    /** Called when a tool execution completes */
    onToolResult?: (toolName: string, result: any) => void;
    /** Called when a tool execution fails */
    onToolError?: (toolName: string, error: string) => void;
    /** Called when mode changes */
    onModeChange?: (mode: AgentKMode) => void;
    /** LLM agent config. If omitted, agent mode is disabled. */
    agent?: AgentKAgentConfig;
    /** Called when the LLM returns a plan */
    onAgentPlan?: (plan: AgentKPlan) => void;
    /** Called when user approves a plan */
    onAgentApprove?: (plan: AgentKPlan) => void;
    /** Called when user rejects a plan */
    onAgentReject?: (plan: AgentKPlan) => void;
    /**
     * Execution timeout in milliseconds. Defaults to `30000` (30 s).
     * Set to `0` or `Infinity` to disable.
     */
    timeout?: number;
    /**
     * Override the default UI strings for internationalisation.
     * Any key that is omitted falls back to its English default.
     *
     * @example
     * ```tsx
     * <Command labels={{ execute: 'Ausführen', cancel: 'Abbrechen' }} />
     * ```
     */
    labels?: AgentKLabels;
    /**
     * Custom function to convert machine tool names to display strings.
     * When provided, replaces the built-in `humanizeToolName` everywhere.
     *
     * @example
     * ```tsx
     * <Command formatToolName={(n) => n.toUpperCase()} />
     * ```
     */
    formatToolName?: (name: string) => string;
} & {
    overlayClassName?: string;
    contentClassName?: string;
    container?: HTMLElement;
} & React.RefAttributes<HTMLDivElement>>;
declare const Empty: React.ForwardRefExoticComponent<Children & Omit<Omit<React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>, "ref"> & {
    ref?: ((instance: HTMLDivElement | null) => void | React.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES[keyof React.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES]) | React.RefObject<HTMLDivElement> | null | undefined;
} & {
    asChild?: boolean;
}, "ref"> & React.RefAttributes<HTMLDivElement>>;
/**
 * Shown when no tools match the current query but the agent can interpret it.
 * Replaces the dead-end "No matching tools." with an actionable prompt card.
 *
 * The component renders nothing unless the agent is configured and the palette
 * search yields zero tool matches.  Style with `[data-agentk-agent-hint]`.
 */
type AgentHintProps = Children & DivProps;
declare const AgentHint: React.ForwardRefExoticComponent<Children & Omit<Omit<React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>, "ref"> & {
    ref?: ((instance: HTMLDivElement | null) => void | React.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES[keyof React.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES]) | React.RefObject<HTMLDivElement> | null | undefined;
} & {
    asChild?: boolean;
}, "ref"> & React.RefAttributes<HTMLDivElement>>;
/**
 * A `Command.Item` that triggers `sendIntent` with a predetermined query when selected.
 * Gets the same styling as other items in the list — consistent font, padding, hover state.
 * Must be rendered inside a `<Command.List>`.
 *
 * @example
 * ```tsx
 * <Command.IntentTrigger query="summarise this page">
 *   Summarise
 * </Command.IntentTrigger>
 * ```
 */
type IntentTriggerProps = Children & Omit<ItemProps, 'onSelect' | 'value'> & {
    /** The intent string to send when selected. */
    query: string;
};
declare const IntentTrigger: React.ForwardRefExoticComponent<Children & Omit<ItemProps, "onSelect" | "value"> & {
    /** The intent string to send when selected. */
    query: string;
} & React.RefAttributes<HTMLDivElement>>;
declare const Loading: React.ForwardRefExoticComponent<Children & Omit<Omit<React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>, "ref"> & {
    ref?: ((instance: HTMLDivElement | null) => void | React.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES[keyof React.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES]) | React.RefObject<HTMLDivElement> | null | undefined;
} & {
    asChild?: boolean;
}, "ref"> & {
    progress?: number;
    label?: string;
} & React.RefAttributes<HTMLDivElement>>;
/**
 * A command item that represents a WebMCP tool.
 *
 * When selected, transitions to form mode if the tool has parameters,
 * or executes immediately if it doesn't.  Renders the tool's icon, name,
 * and description by default, but accepts arbitrary children for full control.
 */
declare const ToolItem: React.ForwardRefExoticComponent<Children & Omit<Omit<Omit<React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>, "ref"> & {
    ref?: ((instance: HTMLDivElement | null) => void | React.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES[keyof React.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES]) | React.RefObject<HTMLDivElement> | null | undefined;
} & {
    asChild?: boolean;
}, "ref">, "onSelect" | "disabled" | "value"> & {
    disabled?: boolean;
    onSelect?: (value: string) => void;
    value?: string;
    keywords?: string[];
    forceMount?: boolean;
    /** The WebMCP tool definition */
    tool: AgentKToolDef;
    /** Called after tool execution completes */
    onExecuted?: (result: any) => void;
} & React.RefAttributes<HTMLDivElement>>;
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
declare const ToolForm: React.ForwardRefExoticComponent<Children & Omit<Omit<React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>, "ref"> & {
    ref?: ((instance: HTMLDivElement | null) => void | React.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES[keyof React.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES]) | React.RefObject<HTMLDivElement> | null | undefined;
} & {
    asChild?: boolean;
}, "ref"> & {
    /** Custom field renderer */
    renderField?: (name: string, schema: ToolInputSchema["properties"][string], value: any, onChange: (value: any) => void) => React.ReactNode;
    /**
     * Custom renderer for the cancel + submit action row. When provided, fully
     * replaces the default `[data-agentk-form-actions]` block.
     */
    renderActions?: (actions: {
        cancel: () => void;
        submit: () => void;
        canSubmit: boolean;
    }) => React.ReactNode;
} & React.RefAttributes<HTMLDivElement>>;
/**
 * Renders the result of a tool execution.
 *
 * Visible when mode is `'result'` or `'executing'`.  During execution it shows
 * a spinner and progress indicator; afterwards it shows the result or error.
 * Provide `renderResult` for fully custom result rendering.
 */
declare const ToolResult: React.ForwardRefExoticComponent<Children & Omit<Omit<React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>, "ref"> & {
    ref?: ((instance: HTMLDivElement | null) => void | React.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES[keyof React.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES]) | React.RefObject<HTMLDivElement> | null | undefined;
} & {
    asChild?: boolean;
}, "ref"> & {
    /** Custom result renderer */
    renderResult?: (execution: ToolExecution) => React.ReactNode;
    /**
     * Custom renderer for the dismiss button. When provided, replaces the
     * default `[data-agentk-result-dismiss]` button.
     */
    renderDismiss?: (actions: {
        dismiss: () => void;
    }) => React.ReactNode;
    /**
     * Automatically dismiss the result panel after the given number of
     * milliseconds. Only fires for successful results (errors stay visible).
     * Set to `0` or omit to disable.
     */
    autoDismissAfterMs?: number;
} & React.RefAttributes<HTMLDivElement>>;
/**
 * Displays the LLM agent's proposed plan for human review.
 *
 * Renders in two sub-modes:
 * - `planning` — shows a spinner while the LLM is thinking.
 * - `approval` — shows the list of proposed tool calls with Approve / Reject buttons.
 *
 * Provide `renderCall` and/or `renderSummary` for custom rendering.
 */
type ApprovalProps = Children & DivProps & {
    /** Custom renderer for each planned tool call. */
    renderCall?: (call: AgentKToolCall, index: number) => React.ReactNode;
    /** Custom renderer for the plan summary line. */
    renderSummary?: (plan: AgentKPlan) => React.ReactNode;
    /**
     * Custom renderer for the approve + reject action row. When provided, fully
     * replaces the default `[data-agentk-approval-actions]` block.
     */
    renderActions?: (actions: {
        approve: () => void;
        reject: () => void;
    }) => React.ReactNode;
};
declare const Approval: React.ForwardRefExoticComponent<Children & Omit<Omit<React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>, "ref"> & {
    ref?: ((instance: HTMLDivElement | null) => void | React.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES[keyof React.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES]) | React.RefObject<HTMLDivElement> | null | undefined;
} & {
    asChild?: boolean;
}, "ref"> & {
    /** Custom renderer for each planned tool call. */
    renderCall?: (call: AgentKToolCall, index: number) => React.ReactNode;
    /** Custom renderer for the plan summary line. */
    renderSummary?: (plan: AgentKPlan) => React.ReactNode;
    /**
     * Custom renderer for the approve + reject action row. When provided, fully
     * replaces the default `[data-agentk-approval-actions]` block.
     */
    renderActions?: (actions: {
        approve: () => void;
        reject: () => void;
    }) => React.ReactNode;
} & React.RefAttributes<HTMLDivElement>>;
/**
 * Scrollable log of agent activity (intents, plans, tool calls).
 *
 * Hidden during `'approval'` mode so the user can focus on the plan.
 * Set `maxEntries` to cap how many entries are shown (default 20).
 * Provide `renderEntry` for fully custom entry rendering.
 */
type ActivityFeedProps = Children & DivProps & {
    /** Maximum number of entries to display. @default 20 */
    maxEntries?: number;
    /** Custom renderer for individual activity entries. */
    renderEntry?: (entry: ActivityEntry) => React.ReactNode;
};
declare const ActivityFeed: React.ForwardRefExoticComponent<Children & Omit<Omit<React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>, "ref"> & {
    ref?: ((instance: HTMLDivElement | null) => void | React.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES[keyof React.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES]) | React.RefObject<HTMLDivElement> | null | undefined;
} & {
    asChild?: boolean;
}, "ref"> & {
    /** Maximum number of entries to display. @default 20 */
    maxEntries?: number;
    /** Custom renderer for individual activity entries. */
    renderEntry?: (entry: ActivityEntry) => React.ReactNode;
} & React.RefAttributes<HTMLDivElement>>;
/**
 * Discovers WebMCP tools from the browser's `document.modelContext` API
 * (falling back to the older `navigator.modelContext` location).
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
declare function useWebMCPTools(): {
    tools: AgentKToolDef[];
    available: boolean;
    refresh: () => void;
    executeTool: (name: string, parameters: Record<string, any>) => Promise<any>;
};
declare const pkg: React.ForwardRefExoticComponent<Children & Omit<Omit<React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>, "ref"> & {
    ref?: ((instance: HTMLDivElement | null) => void | React.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES[keyof React.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES]) | React.RefObject<HTMLDivElement> | null | undefined;
} & {
    asChild?: boolean;
}, "ref"> & {
    label?: string;
    shouldFilter?: boolean;
    filter?: CommandFilter;
    defaultValue?: string;
    value?: string;
    onValueChange?: (value: string) => void;
    loop?: boolean;
    disablePointerSelection?: boolean;
    vimBindings?: boolean;
    onEmpty?: (search: string) => void;
    /** Tool definitions to register in the palette */
    tools?: AgentKToolDef[];
    /**
     * Execute a tool. If omitted, uses WebMCP navigator.modelContextTesting.executeTool.
     *
     * Return value determines how the result is rendered:
     * - `string` — displayed as plain text
     * - `Record<string, unknown>` — displayed as formatted JSON
     */
    onToolExecute?: (toolName: string, parameters: Record<string, any>, signal?: AbortSignal) => Promise<string | Record<string, unknown>>;
    /** Called when a tool execution completes */
    onToolResult?: (toolName: string, result: any) => void;
    /** Called when a tool execution fails */
    onToolError?: (toolName: string, error: string) => void;
    /** Called when mode changes */
    onModeChange?: (mode: AgentKMode) => void;
    /** LLM agent config. If omitted, agent mode is disabled. */
    agent?: AgentKAgentConfig;
    /** Called when the LLM returns a plan */
    onAgentPlan?: (plan: AgentKPlan) => void;
    /** Called when user approves a plan */
    onAgentApprove?: (plan: AgentKPlan) => void;
    /** Called when user rejects a plan */
    onAgentReject?: (plan: AgentKPlan) => void;
    /**
     * Execution timeout in milliseconds. Defaults to `30000` (30 s).
     * Set to `0` or `Infinity` to disable.
     */
    timeout?: number;
    /**
     * Override the default UI strings for internationalisation.
     * Any key that is omitted falls back to its English default.
     *
     * @example
     * ```tsx
     * <Command labels={{ execute: 'Ausführen', cancel: 'Abbrechen' }} />
     * ```
     */
    labels?: AgentKLabels;
    /**
     * Custom function to convert machine tool names to display strings.
     * When provided, replaces the built-in `humanizeToolName` everywhere.
     *
     * @example
     * ```tsx
     * <Command formatToolName={(n) => n.toUpperCase()} />
     * ```
     */
    formatToolName?: (name: string) => string;
} & React.RefAttributes<HTMLDivElement>> & {
    List: React.ForwardRefExoticComponent<Children & Omit<Omit<React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>, "ref"> & {
        ref?: ((instance: HTMLDivElement | null) => void | React.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES[keyof React.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES]) | React.RefObject<HTMLDivElement> | null | undefined;
    } & {
        asChild?: boolean;
    }, "ref"> & {
        label?: string;
    } & React.RefAttributes<HTMLDivElement>>;
    Item: React.ForwardRefExoticComponent<Children & Omit<Omit<Omit<React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>, "ref"> & {
        ref?: ((instance: HTMLDivElement | null) => void | React.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES[keyof React.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES]) | React.RefObject<HTMLDivElement> | null | undefined;
    } & {
        asChild?: boolean;
    }, "ref">, "onSelect" | "disabled" | "value"> & {
        disabled?: boolean;
        onSelect?: (value: string) => void;
        value?: string;
        keywords?: string[];
        forceMount?: boolean;
    } & React.RefAttributes<HTMLDivElement>>;
    Input: React.ForwardRefExoticComponent<Omit<Omit<Omit<React.DetailedHTMLProps<React.InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>, "ref"> & {
        ref?: ((instance: HTMLInputElement | null) => void | React.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES[keyof React.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES]) | React.RefObject<HTMLInputElement> | null | undefined;
    } & {
        asChild?: boolean;
    }, "ref">, "onChange" | "value" | "type"> & {
        value?: string;
        onValueChange?: (search: string) => void;
    } & React.RefAttributes<HTMLInputElement>>;
    Group: React.ForwardRefExoticComponent<Children & Omit<Omit<Omit<React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>, "ref"> & {
        ref?: ((instance: HTMLDivElement | null) => void | React.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES[keyof React.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES]) | React.RefObject<HTMLDivElement> | null | undefined;
    } & {
        asChild?: boolean;
    }, "ref">, "value" | "heading"> & {
        heading?: React.ReactNode;
        value?: string;
        forceMount?: boolean;
    } & React.RefAttributes<HTMLDivElement>>;
    Separator: React.ForwardRefExoticComponent<Omit<Omit<React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>, "ref"> & {
        ref?: ((instance: HTMLDivElement | null) => void | React.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES[keyof React.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES]) | React.RefObject<HTMLDivElement> | null | undefined;
    } & {
        asChild?: boolean;
    }, "ref"> & {
        alwaysRender?: boolean;
    } & React.RefAttributes<HTMLDivElement>>;
    Dialog: React.ForwardRefExoticComponent<RadixDialog.DialogProps & Children & Omit<Omit<React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>, "ref"> & {
        ref?: ((instance: HTMLDivElement | null) => void | React.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES[keyof React.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES]) | React.RefObject<HTMLDivElement> | null | undefined;
    } & {
        asChild?: boolean;
    }, "ref"> & {
        label?: string;
        shouldFilter?: boolean;
        filter?: CommandFilter;
        defaultValue?: string;
        value?: string;
        onValueChange?: (value: string) => void;
        loop?: boolean;
        disablePointerSelection?: boolean;
        vimBindings?: boolean;
        onEmpty?: (search: string) => void;
        /** Tool definitions to register in the palette */
        tools?: AgentKToolDef[];
        /**
         * Execute a tool. If omitted, uses WebMCP navigator.modelContextTesting.executeTool.
         *
         * Return value determines how the result is rendered:
         * - `string` — displayed as plain text
         * - `Record<string, unknown>` — displayed as formatted JSON
         */
        onToolExecute?: (toolName: string, parameters: Record<string, any>, signal?: AbortSignal) => Promise<string | Record<string, unknown>>;
        /** Called when a tool execution completes */
        onToolResult?: (toolName: string, result: any) => void;
        /** Called when a tool execution fails */
        onToolError?: (toolName: string, error: string) => void;
        /** Called when mode changes */
        onModeChange?: (mode: AgentKMode) => void;
        /** LLM agent config. If omitted, agent mode is disabled. */
        agent?: AgentKAgentConfig;
        /** Called when the LLM returns a plan */
        onAgentPlan?: (plan: AgentKPlan) => void;
        /** Called when user approves a plan */
        onAgentApprove?: (plan: AgentKPlan) => void;
        /** Called when user rejects a plan */
        onAgentReject?: (plan: AgentKPlan) => void;
        /**
         * Execution timeout in milliseconds. Defaults to `30000` (30 s).
         * Set to `0` or `Infinity` to disable.
         */
        timeout?: number;
        /**
         * Override the default UI strings for internationalisation.
         * Any key that is omitted falls back to its English default.
         *
         * @example
         * ```tsx
         * <Command labels={{ execute: 'Ausführen', cancel: 'Abbrechen' }} />
         * ```
         */
        labels?: AgentKLabels;
        /**
         * Custom function to convert machine tool names to display strings.
         * When provided, replaces the built-in `humanizeToolName` everywhere.
         *
         * @example
         * ```tsx
         * <Command formatToolName={(n) => n.toUpperCase()} />
         * ```
         */
        formatToolName?: (name: string) => string;
    } & {
        overlayClassName?: string;
        contentClassName?: string;
        container?: HTMLElement;
    } & React.RefAttributes<HTMLDivElement>>;
    Empty: React.ForwardRefExoticComponent<Children & Omit<Omit<React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>, "ref"> & {
        ref?: ((instance: HTMLDivElement | null) => void | React.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES[keyof React.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES]) | React.RefObject<HTMLDivElement> | null | undefined;
    } & {
        asChild?: boolean;
    }, "ref"> & React.RefAttributes<HTMLDivElement>>;
    Loading: React.ForwardRefExoticComponent<Children & Omit<Omit<React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>, "ref"> & {
        ref?: ((instance: HTMLDivElement | null) => void | React.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES[keyof React.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES]) | React.RefObject<HTMLDivElement> | null | undefined;
    } & {
        asChild?: boolean;
    }, "ref"> & {
        progress?: number;
        label?: string;
    } & React.RefAttributes<HTMLDivElement>>;
    Tool: React.ForwardRefExoticComponent<Children & Omit<Omit<Omit<React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>, "ref"> & {
        ref?: ((instance: HTMLDivElement | null) => void | React.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES[keyof React.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES]) | React.RefObject<HTMLDivElement> | null | undefined;
    } & {
        asChild?: boolean;
    }, "ref">, "onSelect" | "disabled" | "value"> & {
        disabled?: boolean;
        onSelect?: (value: string) => void;
        value?: string;
        keywords?: string[];
        forceMount?: boolean;
        /** The WebMCP tool definition */
        tool: AgentKToolDef;
        /** Called after tool execution completes */
        onExecuted?: (result: any) => void;
    } & React.RefAttributes<HTMLDivElement>>;
    ToolForm: React.ForwardRefExoticComponent<Children & Omit<Omit<React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>, "ref"> & {
        ref?: ((instance: HTMLDivElement | null) => void | React.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES[keyof React.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES]) | React.RefObject<HTMLDivElement> | null | undefined;
    } & {
        asChild?: boolean;
    }, "ref"> & {
        /** Custom field renderer */
        renderField?: (name: string, schema: ToolInputSchema["properties"][string], value: any, onChange: (value: any) => void) => React.ReactNode;
        /**
         * Custom renderer for the cancel + submit action row. When provided, fully
         * replaces the default `[data-agentk-form-actions]` block.
         */
        renderActions?: (actions: {
            cancel: () => void;
            submit: () => void;
            canSubmit: boolean;
        }) => React.ReactNode;
    } & React.RefAttributes<HTMLDivElement>>;
    ToolResult: React.ForwardRefExoticComponent<Children & Omit<Omit<React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>, "ref"> & {
        ref?: ((instance: HTMLDivElement | null) => void | React.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES[keyof React.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES]) | React.RefObject<HTMLDivElement> | null | undefined;
    } & {
        asChild?: boolean;
    }, "ref"> & {
        /** Custom result renderer */
        renderResult?: (execution: ToolExecution) => React.ReactNode;
        /**
         * Custom renderer for the dismiss button. When provided, replaces the
         * default `[data-agentk-result-dismiss]` button.
         */
        renderDismiss?: (actions: {
            dismiss: () => void;
        }) => React.ReactNode;
        /**
         * Automatically dismiss the result panel after the given number of
         * milliseconds. Only fires for successful results (errors stay visible).
         * Set to `0` or omit to disable.
         */
        autoDismissAfterMs?: number;
    } & React.RefAttributes<HTMLDivElement>>;
    Approval: React.ForwardRefExoticComponent<Children & Omit<Omit<React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>, "ref"> & {
        ref?: ((instance: HTMLDivElement | null) => void | React.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES[keyof React.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES]) | React.RefObject<HTMLDivElement> | null | undefined;
    } & {
        asChild?: boolean;
    }, "ref"> & {
        /** Custom renderer for each planned tool call. */
        renderCall?: (call: AgentKToolCall, index: number) => React.ReactNode;
        /** Custom renderer for the plan summary line. */
        renderSummary?: (plan: AgentKPlan) => React.ReactNode;
        /**
         * Custom renderer for the approve + reject action row. When provided, fully
         * replaces the default `[data-agentk-approval-actions]` block.
         */
        renderActions?: (actions: {
            approve: () => void;
            reject: () => void;
        }) => React.ReactNode;
    } & React.RefAttributes<HTMLDivElement>>;
    ActivityFeed: React.ForwardRefExoticComponent<Children & Omit<Omit<React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>, "ref"> & {
        ref?: ((instance: HTMLDivElement | null) => void | React.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES[keyof React.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES]) | React.RefObject<HTMLDivElement> | null | undefined;
    } & {
        asChild?: boolean;
    }, "ref"> & {
        /** Maximum number of entries to display. @default 20 */
        maxEntries?: number;
        /** Custom renderer for individual activity entries. */
        renderEntry?: (entry: ActivityEntry) => React.ReactNode;
    } & React.RefAttributes<HTMLDivElement>>;
    AgentHint: React.ForwardRefExoticComponent<Children & Omit<Omit<React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>, "ref"> & {
        ref?: ((instance: HTMLDivElement | null) => void | React.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES[keyof React.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES]) | React.RefObject<HTMLDivElement> | null | undefined;
    } & {
        asChild?: boolean;
    }, "ref"> & React.RefAttributes<HTMLDivElement>>;
    IntentTrigger: React.ForwardRefExoticComponent<Children & Omit<ItemProps, "onSelect" | "value"> & {
        /** The intent string to send when selected. */
        query: string;
    } & React.RefAttributes<HTMLDivElement>>;
};
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
declare function useAgentK(): AgentKContextValue;

declare function useCmdk<T = any>(selector: (state: State) => T): T;

export { type ActivityEntry, type ActivityFeedProps, type AgentHintProps, AgentKAgentConfig, type AgentKLabels, type AgentKMode, AgentKPlan, AgentKToolCall, type AgentKToolDef, type ApprovalProps, pkg as Command, ActivityFeed as CommandActivityFeed, AgentHint as CommandAgentHint, Approval as CommandApproval, Dialog as CommandDialog, Empty as CommandEmpty, type CommandFilter, CommandGroup, Input as CommandInput, IntentTrigger as CommandIntentTrigger, Item as CommandItem, List as CommandList, Loading as CommandLoading, type CommandProps, Command as CommandRoot, Separator as CommandSeparator, ToolItem as CommandTool, ToolForm as CommandToolForm, ToolResult as CommandToolResult, type DialogProps, type EmptyProps, type GroupProps, type InputProps, type IntentTriggerProps, type ItemProps, type ListProps, type LoadingProps, type SeparatorProps, type ToolExecution, type ToolFormProps, type ToolInputSchema, type ToolItemProps, type ToolResultProps, defaultFilter, useAgentK, useCmdk as useCommandState, useWebMCPTools };
