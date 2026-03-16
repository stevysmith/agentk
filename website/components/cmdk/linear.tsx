'use client'

import { Command, type AgentKToolDef, type AgentKProvider } from 'agentk'

// ─────────────────────────────────────────────────────────
// Linear SVG icons (from cmdk source)
// ─────────────────────────────────────────────────────────

const LinearIcons = {
  assignTo: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M7 7a2.5 2.5 0 10.001-4.999A2.5 2.5 0 007 7zm0 1c-1.335 0-4 .893-4 2.667v.666c0 .367.225.667.5.667h2.049c.904-.909 2.417-1.911 4.727-2.009v-.72a.27.27 0 01.007-.063C9.397 8.404 7.898 8 7 8zm4.427 2.028a.266.266 0 01.286.032l2.163 1.723a.271.271 0 01.013.412l-2.163 1.97a.27.27 0 01-.452-.2v-.956c-3.328.133-5.282 1.508-5.287 1.535a.27.27 0 01-.266.227h-.022a.27.27 0 01-.249-.271c0-.046 1.549-3.328 5.824-3.509v-.72a.27.27 0 01.153-.243z" />
    </svg>
  ),
  assignToMe: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M7.00003 7C8.38128 7 9.50003 5.88125 9.50003 4.5C9.50003 3.11875 8.38128 2 7.00003 2C5.61878 2 4.50003 3.11875 4.50003 4.5C4.50003 5.88125 5.61878 7 7.00003 7Z" />
      <path fillRule="evenodd" clipRule="evenodd" d="M7.00005 8C5.66505 8 3.00006 8.89333 3.00006 10.6667V11.3333C3.00006 11.7 3.22506 12 3.50006 12H3.98973C4.01095 11.9415 4.04535 11.8873 4.09266 11.8425L7.21783 8.88444C7.28966 8.81658 7.38297 8.77917 7.4796 8.77949C7.69459 8.78018 7.86826 8.96356 7.86753 9.1891L7.86214 10.629C9.00553 10.5858 10.0366 10.4354 10.9441 10.231C10.5539 8.74706 8.22087 8 7.00005 8Z" />
      <path d="M6.72511 14.718C6.80609 14.7834 6.91767 14.7955 7.01074 14.749C7.10407 14.7036 7.16321 14.6087 7.16295 14.5047L7.1605 13.7849C11.4352 13.5894 12.9723 10.3023 12.9722 10.2563C12.9722 10.1147 12.8634 9.9971 12.7225 9.98626L12.7009 9.98634C12.5685 9.98689 12.4561 10.0833 12.4351 10.2142C12.4303 10.2413 10.4816 11.623 7.15364 11.7666L7.1504 10.8116C7.14981 10.662 7.02829 10.5412 6.87896 10.5418C6.81184 10.5421 6.74721 10.5674 6.69765 10.6127L4.54129 12.5896C4.43117 12.6906 4.42367 12.862 4.52453 12.9723C4.53428 12.9829 4.54488 12.9928 4.55621 13.0018L6.72511 14.718Z" />
    </svg>
  ),
  changeStatus: (
    <svg width="16" height="16" viewBox="-1 -1 15 15" fill="currentColor">
      <path d="M10.5714 7C10.5714 8.97245 8.97245 10.5714 7 10.5714L6.99975 3.42857C8.9722 3.42857 10.5714 5.02755 10.5714 7Z" />
      <path fillRule="evenodd" clipRule="evenodd" d="M7 12.5C10.0376 12.5 12.5 10.0376 12.5 7C12.5 3.96243 10.0376 1.5 7 1.5C3.96243 1.5 1.5 3.96243 1.5 7C1.5 10.0376 3.96243 12.5 7 12.5ZM7 14C10.866 14 14 10.866 14 7C14 3.13401 10.866 0 7 0C3.13401 0 0 3.13401 0 7C0 10.866 3.13401 14 7 14Z" />
    </svg>
  ),
  changePriority: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <rect x="1" y="8" width="3" height="6" rx="1" />
      <rect x="6" y="5" width="3" height="9" rx="1" />
      <rect x="11" y="2" width="3" height="12" rx="1" />
    </svg>
  ),
  changeLabels: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path fillRule="evenodd" clipRule="evenodd" d="M10.2105 4C10.6337 4 11.0126 4.18857 11.24 4.48L14 8L11.24 11.52C11.0126 11.8114 10.6337 12 10.2105 12L3.26316 11.9943C2.56842 11.9943 2 11.4857 2 10.8571V5.14286C2 4.51429 2.56842 4.00571 3.26316 4.00571L10.2105 4ZM11.125 9C11.6773 9 12.125 8.55228 12.125 8C12.125 7.44772 11.6773 7 11.125 7C10.5727 7 10.125 7.44772 10.125 8C10.125 8.55228 10.5727 9 11.125 9Z" />
    </svg>
  ),
  removeLabel: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path fillRule="evenodd" clipRule="evenodd" d="M10.2105 4C10.6337 4 11.0126 4.18857 11.24 4.48L14 8L11.24 11.52C11.0126 11.8114 10.6337 12 10.2105 12L3.26316 11.9943C2.56842 11.9943 2 11.4857 2 10.8571V5.14286C2 4.51429 2.56842 4.00571 3.26316 4.00571L10.2105 4ZM11.125 9C11.6773 9 12.125 8.55228 12.125 8C12.125 7.44772 11.6773 7 11.125 7C10.5727 7 10.125 7.44772 10.125 8C10.125 8.55228 10.5727 9 11.125 9Z" />
    </svg>
  ),
  setDueDate: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path fillRule="evenodd" clipRule="evenodd" d="M15 5C15 2.79086 13.2091 1 11 1H5C2.79086 1 1 2.79086 1 5V11C1 13.2091 2.79086 15 5 15H6.25C6.66421 15 7 14.6642 7 14.25C7 13.8358 6.66421 13.5 6.25 13.5H5C3.61929 13.5 2.5 12.3807 2.5 11V6H13.5V6.25C13.5 6.66421 13.8358 7 14.25 7C14.6642 7 15 6.66421 15 6.25V5ZM11.5001 8C11.9143 8 12.2501 8.33579 12.2501 8.75V10.75L14.2501 10.75C14.6643 10.75 15.0001 11.0858 15.0001 11.5C15.0001 11.9142 14.6643 12.25 14.2501 12.25L12.2501 12.25V14.25C12.2501 14.6642 11.9143 15 11.5001 15C11.0859 15 10.7501 14.6642 10.7501 14.25V12.25H8.75C8.33579 12.25 8 11.9142 8 11.5C8 11.0858 8.33579 10.75 8.75 10.75L10.7501 10.75V8.75C10.7501 8.33579 11.0859 8 11.5001 8Z" />
    </svg>
  ),
}

// ─────────────────────────────────────────────────────────
// Linear theme tools
// ─────────────────────────────────────────────────────────

const USERS = ['Paco Coursey', 'Rauno Freiberg', 'Evil Rabbit', 'Steven Tey']

const linearTools: AgentKToolDef[] = [
  {
    name: 'assign_to',
    label: 'Assign to...',
    icon: LinearIcons.assignTo,
    keywords: ['assign', 'user'],
    inputSchema: {
      type: 'object',
      properties: { assignee: { type: 'string', description: 'Team member', enum: USERS } },
      required: ['assignee'],
    },
  },
  { name: 'assign_to_me', label: 'Assign to me', icon: LinearIcons.assignToMe, keywords: ['assign', 'me'] },
  {
    name: 'change_status',
    label: 'Change status...',
    icon: LinearIcons.changeStatus,
    keywords: ['status'],
    inputSchema: {
      type: 'object',
      properties: { status: { type: 'string', enum: ['Backlog', 'Todo', 'In Progress', 'Done', 'Cancelled'] } },
      required: ['status'],
    },
  },
  {
    name: 'change_priority',
    label: 'Change priority...',
    icon: LinearIcons.changePriority,
    keywords: ['priority'],
    inputSchema: {
      type: 'object',
      properties: { priority: { type: 'string', enum: ['Urgent', 'High', 'Medium', 'Low', 'None'] } },
      required: ['priority'],
    },
  },
  {
    name: 'change_labels',
    label: 'Change labels...',
    icon: LinearIcons.changeLabels,
    keywords: ['label', 'tag'],
    inputSchema: {
      type: 'object',
      properties: { label: { type: 'string', enum: ['feature', 'bug', 'improvement', 'design'] } },
      required: ['label'],
    },
  },
  { name: 'remove_label', label: 'Remove label...', icon: LinearIcons.removeLabel, keywords: ['label', 'remove'] },
  { name: 'set_due_date', label: 'Set due date...', icon: LinearIcons.setDueDate, keywords: ['due', 'date'] },
]

const LINEAR_SHORTCUTS: Record<string, string[]> = {
  assign_to: ['A'],
  assign_to_me: ['I'],
  change_status: ['S'],
  change_priority: ['P'],
  change_labels: ['L'],
  remove_label: ['\u21E7', 'L'],
  set_due_date: ['\u21E7', 'D'],
}

// ─────────────────────────────────────────────────────────
// Mock agent provider
// ─────────────────────────────────────────────────────────

const mockLinearAgent: AgentKProvider = async (prompt, _tools, _config, _signal) => {
  await new Promise((r) => setTimeout(r, 600))

  const q = prompt.toLowerCase()

  if ((q.includes('assign') && (q.includes('close') || q.includes('done')))) {
    return {
      calls: [
        { toolName: 'assign_to_me', parameters: {} },
        { toolName: 'change_status', parameters: { status: 'Done' } },
      ],
      summary: 'Assign this issue to you and mark it as Done.',
    }
  }

  if (q.includes('urgent') || q.includes('priority')) {
    const priority = q.includes('urgent') ? 'Urgent' : 'High'
    return {
      calls: [{ toolName: 'change_priority', parameters: { priority } }],
      summary: `Set priority to ${priority}.`,
    }
  }

  if (q.includes('bug') || q.includes('label')) {
    return {
      calls: [{ toolName: 'change_labels', parameters: { label: 'bug' } }],
      summary: 'Add the "bug" label to this issue.',
    }
  }

  return {
    calls: [{ toolName: 'assign_to_me', parameters: {} }],
    summary: 'Assign this issue to you.',
  }
}

// ─────────────────────────────────────────────────────────
// Mock tool executor
// ─────────────────────────────────────────────────────────

const handleToolExecute = async (toolName: string, params: Record<string, any>) => {
  await new Promise((r) => setTimeout(r, 400))

  switch (toolName) {
    case 'assign_to_me':
      return { ok: true, message: 'Assigned to you' }
    case 'assign_to':
      return { ok: true, message: `Assigned to ${params.assignee}` }
    case 'change_status':
      return { ok: true, message: `Status changed to ${params.status}` }
    case 'change_priority':
      return { ok: true, message: `Priority set to ${params.priority}` }
    case 'change_labels':
      return { ok: true, message: `Label "${params.label}" added` }
    case 'remove_label':
      return { ok: true, message: 'Label removed' }
    case 'set_due_date':
      return { ok: true, message: `Due date set to ${params.date || 'today'}` }
    default:
      return { ok: true, message: `${toolName} executed` }
  }
}

// ─────────────────────────────────────────────────────────
// Theme: Linear
// ─────────────────────────────────────────────────────────

export default function LinearTheme() {
  return (
    <div className="palette-container linear-theme">
      <Command
        label="Linear"
        tools={linearTools}
        onToolExecute={handleToolExecute}
        agent={{
          provider: 'custom',
          providerFn: mockLinearAgent,
          requireApproval: true,
        }}
      >
        <div className="linear-badge">Issue - FUN-343</div>
        <Command.Input autoFocus placeholder="Type a command or search..." />
        <Command.List>
          {linearTools.map((t) => (
            <Command.Tool key={t.name} tool={t}>
              <span className="linear-icon">{t.icon}</span>
              {t.label || t.name}
              {LINEAR_SHORTCUTS[t.name] && (
                <div className="linear-shortcuts">
                  {LINEAR_SHORTCUTS[t.name].map((key) => (
                    <kbd key={key} className="linear-kbd">{key}</kbd>
                  ))}
                </div>
              )}
            </Command.Tool>
          ))}
          <Command.Empty>No results found.</Command.Empty>
          <Command.AgentHint />
        </Command.List>
        <Command.ToolForm />
        <Command.ToolResult />
        <Command.Approval />
        <Command.ActivityFeed />
      </Command>
    </div>
  )
}
