type ToolDef = {
    name: string;
    label?: string;
    description?: string;
    inputSchema?: {
        type: 'object';
        properties: Record<string, any>;
        required?: string[];
    };
    icon?: any;
    keywords?: string[];
};
type AgentKToolCall = {
    toolName: string;
    parameters: Record<string, any>;
    reasoning?: string;
};
type AgentKPlan = {
    calls: AgentKToolCall[];
    summary: string;
};
type AgentKAgentConfig = {
    provider: 'anthropic' | 'openai' | 'google' | 'custom';
    apiKey?: string;
    endpoint?: string;
    model?: string;
    systemPrompt?: string;
    requireApproval?: boolean;
    maxCalls?: number;
    providerFn?: AgentKProvider;
};
type AgentKProvider = (prompt: string, tools: ToolDef[], config: AgentKAgentConfig) => Promise<AgentKPlan>;
declare function resolveProvider(config: AgentKAgentConfig): AgentKProvider;

export { type AgentKAgentConfig, type AgentKPlan, type AgentKProvider, type AgentKToolCall, resolveProvider };
