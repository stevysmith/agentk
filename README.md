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
| `onToolExecute` | `(name, params) => Promise<string \| Record>` | Called when a tool is executed. Return a string for text display, an object for JSON. |
| `onToolResult` | `(name, result) => void` | Called after successful execution |
| `onToolError` | `(name, error) => void` | Called on execution failure |
| `onModeChange` | `(mode) => void` | Called when mode changes |
| `agent` | `AgentKAgentConfig` | LLM agent configuration (omit to disable) |
| `onAgentPlan` | `(plan) => void` | Called when the LLM returns a plan |
| `onAgentApprove` | `(plan) => void` | Called when user approves a plan |
| `onAgentReject` | `(plan) => void` | Called when user rejects a plan |

All standard cmdk props (`value`, `onValueChange`, `filter`, `shouldFilter`, `loop`, `label`) are also supported.

The root element exposes `data-agentk-mode` reflecting the current state machine mode. Use it for mode-aware styling:

```css
/* Hide tool list when a form, result, or execution is active */
[data-agentk-mode="form"] [cmdk-list]      { display: none; }
[data-agentk-mode="executing"] [cmdk-list]  { display: none; }
[data-agentk-mode="result"] [cmdk-list]     { display: none; }
[data-agentk-mode="planning"] [cmdk-list]   { display: none; }
[data-agentk-mode="approval"] [cmdk-list]   { display: none; }
```

Possible values: `browse`, `form`, `executing`, `result`, `planning`, `approval`. Works alongside `data-agentk-entering` and `data-agentk-exiting` for transition animations.

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
// Default rendering: icon + name + description
<Command.Tool tool={tool} />

// Custom rendering: children fully replace the default layout
<Command.Tool tool={tool}>
  <MyCustomIcon />
  <div>
    <strong>{tool.label}</strong>
    <p>{tool.description}</p>
  </div>
</Command.Tool>
```

When children are omitted, the default layout renders `data-agentk-tool-icon`, `data-agentk-tool-name`, and `data-agentk-tool-description` elements for styling. When children are provided, only your children render.

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

// Custom action buttons (Cancel + Execute)
<Command.ToolForm
  renderActions={({ cancel, submit, canSubmit }) => (
    <div>
      <button onClick={cancel}>Cancel</button>
      <button onClick={submit} disabled={!canSubmit}>Run it</button>
    </div>
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

The return value of `onToolExecute` controls what is displayed:

```tsx
onToolExecute={async (name, params) => {
  const data = await myApi(name, params);
  // String → rendered as text in <span data-agentk-result-data="">
  return `Found ${data.length} results`;
  // Object → rendered as formatted JSON in <pre data-agentk-result-data="">
  // return { count: data.length, items: data };
}}
```

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

// Custom dismiss button
<Command.ToolResult
  renderDismiss={({ dismiss }) => (
    <button onClick={dismiss}>Got it</button>
  )}
/>

// Auto-dismiss successful results after 6s
<Command.ToolResult autoDismissAfterMs={6000} />
```

`autoDismissAfterMs` only fires for successful results — errors stay visible
until the user dismisses them manually. Combine with `onModeChange` if you need
side effects (e.g. navigation) when the panel closes.

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

Appears when the search query doesn't match any tool but an agent is configured. Interactive — clicking, pressing Enter, or pressing Space triggers `sendIntent` with the current search query. Renders with `role="button"` and `tabIndex={0}` for accessibility.

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
  renderActions={({ approve, reject }) => (
    <div>
      <button onClick={reject}>Cancel</button>
      <button onClick={approve}>Run plan</button>
    </div>
  )}
/>
```

### ActivityFeed `[data-agentk-activity]`

Shows a timeline of agent activity: intent detection, planning, tool execution, results.

```tsx
<Command.ActivityFeed maxEntries={20} />
```

### IntentTrigger `[data-agentk-intent-trigger]`

A `Command.Item` that triggers `sendIntent` when selected, instead of the default tool-selection behaviour. Renders identically to other items — same styling, same keyboard navigation.

```tsx
<Command.IntentTrigger query="summer programs in europe">
  Search Europe
</Command.IntentTrigger>
```

Must be rendered inside a `Command.List`. Style with `[data-agentk-intent-trigger]`.

**Note:** Since `IntentTrigger` is a `Command.Item`, it counts as a matching item for filtering. If you want `AgentHint` to appear when the user types a custom query, place IntentTrigger items alongside other items so they get filtered out by cmdk's fuzzy matching. For agent-only search (no items), use `AgentHint` directly without IntentTrigger.

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

## Recipes

### Consumer search (agent-only, no tool list)

For customer-facing search where users type natural language and get results — no tool browsing needed:

```tsx
<Command.Dialog
  open={open}
  onOpenChange={setOpen}
  tools={tools}
  onToolExecute={handleExecute}
  agent={{ provider: 'anthropic', endpoint: '/api/agent' }}
>
  <Command.Input placeholder="What are you looking for?" />
  <Command.List>
    {/* No Command.Tool items — agent-only */}
    <Command.AgentHint />
    <Command.Empty>Type to search with AI</Command.Empty>
  </Command.List>
  <Command.ToolResult />
</Command.Dialog>
```

Use `data-agentk-mode` to hide the list during execution:

```css
[data-agentk-mode="executing"] [cmdk-list] { display: none; }
[data-agentk-mode="result"] [cmdk-list]    { display: none; }
```

Add suggested queries with `IntentTrigger`:

```tsx
<Command.List>
  <Command.Group heading="Suggestions">
    <Command.IntentTrigger query="popular items">Popular items</Command.IntentTrigger>
    <Command.IntentTrigger query="deals under $50">Deals under $50</Command.IntentTrigger>
  </Command.Group>
  <Command.AgentHint />
</Command.List>
```

## Data-attribute reference

Every part exposes data-attributes you can target from CSS without bundling
styles. The cmdk-prefixed attrs come from cmdk; everything `data-agentk-*` is
introduced by agentk.

### Root and dialog

| Selector | Where |
|---|---|
| `[cmdk-root]` | Top-level element (Command / Command.Dialog) |
| `[cmdk-root][data-agentk-mode="<mode>"]` | Reflects the current state machine mode (`browse`, `form`, `executing`, `result`, `planning`, `approval`) |
| `[cmdk-root][data-agentk-hint]` | Present when `AgentHint` is showing |
| `[cmdk-overlay]` | Dialog backdrop |
| `[cmdk-dialog]` | Dialog surface |
| `[cmdk-input]` | Search input |
| `[cmdk-list]` | List wrapper (animatable via `--cmdk-list-height`) |
| `[cmdk-group]`, `[cmdk-group-heading]` | Group + its heading |
| `[cmdk-empty]` | Empty state |

### Tool item

| Selector | Where |
|---|---|
| `[cmdk-item][data-agentk-tool="<name>"]` | The tool list item |
| `[data-agentk-tool-icon]` | Default icon span (only when `tool.icon` is set) |
| `[data-agentk-tool-name]` | Default label span |
| `[data-agentk-tool-description]` | Default description span |
| `[data-agentk-intent-trigger]` | A `Command.IntentTrigger` item |

### ToolForm

| Selector | Where |
|---|---|
| `[data-agentk-form]` | Form container |
| `[data-agentk-form-invalid]` | Set on the form when validation has errors |
| `[data-agentk-form-heading]` | Header row (icon + title + description) |
| `[data-agentk-form-title]` | Form title |
| `[data-agentk-form-description]` | Form description |
| `[data-agentk-form-fields]` | Wrapper around the field list |
| `[data-agentk-form-field]` | Wrapper around a single field |
| `[data-agentk-form-field][data-agentk-field-error]` | Field whose value is invalid |
| `[data-agentk-form-label]` | Default field label |
| `[data-agentk-required]` | Required-field marker (default `*`) |
| `[data-agentk-form-hint]` | Field description / hint |
| `[data-agentk-field-error-message]` | Inline validation message |
| `[data-agentk-form-actions]` | Cancel + submit row |
| `[data-agentk-form-cancel]` | Cancel button |
| `[data-agentk-form-submit]` | Submit button |

### ToolResult

| Selector | Where |
|---|---|
| `[data-agentk-result]` | Result container |
| `[data-agentk-result][data-agentk-executing]` | Set during the executing phase |
| `[data-agentk-result-loading]` | Spinner row during execution |
| `[data-agentk-progress]` | "Step N of M" indicator during a chained plan |
| `[data-agentk-result][data-agentk-success]` | Set when a successful result is shown |
| `[data-agentk-result][data-agentk-error]` | Set when an error is shown |
| `[data-agentk-result-heading]` | Result title row |
| `[data-agentk-result-body]` | Result content wrapper |
| `[data-agentk-result-data]` | The result value (string `<span>` or JSON `<pre>`) |
| `[data-agentk-result-error]` | The error message `<pre>` |
| `[data-agentk-result-meta]` | Meta row (e.g. duration) |
| `[data-agentk-result-dismiss]` | Default dismiss button |

### AgentHint

| Selector | Where |
|---|---|
| `[data-agentk-agent-hint]` | Hint container (clickable) |
| `[data-agentk-agent-hint-icon]` | Default sparkle icon |
| `[data-agentk-agent-hint-content]` | Label + query wrapper |
| `[data-agentk-agent-hint-label]` | "Ask the agent" label |
| `[data-agentk-agent-hint-query]` | The current search text in quotes |
| `[data-agentk-agent-hint-kbd]` | Default `↵` kbd glyph |

### Approval

| Selector | Where |
|---|---|
| `[data-agentk-approval]` | Approval container |
| `[data-agentk-approval-summary]` | Plan summary line |
| `[data-agentk-approval-calls]` | List of planned tool calls |
| `[data-agentk-approval-call]` | A single planned tool call |
| `[data-agentk-approval-call-icon]` | Tool icon (only when set) |
| `[data-agentk-approval-call-name]` | Tool name |
| `[data-agentk-approval-call-params]` | Parameter chips wrapper |
| `[data-agentk-approval-param]` | Single parameter chip |
| `[data-agentk-approval-param-value]` | Stringified parameter value |
| `[data-agentk-approval-actions]` | Reject + approve row |
| `[data-agentk-approval-reject]` | Reject button |
| `[data-agentk-approval-approve]` | Approve button |

### Planning / spinner

| Selector | Where |
|---|---|
| `[data-agentk-planning]` | Planning indicator container |
| `[data-agentk-planning-text]` | "Thinking…" label |
| `[data-agentk-spinner]` | The animated spinner element (also reused inside `[data-agentk-result-loading]`) |

### ActivityFeed

| Selector | Where |
|---|---|
| `[data-agentk-activity]` | Feed container |
| `[data-agentk-activity][data-agentk-activity-expanded]` | Set when the feed is expanded |
| `[data-agentk-activity-toggle]` | Expand/collapse button |
| `[data-agentk-activity-status]` | Latest status text |
| `[data-agentk-activity-chevron]` | Chevron icon (with `data-expanded` when open) |
| `[data-agentk-activity-entry]` | A feed entry |
| `[data-agentk-activity-entry][data-agentk-activity-type="<type>"]` | Entry type (`tool_start`, `tool_complete`, `tool_error`, etc.) |
| `[data-agentk-activity-icon]` | Per-entry icon |
| `[data-agentk-activity-message]` | Per-entry message |

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
