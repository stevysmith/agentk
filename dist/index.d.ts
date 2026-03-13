import * as RadixDialog from '@radix-ui/react-dialog';
import * as React from 'react';
import { Primitive } from '@radix-ui/react-primitive';
import { AgentKToolCall, AgentKPlan, AgentKAgentConfig } from './providers.js';
export { AgentKProvider } from './providers.js';

declare global {
    interface Navigator {
        modelContext?: {
            registerTool: (tool: any) => void;
            unregisterTool: (name: string) => void;
        };
        modelContextTesting?: {
            listTools: () => any[];
            executeTool: (name: string, params: string) => Promise<any>;
        };
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
type AgentKMode = 'browse' | 'form' | 'executing' | 'result' | 'planning' | 'approval';
type ToolInputSchema = {
    type: 'object';
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
type AgentKToolDef = {
    name: string;
    /** Human-readable label. Falls back to humanized `name` if omitted. */
    label?: string;
    description?: string;
    inputSchema?: ToolInputSchema;
    icon?: React.ReactNode;
    keywords?: string[];
};
type ToolExecution = {
    toolName: string;
    parameters: Record<string, any>;
    result?: any;
    error?: string;
    startedAt: number;
};
type ActivityEntry = {
    id: string;
    timestamp: number;
    type: 'intent' | 'plan' | 'tool_start' | 'tool_complete' | 'tool_error';
    toolName?: string;
    parameters?: Record<string, any>;
    result?: any;
    error?: string;
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
};
type ToolResultProps = Children & DivProps & {
    /** Custom result renderer */
    renderResult?: (execution: ToolExecution) => React.ReactNode;
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
    /** Execute a tool. If omitted, uses WebMCP navigator.modelContextTesting.executeTool */
    onToolExecute?: (toolName: string, parameters: Record<string, any>) => Promise<any>;
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
    /** Execute a tool. If omitted, uses WebMCP navigator.modelContextTesting.executeTool */
    onToolExecute?: (toolName: string, parameters: Record<string, any>) => Promise<any>;
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
    /** Execute a tool. If omitted, uses WebMCP navigator.modelContextTesting.executeTool */
    onToolExecute?: (toolName: string, parameters: Record<string, any>) => Promise<any>;
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
declare const AgentHint: React.ForwardRefExoticComponent<Children & Omit<Omit<React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>, "ref"> & {
    ref?: ((instance: HTMLDivElement | null) => void | React.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES[keyof React.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES]) | React.RefObject<HTMLDivElement> | null | undefined;
} & {
    asChild?: boolean;
}, "ref"> & React.RefAttributes<HTMLDivElement>>;
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
 * When selected, transitions to form mode if the tool has parameters,
 * or executes immediately if it doesn't.
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
 * Only visible when mode is 'form'. Generates fields from the tool's inputSchema.
 */
declare const ToolForm: React.ForwardRefExoticComponent<Children & Omit<Omit<React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>, "ref"> & {
    ref?: ((instance: HTMLDivElement | null) => void | React.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES[keyof React.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES]) | React.RefObject<HTMLDivElement> | null | undefined;
} & {
    asChild?: boolean;
}, "ref"> & {
    /** Custom field renderer */
    renderField?: (name: string, schema: ToolInputSchema["properties"][string], value: any, onChange: (value: any) => void) => React.ReactNode;
} & React.RefAttributes<HTMLDivElement>>;
/**
 * Renders the result of a tool execution.
 * Visible when mode is 'result' or 'executing'.
 */
declare const ToolResult: React.ForwardRefExoticComponent<Children & Omit<Omit<React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>, "ref"> & {
    ref?: ((instance: HTMLDivElement | null) => void | React.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES[keyof React.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES]) | React.RefObject<HTMLDivElement> | null | undefined;
} & {
    asChild?: boolean;
}, "ref"> & {
    /** Custom result renderer */
    renderResult?: (execution: ToolExecution) => React.ReactNode;
} & React.RefAttributes<HTMLDivElement>>;
type ApprovalProps = Children & DivProps & {
    renderCall?: (call: AgentKToolCall, index: number) => React.ReactNode;
    renderSummary?: (plan: AgentKPlan) => React.ReactNode;
};
declare const Approval: React.ForwardRefExoticComponent<Children & Omit<Omit<React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>, "ref"> & {
    ref?: ((instance: HTMLDivElement | null) => void | React.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES[keyof React.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES]) | React.RefObject<HTMLDivElement> | null | undefined;
} & {
    asChild?: boolean;
}, "ref"> & {
    renderCall?: (call: AgentKToolCall, index: number) => React.ReactNode;
    renderSummary?: (plan: AgentKPlan) => React.ReactNode;
} & React.RefAttributes<HTMLDivElement>>;
type ActivityFeedProps = Children & DivProps & {
    maxEntries?: number;
    renderEntry?: (entry: ActivityEntry) => React.ReactNode;
};
declare const ActivityFeed: React.ForwardRefExoticComponent<Children & Omit<Omit<React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>, "ref"> & {
    ref?: ((instance: HTMLDivElement | null) => void | React.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES[keyof React.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES]) | React.RefObject<HTMLDivElement> | null | undefined;
} & {
    asChild?: boolean;
}, "ref"> & {
    maxEntries?: number;
    renderEntry?: (entry: ActivityEntry) => React.ReactNode;
} & React.RefAttributes<HTMLDivElement>>;
/**
 * Discovers WebMCP tools from the browser's navigator.modelContext API.
 * Returns tools that can be passed to Command's tools prop.
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
    /** Execute a tool. If omitted, uses WebMCP navigator.modelContextTesting.executeTool */
    onToolExecute?: (toolName: string, parameters: Record<string, any>) => Promise<any>;
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
        /** Execute a tool. If omitted, uses WebMCP navigator.modelContextTesting.executeTool */
        onToolExecute?: (toolName: string, parameters: Record<string, any>) => Promise<any>;
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
    } & React.RefAttributes<HTMLDivElement>>;
    ToolResult: React.ForwardRefExoticComponent<Children & Omit<Omit<React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>, "ref"> & {
        ref?: ((instance: HTMLDivElement | null) => void | React.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES[keyof React.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES]) | React.RefObject<HTMLDivElement> | null | undefined;
    } & {
        asChild?: boolean;
    }, "ref"> & {
        /** Custom result renderer */
        renderResult?: (execution: ToolExecution) => React.ReactNode;
    } & React.RefAttributes<HTMLDivElement>>;
    Approval: React.ForwardRefExoticComponent<Children & Omit<Omit<React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>, "ref"> & {
        ref?: ((instance: HTMLDivElement | null) => void | React.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES[keyof React.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES]) | React.RefObject<HTMLDivElement> | null | undefined;
    } & {
        asChild?: boolean;
    }, "ref"> & {
        renderCall?: (call: AgentKToolCall, index: number) => React.ReactNode;
        renderSummary?: (plan: AgentKPlan) => React.ReactNode;
    } & React.RefAttributes<HTMLDivElement>>;
    ActivityFeed: React.ForwardRefExoticComponent<Children & Omit<Omit<React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>, "ref"> & {
        ref?: ((instance: HTMLDivElement | null) => void | React.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES[keyof React.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES]) | React.RefObject<HTMLDivElement> | null | undefined;
    } & {
        asChild?: boolean;
    }, "ref"> & {
        maxEntries?: number;
        renderEntry?: (entry: ActivityEntry) => React.ReactNode;
    } & React.RefAttributes<HTMLDivElement>>;
    AgentHint: React.ForwardRefExoticComponent<Children & Omit<Omit<React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>, "ref"> & {
        ref?: ((instance: HTMLDivElement | null) => void | React.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES[keyof React.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES]) | React.RefObject<HTMLDivElement> | null | undefined;
    } & {
        asChild?: boolean;
    }, "ref"> & React.RefAttributes<HTMLDivElement>>;
};
declare function useAgentK(): AgentKContextValue;

declare function useCmdk<T = any>(selector: (state: State) => T): T;

export { type ActivityEntry, type ActivityFeedProps, AgentKAgentConfig, type AgentKMode, AgentKPlan, AgentKToolCall, type AgentKToolDef, type ApprovalProps, pkg as Command, ActivityFeed as CommandActivityFeed, AgentHint as CommandAgentHint, Approval as CommandApproval, Dialog as CommandDialog, Empty as CommandEmpty, type CommandFilter, CommandGroup, Input as CommandInput, Item as CommandItem, List as CommandList, Loading as CommandLoading, type CommandProps, Command as CommandRoot, Separator as CommandSeparator, ToolItem as CommandTool, ToolForm as CommandToolForm, ToolResult as CommandToolResult, type DialogProps, type EmptyProps, type GroupProps, type InputProps, type ItemProps, type ListProps, type LoadingProps, type SeparatorProps, type ToolExecution, type ToolFormProps, type ToolInputSchema, type ToolItemProps, type ToolResultProps, defaultFilter, useAgentK, useCmdk as useCommandState, useWebMCPTools };
