'use client'

import { useState, useEffect, useCallback } from 'react'
import { Command, useAgentK, useWebMCPRegistration, type AgentKToolDef, type ToolExecution } from 'agentk'

/* ─────────────────────────────────────────────────────────
 * agentk × Linear demo
 *
 * Same agentk library, Linear's design language.
 * Tools = issue actions. Forms = auto-generated from schema.
 * Proves agentk is composable across visual styles.
 * ───────────────────────────────────────────────────────── */

// ─────────────────────────────────────────────────────────
// Issue state
// ─────────────────────────────────────────────────────────

type Issue = {
  id: string
  title: string
  status: 'backlog' | 'todo' | 'in_progress' | 'done' | 'cancelled'
  priority: 'none' | 'urgent' | 'high' | 'medium' | 'low'
  assignee: string | null
  labels: string[]
  dueDate: string | null
}

const INITIAL_ISSUE: Issue = {
  id: 'FUN-343',
  title: 'Add WebMCP tool discovery to settings panel',
  status: 'in_progress',
  priority: 'high',
  assignee: null,
  labels: ['feature'],
  dueDate: null,
}

const USERS = ['Paco Coursey', 'Rauno Freiberg', 'Evil Rabbit', 'Steven Tey']
const LABELS = ['feature', 'bug', 'improvement', 'design', 'documentation', 'performance']

const STATUS_DISPLAY: Record<string, { icon: string; label: string }> = {
  backlog:     { icon: '○', label: 'Backlog' },
  todo:        { icon: '◔', label: 'Todo' },
  in_progress: { icon: '◑', label: 'In Progress' },
  done:        { icon: '●', label: 'Done' },
  cancelled:   { icon: '⊘', label: 'Cancelled' },
}

const PRIORITY_DISPLAY: Record<string, { icon: string; label: string }> = {
  none:   { icon: '┄', label: 'No priority' },
  urgent: { icon: '⚡', label: 'Urgent' },
  high:   { icon: '▲', label: 'High' },
  medium: { icon: '◆', label: 'Medium' },
  low:    { icon: '▽', label: 'Low' },
}

// ─────────────────────────────────────────────────────────
// WebMCP tool definitions — issue actions
// ─────────────────────────────────────────────────────────

const TOOLS: AgentKToolDef[] = [
  {
    name: 'assign_to',
    label: 'Assign to...',
    keywords: ['assign', 'user', 'member'],
    inputSchema: {
      type: 'object',
      properties: {
        assignee: { type: 'string', description: 'Team member', enum: USERS },
      },
      required: ['assignee'],
    },
  },
  {
    name: 'assign_to_me',
    label: 'Assign to me',
    keywords: ['assign', 'me', 'self'],
  },
  {
    name: 'change_status',
    label: 'Change status...',
    keywords: ['status', 'state', 'progress'],
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'New status', enum: ['backlog', 'todo', 'in_progress', 'done', 'cancelled'] },
      },
      required: ['status'],
    },
  },
  {
    name: 'change_priority',
    label: 'Change priority...',
    keywords: ['priority', 'urgent', 'high', 'low'],
    inputSchema: {
      type: 'object',
      properties: {
        priority: { type: 'string', description: 'Priority level', enum: ['none', 'urgent', 'high', 'medium', 'low'] },
      },
      required: ['priority'],
    },
  },
  {
    name: 'change_labels',
    label: 'Change labels...',
    keywords: ['label', 'tag'],
    inputSchema: {
      type: 'object',
      properties: {
        label: { type: 'string', description: 'Label to add', enum: LABELS },
      },
      required: ['label'],
    },
  },
  {
    name: 'remove_label',
    label: 'Remove label...',
    keywords: ['label', 'tag', 'remove'],
    inputSchema: {
      type: 'object',
      properties: {
        label: { type: 'string', description: 'Label to remove', enum: LABELS },
      },
      required: ['label'],
    },
  },
  {
    name: 'set_due_date',
    label: 'Set due date...',
    keywords: ['due', 'date', 'deadline'],
    inputSchema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Due date (YYYY-MM-DD)' },
      },
      required: ['date'],
    },
  },
]

// SVG icons matching Linear's monochrome style
const TOOL_ICONS: Record<string, React.ReactNode> = {
  assign_to: <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M7 7a2.5 2.5 0 10.001-4.999A2.5 2.5 0 007 7zm0 1c-1.335 0-4 .893-4 2.667v.666c0 .367.225.667.5.667h2.049c.904-.909 2.417-1.911 4.727-2.009v-.72a.27.27 0 01.007-.063C9.397 8.404 7.898 8 7 8zm4.427 2.028a.266.266 0 01.286.032l2.163 1.723a.271.271 0 01.013.412l-2.163 1.97a.27.27 0 01-.452-.2v-.956c-3.328.133-5.282 1.508-5.287 1.535a.27.27 0 01-.266.227h-.022a.27.27 0 01-.249-.271c0-.046 1.549-3.328 5.824-3.509v-.72a.27.27 0 01.153-.243z" /></svg>,
  assign_to_me: <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M7 7C8.381 7 9.5 5.881 9.5 4.5S8.381 2 7 2 4.5 3.119 4.5 4.5 5.619 7 7 7Z" /><path fillRule="evenodd" clipRule="evenodd" d="M7 8c-1.335 0-4 .893-4 2.667v.666c0 .367.225.667.5.667h.49c.02-.059.055-.113.103-.157l3.125-2.96a.37.37 0 01.262-.107c.215 0 .389.184.388.41l-.005 1.44c1.143-.043 2.174-.194 3.082-.398C10.554 8.747 8.221 8 7 8Z" /><path d="M6.725 14.718a.27.27 0 00.286.031.27.27 0 00.152-.244l-.002-.72c4.274-.196 5.812-3.483 5.812-3.529a.27.27 0 00-.25-.27h-.021a.27.27 0 00-.266.228c-.005.027-1.954 1.41-5.281 1.553l-.003-.955a.27.27 0 00-.272-.27.27.27 0 00-.181.07l-2.157 1.977a.27.27 0 00-.016.383l.031.03 2.168 1.716Z" /></svg>,
  change_status: <svg width="16" height="16" viewBox="-1 -1 15 15" fill="currentColor"><path d="M10.571 7c0 1.972-1.598 3.571-3.571 3.571V3.43c1.972 0 3.571 1.6 3.571 3.571Z" /><path fillRule="evenodd" clipRule="evenodd" d="M7 12.5A5.5 5.5 0 107 1.5a5.5 5.5 0 000 11Zm0 1.5a7 7 0 100-14 7 7 0 000 14Z" /></svg>,
  change_priority: <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="8" width="3" height="6" rx="1" /><rect x="6" y="5" width="3" height="9" rx="1" /><rect x="11" y="2" width="3" height="12" rx="1" /></svg>,
  change_labels: <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path fillRule="evenodd" clipRule="evenodd" d="M10.21 4c.424 0 .803.189 1.03.48L14 8l-2.76 3.52c-.228.291-.606.48-1.03.48H3.264C2.568 12 2 11.486 2 10.857V5.143C2 4.514 2.568 4.006 3.263 4.006L10.21 4ZM11.125 9a1 1 0 100-2 1 1 0 000 2Z" /></svg>,
  remove_label: <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path fillRule="evenodd" clipRule="evenodd" d="M10.21 4c.424 0 .803.189 1.03.48L14 8l-2.76 3.52c-.228.291-.606.48-1.03.48H3.264C2.568 12 2 11.486 2 10.857V5.143C2 4.514 2.568 4.006 3.263 4.006L10.21 4ZM11.125 9a1 1 0 100-2 1 1 0 000 2Z" /></svg>,
  set_due_date: <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path fillRule="evenodd" clipRule="evenodd" d="M15 5a4 4 0 00-4-4H5a4 4 0 00-4 4v6a4 4 0 004 4h1.25a.75.75 0 000-1.5H5A2.5 2.5 0 012.5 11V6h11v.25a.75.75 0 001.5 0V5Zm-3.5 3a.75.75 0 01.75.75V10.75h2a.75.75 0 010 1.5h-2v2a.75.75 0 01-1.5 0v-2h-2a.75.75 0 010-1.5h2V8.75a.75.75 0 01.75-.75Z" /></svg>,
}

const SHORTCUTS: Record<string, string[]> = {
  assign_to: ['A'],
  assign_to_me: ['I'],
  change_status: ['S'],
  change_priority: ['P'],
  change_labels: ['L'],
  remove_label: ['⇧', 'L'],
  set_due_date: ['⇧', 'D'],
}

// ─────────────────────────────────────────────────────────
// Page component
// ─────────────────────────────────────────────────────────

export default function LinearDemo() {
  const [open, setOpen] = useState(true)
  const [issue, setIssue] = useState(INITIAL_ISSUE)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  const executeTool = useCallback(
    async (name: string, params: Record<string, any>) => {
      await new Promise((r) => setTimeout(r, 300 + Math.random() * 300))

      switch (name) {
        case 'assign_to':
          setIssue((i) => ({ ...i, assignee: params.assignee }))
          return { success: true, assignee: params.assignee }
        case 'assign_to_me':
          setIssue((i) => ({ ...i, assignee: 'You' }))
          return { success: true, assignee: 'You' }
        case 'change_status':
          setIssue((i) => ({ ...i, status: params.status }))
          return { success: true, status: params.status }
        case 'change_priority':
          setIssue((i) => ({ ...i, priority: params.priority }))
          return { success: true, priority: params.priority }
        case 'change_labels':
          setIssue((i) => ({ ...i, labels: [...new Set([...i.labels, params.label])] }))
          return { success: true, label: params.label }
        case 'remove_label':
          setIssue((i) => ({ ...i, labels: i.labels.filter((l) => l !== params.label) }))
          return { success: true, removed: params.label }
        case 'set_due_date':
          setIssue((i) => ({ ...i, dueDate: params.date }))
          return { success: true, date: params.date }
        default:
          throw new Error(`Unknown tool: ${name}`)
      }
    },
    [],
  )

  // Expose the same catalog to WebMCP agents (retries until the API appears).
  useWebMCPRegistration(TOOLS, executeTool, { prefix: 'linear_' })

  const handleModeChange = useCallback((mode: string) => {
    if (mode === 'result') {
      setTimeout(() => setOpen(false), 1200)
    }
  }, [])

  const status = STATUS_DISPLAY[issue.status]
  const priority = PRIORITY_DISPLAY[issue.priority]

  return (
    <div className="linear-page">
      {/* Issue detail card */}
      <div className="linear-issue">
        <div className="linear-issue-header">
          <span className="linear-issue-id">{issue.id}</span>
          <span className="linear-issue-status">
            <span className="linear-status-icon">{status.icon}</span>
            {status.label}
          </span>
        </div>
        <h1 className="linear-issue-title">{issue.title}</h1>
        <div className="linear-issue-meta">
          <span className="linear-meta-item">
            <span className="linear-meta-label">Priority</span>
            <span className="linear-meta-value">{priority.icon} {priority.label}</span>
          </span>
          <span className="linear-meta-item">
            <span className="linear-meta-label">Assignee</span>
            <span className="linear-meta-value">{issue.assignee || 'Unassigned'}</span>
          </span>
          {issue.labels.length > 0 && (
            <span className="linear-meta-item">
              <span className="linear-meta-label">Labels</span>
              <span className="linear-meta-value">
                {issue.labels.map((l) => (
                  <span key={l} className="linear-label-chip">{l}</span>
                ))}
              </span>
            </span>
          )}
          {issue.dueDate && (
            <span className="linear-meta-item">
              <span className="linear-meta-label">Due</span>
              <span className="linear-meta-value">{issue.dueDate}</span>
            </span>
          )}
        </div>
        <button className="linear-open-btn" onClick={() => setOpen(true)}>
          <kbd>⌘</kbd><kbd>K</kbd>
        </button>
      </div>

      {/* Palette */}
      <div className="linear">
        <Command.Dialog
          open={open}
          onOpenChange={setOpen}
          onToolExecute={executeTool}
          onModeChange={handleModeChange}
          contentClassName="linear"
          label="Issue actions"
        >
          <div cmdk-linear-badge="">Issue &middot; {issue.id}</div>
          <Command.Input placeholder="Type a command or search..." />
          <LinearPaletteBody />
        </Command.Dialog>
      </div>
    </div>
  )
}

function LinearPaletteBody() {
  const ak = useAgentK()
  const showList = ak.state.mode === 'browse'

  return (
    <>
      {showList && (
        <Command.List>
          {TOOLS.map((t) => (
            <Command.Tool key={t.name} tool={t}>
              <span className="linear-tool-icon">{TOOL_ICONS[t.name]}</span>
              {t.label}
              <div cmdk-linear-shortcuts="">
                {(SHORTCUTS[t.name] || []).map((key) => (
                  <kbd key={key}>{key}</kbd>
                ))}
              </div>
            </Command.Tool>
          ))}
          <Command.Empty>No results found.</Command.Empty>
        </Command.List>
      )}
      <Command.ToolForm />
      <Command.ToolResult renderResult={(execution: ToolExecution) => {
        const msg = getResultMessage(execution)
        if (execution.error) {
          return (
            <div className="linear-result">
              <span className="linear-result-icon linear-result-error">✗</span>
              <span>{execution.error}</span>
            </div>
          )
        }
        return (
          <div className="linear-result">
            <span className="linear-result-icon">✓</span>
            <span>{msg}</span>
          </div>
        )
      }} />
    </>
  )
}

function getResultMessage(execution: ToolExecution): string {
  const p = execution.parameters
  switch (execution.toolName) {
    case 'assign_to': return `Assigned to ${p.assignee}`
    case 'assign_to_me': return 'Assigned to you'
    case 'change_status': return `Status changed to ${(p.status || '').replace('_', ' ')}`
    case 'change_priority': return `Priority set to ${p.priority}`
    case 'change_labels': return `Added label "${p.label}"`
    case 'remove_label': return `Removed label "${p.label}"`
    case 'set_due_date': return `Due date set to ${p.date}`
    default: return 'Done'
  }
}
