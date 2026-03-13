# agentk

A command palette for the agentic web. Extends [cmdk](https://github.com/pacocoursey/cmdk) with tool execution, auto-generated forms, WebMCP registration, and human-in-the-loop agent mode.

Define your tools once as JSON Schema. Users browse and execute them from a command palette. AI agents discover them via [WebMCP](https://chromestatus.com/feature/5261274379001856). Both share the same interface — with the human always in control.

## Install

```bash
npm install agentk
```

## Use

```tsx
import { Command } from 'agentk'

const tools = [
  {
    name: 'search',
    label: 'Search Products',
    description: 'Find products by keyword',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
      },
      required: ['query'],
    },
  },
]

async function executeTool(name: string, params: Record<string, any>) {
  // your app logic
}

const App = () => {
  const [open, setOpen] = React.useState(false)

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      tools={tools}
      onToolExecute={executeTool}
      label="Command Menu"
    >
      <Command.Input placeholder="Type a command or search..." />
      <Command.List>
        <Command.Group heading="Tools">
          {tools.map((tool) => (
            <Command.Tool key={tool.name} tool={tool} />
          ))}
        </Command.Group>
        <Command.Empty>No results found.</Command.Empty>
      </Command.List>
      <Command.ToolForm />
      <Command.ToolResult />
    </Command.Dialog>
  )
}
```

When a user selects a tool, agentk transitions through a built-in lifecycle: **browse → form → executing → result**. Forms are generated automatically from `inputSchema` — `enum` fields render as dropdowns, `number` fields with `minimum`/`maximum` render as sliders, and `string` fields render as text inputs.

### With agent mode

Add the `agent` prop and three more primitives to enable natural language intent → tool execution:

```tsx
<Command.Dialog
  open={open}
  onOpenChange={setOpen}
  tools={tools}
  onToolExecute={executeTool}
  agent={{
    provider: 'anthropic',
    endpoint: '/api/agent',
    requireApproval: true,
  }}
  label="Command Menu"
>
  <Command.Input placeholder="Type a command or search..." />
  <Command.List>
    <Command.Group heading="Tools">
      {tools.map((tool) => (
        <Command.Tool key={tool.name} tool={tool} />
      ))}
    </Command.Group>
    <Command.Empty>No results found.</Command.Empty>
  </Command.List>
  <Command.AgentHint />
  <Command.Approval />
  <Command.ToolForm />
  <Command.ToolResult />
  <Command.ActivityFeed />
</Command.Dialog>
```

When the user types a query that doesn't match any tool, `AgentHint` appears prompting them to press Enter. The query is sent to the LLM, which returns a plan of tool calls. The user reviews and approves the plan in `Approval` before any tools execute.

## Parts and styling

All parts forward props and refs to an appropriate element. Each part has a specific data-attribute that can be used for styling.

### Command `[cmdk-root]`

Root component. Inherits the full [cmdk](https://github.com/pacocoursey/cmdk) API and adds the following props:

| Prop | Type | Description |
|------|------|-------------|
| `tools` | `AgentKToolDef[]` | Tool definitions to register in the palette |
| `onToolExecute` | `(name, params) => Promise<any>` | Called when a tool is executed |
| `onToolResult` | `(name, result) => void` | Called after successful execution |
| `onToolError` | `(name, error) => void` | Called on execution failure |
| `onModeChange` | `(mode) => void` | Called when mode changes |
| `agent` | `AgentKAgentConfig` | LLM agent configuration (omit to disable) |
| `onAgentPlan` | `(plan) => void` | Called when the LLM returns a plan |
| `onAgentApprove` | `(plan) => void` | Called when user approves a plan |
| `onAgentReject` | `(plan) => void` | Called when user rejects a plan |

All standard cmdk props (`value`, `onValueChange`, `filter`, `shouldFilter`, `loop`, `label`) are also supported.

### Dialog `[cmdk-dialog]` `[cmdk-overlay]`

Composes Radix UI's Dialog. Props are forwarded to [Command](#command-cmdk-root).

```tsx
<Command.Dialog open={open} onOpenChange={setOpen}>
  ...
</Command.Dialog>
```

### Input `[cmdk-input]`

Search input. All props forwarded to the underlying `input` element.

```tsx
<Command.Input placeholder="Search tools..." />
```

### List `[cmdk-list]`

Contains Tool items and groups. Animate height using the `--cmdk-list-height` CSS variable.

```css
[cmdk-list] {
  height: var(--cmdk-list-height);
  transition: height 100ms ease;
}
```

### Tool `[cmdk-item]` `[data-agentk-tool]`

Renders a selectable tool item. Selecting it transitions to the form view.

```tsx
<Command.Tool tool={tool} />
```

The `tool` prop is an `AgentKToolDef`:

```tsx
type AgentKToolDef = {
  name: string
  label?: string           // Falls back to humanized name
  description?: string
  inputSchema?: {          // JSON Schema for parameters
    type: 'object'
    properties: Record<string, {
      type: string
      description?: string
      enum?: string[]      // → renders dropdown
      minimum?: number     // → renders slider (with maximum)
      maximum?: number
      default?: any
    }>
    required?: string[]
  }
  icon?: React.ReactNode
  keywords?: string[]      // Aliases for fuzzy matching
}
```

### ToolForm `[data-agentk-form]`

Auto-generates a parameter form from the active tool's `inputSchema`. Renders when mode is `form`.

```tsx
// Default: auto-generated fields
<Command.ToolForm />

// Custom field renderer
<Command.ToolForm
  renderField={(name, schema, value, onChange) => (
    <MyCustomInput value={value} onChange={onChange} />
  )}
/>
```

Schema type mapping:

| Schema | Rendered as |
|--------|-------------|
| `type: 'string'` | Text input |
| `type: 'string', enum: [...]` | Select dropdown |
| `type: 'number', minimum, maximum` | Range slider |
| `type: 'number'` | Number input |
| `type: 'boolean'` | Checkbox |

### ToolResult `[data-agentk-result]`

Displays the result after tool execution. Renders when mode is `result`.

```tsx
// Default display
<Command.ToolResult />

// Custom result renderer
<Command.ToolResult
  renderResult={(execution) => (
    <div>
      {execution.error
        ? <span>Error: {execution.error}</span>
        : <span>Done in {((Date.now() - execution.startedAt) / 1000).toFixed(1)}s</span>
      }
    </div>
  )}
/>
```

The `execution` object:

```tsx
type ToolExecution = {
  toolName: string
  parameters: Record<string, any>
  result?: any
  error?: string
  startedAt: number
}
```

### AgentHint `[data-agentk-agent-hint]`

Appears when the search query doesn't match any tool but an agent is configured. Prompts the user to press Enter to send the query to the LLM.

```tsx
// Default: "Ask the agent" with sparkle icon
<Command.AgentHint />

// Custom content
<Command.AgentHint>
  <span>Let AI handle this</span>
</Command.AgentHint>
```

Set `data-agentk-hint` on `[cmdk-root]` is toggled automatically when the hint is visible, useful for styling the input border:

```css
[cmdk-root][data-agentk-hint] [cmdk-input] {
  border-bottom-color: var(--accent);
}
```

### Approval `[data-agentk-approval]`

Renders the agent's plan for user review before execution. Shows each proposed tool call with parameters. The user can approve or reject.

```tsx
// Default display
<Command.Approval />

// Custom renderers
<Command.Approval
  renderSummary={(plan) => <p>{plan.summary}</p>}
  renderCall={(call, index) => (
    <div>{call.toolName}({JSON.stringify(call.parameters)})</div>
  )}
/>
```

### ActivityFeed `[data-agentk-activity]`

Shows a timeline of agent activity: intent detection, planning, tool execution, results.

```tsx
<Command.ActivityFeed maxEntries={20} />
```

### Empty `[cmdk-empty]`

Renders when there are no results. Automatically hidden when `AgentHint` is visible.

### Group `[cmdk-group]`

Groups items with a heading. Same as cmdk.

```tsx
<Command.Group heading="Actions">
  <Command.Tool tool={tool} />
</Command.Group>
```

### Separator, Loading

Same as cmdk. See [cmdk documentation](https://github.com/pacocoursey/cmdk).

## Hooks

### `useAgentK()`

Access agentk state from within the Command tree.

```tsx
function MyComponent() {
  const ak = useAgentK()

  // Read state
  ak.state.mode        // 'browse' | 'form' | 'executing' | 'result' | 'planning' | 'approval'
  ak.state.activeTool  // current tool or null
  ak.state.parameters  // current form values
  ak.state.execution   // current execution or null
  ak.agentHintVisible  // true when agent hint is showing

  // Actions
  ak.selectTool(tool)
  ak.setParameter('key', value)
  ak.execute()
  ak.reset()
  ak.sendIntent('natural language query')
  ak.approvePlan()
  ak.rejectPlan()
}
```

### `useWebMCPTools()`

Discover tools registered by other apps on the page via WebMCP.

```tsx
const { tools, available, refresh, executeTool } = useWebMCPTools()
// tools: AgentKToolDef[] — discovered tools
// available: boolean — whether WebMCP API is present
// refresh: () => void — re-scan for tools
// executeTool: (name, params) => Promise<any>
```

### `useCommandState(state => state.field)`

Same as cmdk. Access the underlying combobox state.

## Agent configuration

The `agent` prop accepts:

```tsx
type AgentKAgentConfig = {
  provider: 'anthropic' | 'openai' | 'google' | 'custom'
  apiKey?: string         // For development only — warns in browser
  endpoint?: string       // Proxy URL for production
  model?: string          // Defaults: claude-sonnet-4-20250514, gpt-4o, gemini-2.0-flash
  systemPrompt?: string   // Override the built-in system prompt
  requireApproval?: boolean  // Show Approval before executing (default: false)
  maxCalls?: number       // Max tool calls per plan
  providerFn?: AgentKProvider  // Custom provider function
}
```

For production, proxy through your own server using the `endpoint` prop instead of exposing API keys client-side:

```tsx
agent={{
  provider: 'anthropic',
  endpoint: '/api/agent',
  requireApproval: true,
}}
```

### Custom provider

```tsx
agent={{
  provider: 'custom',
  providerFn: async (prompt, tools, config) => {
    const res = await fetch('/my-api', {
      method: 'POST',
      body: JSON.stringify({ prompt, tools }),
    })
    return res.json() // { calls: AgentKToolCall[], summary: string }
  },
}}
```

## WebMCP registration

agentk tools use the same JSON Schema format as WebMCP. Register them so AI agents can discover your app:

```tsx
useEffect(() => {
  const mc = navigator.modelContext
  if (!mc) return

  for (const tool of tools) {
    mc.registerTool({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      execute: async (params) => {
        const result = await executeTool(tool.name, params)
        return { content: [{ type: 'text', text: JSON.stringify(result) }] }
      },
    })
  }

  return () => {
    for (const tool of tools) {
      mc.unregisterTool(tool.name)
    }
  }
}, [])
```

Define once, use everywhere — the same tool definitions power the palette UI, the agent, and WebMCP discovery.

## FAQ

**cmdk compatible?** Yes. agentk is a superset of cmdk. Existing cmdk code works unchanged — add tool props when you're ready.

**Unstyled?** Yes. All components expose data-attributes for styling. No CSS is bundled.

**Which LLM providers?** Anthropic, OpenAI, and Google (Gemini) are built in. Use `provider: 'custom'` with `providerFn` for anything else.

**What is WebMCP?** A [browser API](https://nicksavage.ca/blog/web-model-context-protocol.html) (`navigator.modelContext`) for registering tools that AI agents can discover. Chrome is shipping it. agentk makes your app WebMCP-ready.

**Do I need WebMCP to use agentk?** No. The command palette and tool execution work without it. WebMCP registration is opt-in.

**Do I need an LLM to use agentk?** No. Without the `agent` prop, agentk is a command palette with tool forms and execution — no AI required.

**Auto-generated forms?** Yes. `inputSchema` defines the form. `enum` → dropdown, `number` with `min/max` → slider, `string` → text input. Override with `renderField` for custom fields.

**Human-in-the-loop?** Set `requireApproval: true` and render `<Command.Approval />`. The agent's plan is shown to the user before any tools execute.

**React 18+ only?** Yes. Uses `useId` and `useSyncExternalStore`.

**React server component?** No, it's a client component.

## Acknowledgements

Built on [cmdk](https://github.com/pacocoursey/cmdk) by [Paco Coursey](https://twitter.com/pacocoursey). Uses [Radix UI](https://www.radix-ui.com/) primitives.
