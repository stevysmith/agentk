'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Command, useAgentK, type AgentKToolDef, type ToolExecution, type AgentKAgentConfig } from 'agentk'

// ─────────────────────────────────────────────────────────
// SVG Icons
// ─────────────────────────────────────────────────────────

const Icons = {
  rocket: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 11L1.5 14.5" />
      <path d="M11 5l3.5-3.5" />
      <path d="M8.5 2.5C10 1 13.5 1 14.5 1.5s.5 4.5-.5 6L10 11l-1.5 2.5L6 11 3 9.5 5 8l3.5-5.5z" />
      <circle cx="10.5" cy="5.5" r="1" />
    </svg>
  ),
  rollback: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 8h10a3 3 0 010 6H8" />
      <path d="M5 5L2 8l3 3" />
    </svg>
  ),
  scale: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="6" width="4" height="8" rx="1" />
      <rect x="6" y="3" width="4" height="11" rx="1" />
      <rect x="11" y="1" width="4" height="13" rx="1" />
    </svg>
  ),
  restart: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 2.5v4h4" />
      <path d="M2.5 6.5A5.5 5.5 0 118 13.5a5.5 5.5 0 01-4-1.7" />
    </svg>
  ),
  logs: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="12" height="12" rx="2" />
      <path d="M5 5h1M5 8h1M5 11h1M8 5h3M8 8h3M8 11h3" />
    </svg>
  ),
  database: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="8" cy="4" rx="5" ry="2" />
      <path d="M3 4v8c0 1.1 2.24 2 5 2s5-.9 5-2V4" />
      <path d="M3 8c0 1.1 2.24 2 5 2s5-.9 5-2" />
    </svg>
  ),
  cache: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4l8 8M12 4l-8 8" />
      <circle cx="8" cy="8" r="6" />
    </svg>
  ),
  check: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8.5l3.5 3.5L13 4" />
    </svg>
  ),
  x: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  ),
}

// ─────────────────────────────────────────────────────────
// Deploy state model
// ─────────────────────────────────────────────────────────

type PipelineStep = {
  name: string
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped'
  duration?: number
}

type Deployment = {
  id: string
  env: string
  branch: string
  status: string
  time: string
}

type DeployState = {
  status: 'idle' | 'building' | 'testing' | 'deploying' | 'checking' | 'success' | 'failed' | 'cancelled'
  currentStep: number
  steps: PipelineStep[]
  environment: 'production' | 'staging' | 'preview'
  branch: string
  commit: string
  logs: string[]
  deployments: Deployment[]
}

const INITIAL_STEPS: PipelineStep[] = [
  { name: 'Build', status: 'pending' },
  { name: 'Test', status: 'pending' },
  { name: 'Deploy', status: 'pending' },
  { name: 'Health Check', status: 'pending' },
]

const STEP_DURATIONS = [1500, 1000, 2000, 500]

function generateCommitHash(): string {
  return Math.random().toString(16).slice(2, 9)
}

function generateDeployId(): string {
  return 'dep_' + Math.random().toString(36).slice(2, 6)
}

function timeAgo(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ago`
}

const INITIAL_DEPLOYMENTS: Deployment[] = [
  { id: 'dep_x8k2', env: 'production', branch: 'main', status: 'success', time: '2m ago' },
  { id: 'dep_m3j9', env: 'staging', branch: 'feat/auth', status: 'success', time: '15m ago' },
  { id: 'dep_q1w4', env: 'preview', branch: 'fix/layout', status: 'success', time: '1h ago' },
  { id: 'dep_p7r6', env: 'production', branch: 'main', status: 'failed', time: '3h ago' },
  { id: 'dep_z5t8', env: 'staging', branch: 'feat/api', status: 'success', time: '5h ago' },
]

const INITIAL_STATE: DeployState = {
  status: 'idle',
  currentStep: -1,
  steps: INITIAL_STEPS.map((s) => ({ ...s })),
  environment: 'production',
  branch: 'main',
  commit: 'a3f8c21',
  logs: [
    '[info] System ready',
    '[info] Last deploy: dep_x8k2 (production) — 2m ago',
    '[info] All services healthy',
  ],
  deployments: INITIAL_DEPLOYMENTS,
}

// ─────────────────────────────────────────────────────────
// Tool definitions
// ─────────────────────────────────────────────────────────

const TOOLS: AgentKToolDef[] = [
  {
    name: 'deploy',
    label: 'Deploy',
    description: 'Deploy to an environment',
    icon: Icons.rocket,
    keywords: ['deploy', 'ship', 'release', 'push', 'publish'],
    inputSchema: {
      type: 'object',
      properties: {
        environment: { type: 'string', description: 'Target environment', enum: ['production', 'staging', 'preview'] },
        branch: { type: 'string', description: 'Git branch to deploy', default: 'main' },
      },
      required: ['environment'],
    },
  },
  {
    name: 'rollback',
    label: 'Rollback',
    description: 'Rollback to a previous deployment',
    icon: Icons.rollback,
    keywords: ['rollback', 'revert', 'undo', 'restore', 'previous'],
    inputSchema: {
      type: 'object',
      properties: {
        environment: { type: 'string', description: 'Target environment', enum: ['production', 'staging', 'preview'] },
        version: { type: 'string', description: 'Deployment ID to rollback to' },
      },
      required: ['environment', 'version'],
    },
  },
  {
    name: 'scale_service',
    label: 'Scale Service',
    description: 'Scale a service to N replicas',
    icon: Icons.scale,
    keywords: ['scale', 'replicas', 'instances', 'horizontal', 'autoscale'],
    inputSchema: {
      type: 'object',
      properties: {
        service: { type: 'string', description: 'Service to scale', enum: ['web', 'api', 'worker'] },
        replicas: { type: 'number', description: 'Number of replicas (1-10)', minimum: 1, maximum: 10 },
      },
      required: ['service', 'replicas'],
    },
  },
  {
    name: 'restart_service',
    label: 'Restart Service',
    description: 'Restart a running service',
    icon: Icons.restart,
    keywords: ['restart', 'reboot', 'bounce', 'cycle'],
    inputSchema: {
      type: 'object',
      properties: {
        service: { type: 'string', description: 'Service to restart', enum: ['web', 'api', 'worker', 'database'] },
      },
      required: ['service'],
    },
  },
  {
    name: 'view_logs',
    label: 'View Logs',
    description: 'View service logs',
    icon: Icons.logs,
    keywords: ['logs', 'output', 'stdout', 'stderr', 'tail'],
    inputSchema: {
      type: 'object',
      properties: {
        service: { type: 'string', description: 'Service', enum: ['web', 'api', 'worker', 'database'] },
        lines: { type: 'number', description: 'Number of lines (10-500)', minimum: 10, maximum: 500, default: 50 },
      },
      required: ['service'],
    },
  },
  {
    name: 'run_migration',
    label: 'Run Migration',
    description: 'Run a database migration',
    icon: Icons.database,
    keywords: ['migration', 'migrate', 'schema', 'database', 'db'],
    inputSchema: {
      type: 'object',
      properties: {
        direction: { type: 'string', description: 'Migration direction', enum: ['up', 'down'] },
        version: { type: 'string', description: 'Migration version identifier' },
      },
      required: ['direction', 'version'],
    },
  },
  {
    name: 'clear_cache',
    label: 'Clear Cache',
    description: 'Clear cache layers',
    icon: Icons.cache,
    keywords: ['cache', 'clear', 'purge', 'invalidate', 'flush', 'cdn'],
    inputSchema: {
      type: 'object',
      properties: {
        scope: { type: 'string', description: 'Cache scope to clear', enum: ['cdn', 'application', 'database', 'all'] },
      },
      required: ['scope'],
    },
  },
]

// ─────────────────────────────────────────────────────────
// Log message generators
// ─────────────────────────────────────────────────────────

const BUILD_LOGS = [
  '[build] Installing dependencies...',
  '[build] node_modules resolved (1,247 packages)',
  '[build] Compiling TypeScript...',
  '[build] Bundle size: 342kb (gzipped: 98kb)',
  '[build] Build completed successfully',
]

const TEST_LOGS = [
  '[test] Running test suite...',
  '[test] 47 tests passed, 0 failed',
  '[test] Coverage: 94.2% (branches: 89.1%)',
  '[test] All checks passed',
]

const DEPLOY_LOGS = [
  '[deploy] Creating container image...',
  '[deploy] Pushing to registry...',
  '[deploy] Updating service mesh...',
  '[deploy] Rolling out new instances...',
  '[deploy] Instance 1/3 healthy',
  '[deploy] Instance 2/3 healthy',
  '[deploy] Instance 3/3 healthy',
  '[deploy] Deployment complete',
]

const HEALTH_LOGS = [
  '[health] Running health checks...',
  '[health] HTTP 200 — /api/health (12ms)',
  '[health] HTTP 200 — /api/ready (8ms)',
  '[health] All endpoints healthy',
]

const STEP_LOGS = [BUILD_LOGS, TEST_LOGS, DEPLOY_LOGS, HEALTH_LOGS]
const STEP_STATUS_NAMES: DeployState['status'][] = ['building', 'testing', 'deploying', 'checking']

// ─────────────────────────────────────────────────────────
// Service log generators
// ─────────────────────────────────────────────────────────

function generateServiceLogs(service: string, lines: number): string[] {
  const templates: Record<string, string[]> = {
    web: [
      'GET /dashboard 200 12ms',
      'GET /api/user 200 8ms',
      'POST /api/deploy 201 45ms',
      'GET /static/app.js 304 2ms',
      'WebSocket connection opened (client: 10.0.1.42)',
      'GET /health 200 1ms',
    ],
    api: [
      'POST /v1/deployments 201 34ms',
      'GET /v1/services 200 12ms',
      'PATCH /v1/services/web/scale 200 89ms',
      'GET /v1/metrics 200 5ms',
      'Rate limit check passed (token: ak_***)',
      'Cache HIT /v1/config (ttl: 300s)',
    ],
    worker: [
      'Processing job: build_image (queue: builds)',
      'Job completed: build_image (2.3s)',
      'Processing job: run_tests (queue: ci)',
      'Job completed: run_tests (4.1s)',
      'Processing job: notify_slack (queue: notifications)',
      'Job completed: notify_slack (0.2s)',
    ],
    database: [
      'Query OK: SELECT * FROM deployments (2.1ms, 47 rows)',
      'Query OK: INSERT INTO audit_log (0.8ms)',
      'Connection pool: 12/50 active',
      'Replication lag: 0.3ms',
      'Checkpoint completed (WAL: 16MB)',
      'VACUUM: deployments (dead tuples: 0)',
    ],
  }
  const pool = templates[service] || templates.web
  const result: string[] = []
  for (let i = 0; i < Math.min(lines, 50); i++) {
    const ts = new Date(Date.now() - (lines - i) * 1000).toISOString().slice(11, 19)
    result.push(`[${ts}] ${pool[i % pool.length]}`)
  }
  return result
}

// ─────────────────────────────────────────────────────────
// Page component
// ─────────────────────────────────────────────────────────

export default function DevOpsDemo() {
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<DeployState>(INITIAL_STATE)
  const [selectedEnv, setSelectedEnv] = useState<'production' | 'staging' | 'preview'>('production')
  const logEndRef = useRef<HTMLDivElement>(null)
  const cancelRef = useRef<(() => void) | null>(null)

  // Auto-scroll logs
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [state.logs.length])

  // Cmd+K handler
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

  // Pipeline runner — runs step by step with delays
  const runPipeline = useCallback(
    (env: 'production' | 'staging' | 'preview', branch: string, signal?: AbortSignal): Promise<any> => {
      return new Promise((resolve, reject) => {
        const commit = generateCommitHash()
        const deployId = generateDeployId()
        const startTime = Date.now()

        setState((s) => ({
          ...s,
          status: 'building',
          currentStep: 0,
          environment: env,
          branch,
          commit,
          steps: INITIAL_STEPS.map((step) => ({ ...step, status: 'pending' as const })),
          logs: [
            ...s.logs,
            '',
            `━━━ Deploy ${deployId} → ${env} (${branch}@${commit}) ━━━`,
          ],
        }))

        let stepIndex = 0
        let logIndex = 0
        let cancelled = false

        const onCancel = () => {
          cancelled = true
          setState((s) => {
            const newSteps = s.steps.map((step, i) => {
              if (i < stepIndex) return step
              if (i === stepIndex) return { ...step, status: 'failed' as const, duration: Date.now() - startTime }
              return { ...step, status: 'skipped' as const }
            })
            return {
              ...s,
              status: 'cancelled',
              steps: newSteps,
              logs: [...s.logs, '[cancelled] Pipeline cancelled by user'],
            }
          })
          reject(new Error('Pipeline cancelled'))
        }

        if (signal) {
          signal.addEventListener('abort', onCancel, { once: true })
        }

        // Store cancel function so we can reference it
        cancelRef.current = onCancel

        const runStep = () => {
          if (cancelled) return
          if (stepIndex >= INITIAL_STEPS.length) {
            // All steps complete
            const elapsed = Date.now() - startTime
            setState((s) => ({
              ...s,
              status: 'success',
              logs: [...s.logs, `[success] Deployed in ${(elapsed / 1000).toFixed(1)}s`],
              deployments: [
                { id: deployId, env, branch, status: 'success', time: 'just now' },
                ...s.deployments.slice(0, 4),
              ],
            }))
            resolve({ success: true, deployId, environment: env, branch, commit, duration: `${(elapsed / 1000).toFixed(1)}s` })
            return
          }

          const stepLogs = STEP_LOGS[stepIndex]
          const stepDuration = STEP_DURATIONS[stepIndex]
          const stepStartTime = Date.now()

          // Mark step as running
          setState((s) => {
            const newSteps = [...s.steps]
            newSteps[stepIndex] = { ...newSteps[stepIndex], status: 'running' }
            return {
              ...s,
              status: STEP_STATUS_NAMES[stepIndex],
              currentStep: stepIndex,
            }
          })

          // Drip feed logs for this step
          logIndex = 0
          const logInterval = stepDuration / stepLogs.length

          const feedLog = () => {
            if (cancelled) return
            if (logIndex < stepLogs.length) {
              const log = stepLogs[logIndex]
              setState((s) => ({
                ...s,
                steps: s.steps.map((step, i) => (i === stepIndex ? { ...step, status: 'running' } : step)),
                logs: [...s.logs, log],
              }))
              logIndex++
              setTimeout(feedLog, logInterval)
            } else {
              // Step complete
              const duration = Date.now() - stepStartTime
              setState((s) => {
                const newSteps = [...s.steps]
                newSteps[stepIndex] = { ...newSteps[stepIndex], status: 'success', duration }
                return { ...s, steps: newSteps }
              })
              stepIndex++
              setTimeout(runStep, 100)
            }
          }

          feedLog()
        }

        // Start first step after brief pause
        setTimeout(runStep, 200)
      })
    },
    [],
  )

  // Tool executor
  const executeTool = useCallback(
    async (name: string, params: Record<string, any>, signal?: AbortSignal) => {
      switch (name) {
        case 'deploy': {
          const env = (params.environment || 'staging') as 'production' | 'staging' | 'preview'
          const branch = (params.branch || 'main') as string
          setSelectedEnv(env)
          return runPipeline(env, branch, signal)
        }

        case 'rollback': {
          const env = params.environment || 'production'
          const version = params.version || 'previous'
          setState((s) => ({
            ...s,
            logs: [...s.logs, '', `[rollback] Rolling back ${env} to ${version}...`],
            status: 'deploying',
            steps: [
              { name: 'Rollback', status: 'running' },
            ],
            currentStep: 0,
          }))
          await new Promise((r) => setTimeout(r, 2000))
          if (signal?.aborted) throw new Error('Rollback cancelled')
          const deployId = generateDeployId()
          setState((s) => ({
            ...s,
            status: 'success',
            steps: [{ name: 'Rollback', status: 'success', duration: 2000 }],
            logs: [...s.logs, `[rollback] Successfully rolled back to ${version}`, `[rollback] Deploy ID: ${deployId}`],
            deployments: [
              { id: deployId, env, branch: `rollback→${version}`, status: 'success', time: 'just now' },
              ...s.deployments.slice(0, 4),
            ],
          }))
          return { success: true, deployId, environment: env, version }
        }

        case 'scale_service': {
          const service = params.service || 'web'
          const replicas = params.replicas || 3
          await new Promise((r) => setTimeout(r, 200))
          setState((s) => ({
            ...s,
            logs: [...s.logs, `[scale] ${service} scaled to ${replicas} replicas`],
          }))
          return { success: true, service, replicas }
        }

        case 'restart_service': {
          const service = params.service || 'web'
          await new Promise((r) => setTimeout(r, 200))
          setState((s) => ({
            ...s,
            logs: [...s.logs, `[restart] ${service} restarted successfully`],
          }))
          return { success: true, service }
        }

        case 'view_logs': {
          const service = params.service || 'web'
          const lines = params.lines || 50
          await new Promise((r) => setTimeout(r, 200))
          const logLines = generateServiceLogs(service, lines)
          setState((s) => ({
            ...s,
            logs: [...s.logs, '', `━━━ ${service} logs (last ${lines} lines) ━━━`, ...logLines],
          }))
          return { success: true, service, lines: logLines.length }
        }

        case 'run_migration': {
          const direction = params.direction || 'up'
          const version = params.version || '001'
          await new Promise((r) => setTimeout(r, 200))
          setState((s) => ({
            ...s,
            logs: [
              ...s.logs,
              `[migration] Running migration ${version} (${direction})...`,
              `[migration] Migration ${version} ${direction === 'up' ? 'applied' : 'reverted'} successfully`,
            ],
          }))
          return { success: true, direction, version }
        }

        case 'clear_cache': {
          const scope = params.scope || 'all'
          await new Promise((r) => setTimeout(r, 200))
          const details: Record<string, string> = {
            cdn: 'CDN edge cache purged (234 objects)',
            application: 'Application cache cleared (Redis: 1.2MB freed)',
            database: 'Database query cache invalidated (47 entries)',
            all: 'All caches cleared (CDN + Application + Database)',
          }
          setState((s) => ({
            ...s,
            logs: [...s.logs, `[cache] ${details[scope] || details.all}`],
          }))
          return { success: true, scope, detail: details[scope] }
        }

        default:
          throw new Error(`Unknown tool: ${name}`)
      }
    },
    [runPipeline],
  )

  // Agent config — custom provider simulates LLM
  const agentConfig: AgentKAgentConfig = {
    provider: 'custom',
    providerFn: async (prompt: string) => {
      await new Promise((r) => setTimeout(r, 400))
      const p = prompt.toLowerCase()

      if (p.includes('deploy') && p.includes('prod')) {
        return {
          summary: 'Deploy main branch to production',
          calls: [{ toolName: 'deploy', parameters: { environment: 'production', branch: 'main' } }],
        }
      }
      if (p.includes('deploy') && p.includes('stag')) {
        return {
          summary: 'Deploy to staging',
          calls: [{ toolName: 'deploy', parameters: { environment: 'staging', branch: 'main' } }],
        }
      }
      if (p.includes('deploy') && p.includes('preview')) {
        return {
          summary: 'Deploy to preview',
          calls: [{ toolName: 'deploy', parameters: { environment: 'preview', branch: 'main' } }],
        }
      }
      if (p.includes('deploy')) {
        return {
          summary: 'Deploy to staging',
          calls: [{ toolName: 'deploy', parameters: { environment: 'staging', branch: 'main' } }],
        }
      }
      if (p.includes('rollback') && p.includes('prod')) {
        return {
          summary: 'Rollback production to previous deployment',
          calls: [{ toolName: 'rollback', parameters: { environment: 'production', version: state.deployments[0]?.id || 'dep_x8k2' } }],
        }
      }
      if (p.includes('rollback')) {
        return {
          summary: 'Rollback to previous deployment',
          calls: [{ toolName: 'rollback', parameters: { environment: 'staging', version: state.deployments[0]?.id || 'dep_x8k2' } }],
        }
      }
      if (p.includes('scale') && p.includes('api')) {
        return {
          summary: 'Scale up the API service',
          calls: [{ toolName: 'scale_service', parameters: { service: 'api', replicas: 5 } }],
        }
      }
      if (p.includes('scale')) {
        return {
          summary: 'Scale the web service',
          calls: [{ toolName: 'scale_service', parameters: { service: 'web', replicas: 3 } }],
        }
      }
      if (p.includes('restart')) {
        const service = p.includes('api') ? 'api' : p.includes('worker') ? 'worker' : p.includes('db') || p.includes('database') ? 'database' : 'web'
        return {
          summary: `Restart the ${service} service`,
          calls: [{ toolName: 'restart_service', parameters: { service } }],
        }
      }
      if (p.includes('log')) {
        const service = p.includes('api') ? 'api' : p.includes('worker') ? 'worker' : p.includes('db') || p.includes('database') ? 'database' : 'web'
        return {
          summary: `View ${service} logs`,
          calls: [{ toolName: 'view_logs', parameters: { service, lines: 50 } }],
        }
      }
      if (p.includes('migrat')) {
        const direction = p.includes('down') || p.includes('revert') ? 'down' : 'up'
        return {
          summary: `Run database migration ${direction}`,
          calls: [{ toolName: 'run_migration', parameters: { direction, version: '20240315_001' } }],
        }
      }
      if (p.includes('cache') || p.includes('purge') || p.includes('flush')) {
        const scope = p.includes('cdn') ? 'cdn' : p.includes('app') ? 'application' : p.includes('db') || p.includes('database') ? 'database' : 'all'
        return {
          summary: `Clear ${scope} cache`,
          calls: [{ toolName: 'clear_cache', parameters: { scope } }],
        }
      }

      return { summary: 'No matching action found.', calls: [] }
    },
    requireApproval: true,
  }

  const handleModeChange = useCallback((mode: string) => {
    if (mode === 'result') {
      setTimeout(() => setOpen(false), 2000)
    }
  }, [])

  const isPipelineActive = ['building', 'testing', 'deploying', 'checking'].includes(state.status)

  return (
    <div className="devops-page">
      <style>{STYLES}</style>

      {/* ── Top bar ── */}
      <header className="devops-header">
        <div className="devops-header-left">
          <span className="devops-logo">
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 2h5l7 6-5 6H2V2z" />
              <circle cx="5.5" cy="8" r="1" fill="currentColor" />
            </svg>
            Deployments
          </span>
          <span className="devops-header-sep">/</span>
          <span className="devops-project-name">acme-app</span>
        </div>
        <div className="devops-header-right">
          {/* Environment selector pills */}
          <div className="devops-env-pills">
            {(['production', 'staging', 'preview'] as const).map((env) => (
              <button
                key={env}
                className={`devops-env-pill devops-env-pill--${env} ${selectedEnv === env ? 'devops-env-pill--active' : ''}`}
                onClick={() => setSelectedEnv(env)}
              >
                <span className="devops-env-dot" />
                {env}
              </button>
            ))}
          </div>
          <button className="devops-trigger" onClick={() => setOpen(true)}>
            <span className="devops-trigger-text">Run command...</span>
            <kbd>&#8984;K</kbd>
          </button>
        </div>
      </header>

      {/* ── Main content ── */}
      <div className="devops-main">
        {/* Left: Pipeline visualization */}
        <div className="devops-pipeline-panel">
          <div className="devops-pipeline-header">
            <h2 className="devops-panel-title">Pipeline</h2>
            {state.status !== 'idle' && (
              <span className={`devops-pipeline-badge devops-pipeline-badge--${state.status}`}>
                {state.status}
              </span>
            )}
          </div>

          {state.status === 'idle' ? (
            <div className="devops-pipeline-idle">
              <div className="devops-pipeline-idle-icon">
                <svg width="40" height="40" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" opacity="0.3">
                  <path d="M5 11L1.5 14.5" />
                  <path d="M11 5l3.5-3.5" />
                  <path d="M8.5 2.5C10 1 13.5 1 14.5 1.5s.5 4.5-.5 6L10 11l-1.5 2.5L6 11 3 9.5 5 8l3.5-5.5z" />
                  <circle cx="10.5" cy="5.5" r="1" />
                </svg>
              </div>
              <p className="devops-pipeline-idle-text">No active pipeline</p>
              <p className="devops-pipeline-idle-sub">Press <kbd>&#8984;K</kbd> and deploy to get started</p>
            </div>
          ) : (
            <div className="devops-pipeline-steps">
              <div className="devops-pipeline-meta">
                <span className="devops-pipeline-env">{state.environment}</span>
                <span className="devops-pipeline-branch">{state.branch}@{state.commit}</span>
              </div>
              {state.steps.map((step, i) => (
                <div key={step.name} className="devops-step">
                  {i > 0 && (
                    <div className={`devops-step-line devops-step-line--${state.steps[i - 1].status}`} />
                  )}
                  <div className={`devops-step-row`}>
                    <div className={`devops-step-dot devops-step-dot--${step.status}`}>
                      {step.status === 'success' && Icons.check}
                      {step.status === 'failed' && Icons.x}
                    </div>
                    <span className={`devops-step-name devops-step-name--${step.status}`}>{step.name}</span>
                    {step.duration !== undefined && (
                      <span className="devops-step-duration">{(step.duration / 1000).toFixed(1)}s</span>
                    )}
                    {step.status === 'running' && (
                      <span className="devops-step-duration devops-step-duration--running">running...</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Recent deployments */}
        <div className="devops-deployments-panel">
          <h2 className="devops-panel-title">Recent Deployments</h2>
          <div className="devops-deploy-table">
            <div className="devops-deploy-header-row">
              <span>ID</span>
              <span>Environment</span>
              <span>Branch</span>
              <span>Status</span>
              <span>Time</span>
            </div>
            {state.deployments.map((dep) => (
              <div key={dep.id} className="devops-deploy-row">
                <span className="devops-deploy-id">{dep.id}</span>
                <span className={`devops-deploy-env devops-deploy-env--${dep.env}`}>{dep.env}</span>
                <span className="devops-deploy-branch">{dep.branch}</span>
                <span className={`devops-deploy-status devops-deploy-status--${dep.status}`}>{dep.status}</span>
                <span className="devops-deploy-time">{dep.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Bottom: Log panel ── */}
      <div className="devops-log-panel">
        <div className="devops-log-header">
          <h3 className="devops-log-title">Output</h3>
          <div className="devops-log-actions">
            {isPipelineActive && (
              <span className="devops-log-status devops-log-status--active">
                <span className="devops-log-live-dot" />
                Live
              </span>
            )}
            <button
              className="devops-log-clear"
              onClick={() => setState((s) => ({ ...s, logs: ['[info] Log cleared'] }))}
            >
              Clear
            </button>
          </div>
        </div>
        <div className="devops-log-output">
          {state.logs.map((line, i) => (
            <div key={i} className={`devops-log-line ${getLogClass(line)}`}>
              {line}
            </div>
          ))}
          <div ref={logEndRef} />
        </div>
      </div>

      {/* ── Hint ── */}
      <p className="devops-hint">
        Press <kbd>&#8984;</kbd><kbd>K</kbd> to open the command palette. Try &ldquo;deploy to production&rdquo; or &ldquo;scale up the API&rdquo;.
      </p>

      {/* ── Command palette ── */}
      <Command.Dialog
        open={open}
        onOpenChange={setOpen}
        onToolExecute={executeTool}
        onModeChange={handleModeChange}
        tools={TOOLS}
        agent={agentConfig}
        timeout={15000}
        label="DevOps commands"
      >
        <Command.Input placeholder="Run a command..." />
        <DevOpsPaletteBody />
        <DevOpsPaletteFooter />
      </Command.Dialog>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Log line styling helper
// ─────────────────────────────────────────────────────────

function getLogClass(line: string): string {
  if (line.startsWith('[success]') || line.includes('completed') || line.includes('healthy') || line.includes('passed') || line.includes('successfully')) return 'devops-log-line--success'
  if (line.startsWith('[error]') || line.includes('failed') || line.includes('Error')) return 'devops-log-line--error'
  if (line.startsWith('[cancelled]')) return 'devops-log-line--warn'
  if (line.startsWith('[rollback]')) return 'devops-log-line--warn'
  if (line.startsWith('[info]')) return 'devops-log-line--info'
  if (line.startsWith('━')) return 'devops-log-line--separator'
  return ''
}

// ─────────────────────────────────────────────────────────
// Palette body
// ─────────────────────────────────────────────────────────

function DevOpsPaletteBody() {
  const ak = useAgentK()
  const showList = ak.state.mode === 'browse'

  return (
    <>
      {showList && (
        <Command.List>
          <Command.Group heading="Deploy">
            {TOOLS.slice(0, 2).map((t) => (
              <Command.Tool key={t.name} tool={t}>
                <span className="devops-tool-icon">{t.icon}</span>
                {t.label}
              </Command.Tool>
            ))}
          </Command.Group>
          <Command.Group heading="Infrastructure">
            {TOOLS.slice(2).map((t) => (
              <Command.Tool key={t.name} tool={t}>
                <span className="devops-tool-icon">{t.icon}</span>
                {t.label}
              </Command.Tool>
            ))}
          </Command.Group>
          <Command.Empty>No matching commands.</Command.Empty>
        </Command.List>
      )}
      <Command.AgentHint />
      <Command.Approval />
      <Command.ToolForm />
      <Command.ToolResult renderResult={(execution: ToolExecution) => {
        if (execution.error) {
          return (
            <div className="devops-result">
              <span className="devops-result-icon devops-result-icon--error">{Icons.x}</span>
              <span className="devops-result-message">{execution.error}</span>
            </div>
          )
        }
        const result = execution.result || {}
        let message = 'Done'
        switch (execution.toolName) {
          case 'deploy':
            message = `Deployed ${result.branch || 'main'} to ${result.environment || 'staging'} (${result.deployId || '?'}) in ${result.duration || '?'}`
            break
          case 'rollback':
            message = `Rolled back ${result.environment || '?'} to ${result.version || '?'} (${result.deployId || '?'})`
            break
          case 'scale_service':
            message = `Scaled ${result.service || '?'} to ${result.replicas || '?'} replicas`
            break
          case 'restart_service':
            message = `Restarted ${result.service || '?'}`
            break
          case 'view_logs':
            message = `Fetched ${result.lines || '?'} log lines from ${result.service || '?'}`
            break
          case 'run_migration':
            message = `Migration ${result.version || '?'} (${result.direction || '?'}) complete`
            break
          case 'clear_cache':
            message = result.detail || `Cleared ${result.scope || '?'} cache`
            break
        }
        return (
          <div className="devops-result">
            <span className="devops-result-icon devops-result-icon--success">{Icons.check}</span>
            <span className="devops-result-message">{message}</span>
            {execution.startedAt && (
              <span className="devops-result-duration">
                {((Date.now() - execution.startedAt) / 1000).toFixed(1)}s
              </span>
            )}
          </div>
        )
      }} />
      <Command.ActivityFeed />
    </>
  )
}

// ─────────────────────────────────────────────────────────
// Palette footer
// ─────────────────────────────────────────────────────────

function DevOpsPaletteFooter() {
  const ak = useAgentK()

  return (
    <div className="devops-palette-footer">
      <div className="devops-palette-footer-keys">
        {ak.state.mode === 'browse' && !ak.agentHintVisible && (
          <>
            <span className="devops-footer-key"><kbd>&#8593;&#8595;</kbd> navigate</span>
            <span className="devops-footer-key"><kbd>&#8629;</kbd> select</span>
            <span className="devops-footer-key"><kbd>esc</kbd> close</span>
          </>
        )}
        {ak.state.mode === 'browse' && ak.agentHintVisible && (
          <>
            <span className="devops-footer-key"><kbd>&#8629;</kbd> ask agent</span>
            <span className="devops-footer-key"><kbd>esc</kbd> close</span>
          </>
        )}
        {ak.state.mode === 'form' && (
          <>
            <span className="devops-footer-key"><kbd>&#8629;</kbd> execute</span>
            <span className="devops-footer-key"><kbd>esc</kbd> back</span>
          </>
        )}
        {ak.state.mode === 'planning' && (
          <span className="devops-footer-key"><kbd>esc</kbd> cancel</span>
        )}
        {ak.state.mode === 'executing' && (
          <span className="devops-footer-key"><kbd>esc</kbd> cancel</span>
        )}
        {ak.state.mode === 'approval' && (
          <>
            <span className="devops-footer-key"><kbd>&#8629;</kbd> approve</span>
            <span className="devops-footer-key"><kbd>esc</kbd> reject</span>
          </>
        )}
        {ak.state.mode === 'result' && (
          <span className="devops-footer-key"><kbd>&#8629;</kbd> dismiss</span>
        )}
      </div>
      <span className="devops-palette-footer-brand">
        <span className="devops-palette-footer-dot" />
        agentk
      </span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────

const STYLES = `
/* ── DevOps page ── */

.devops-page {
  min-height: 100dvh;
  background: var(--bg);
  color: var(--text);
  font-family: var(--font);
  display: flex;
  flex-direction: column;
}

/* ── Header ── */

.devops-header {
  position: sticky;
  top: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 56px;
  padding: 0 24px;
  background: rgba(10, 10, 10, 0.85);
  backdrop-filter: saturate(180%) blur(12px);
  -webkit-backdrop-filter: saturate(180%) blur(12px);
  border-bottom: 1px solid var(--border);
}

.devops-header-left {
  display: flex;
  align-items: center;
  gap: 0;
}

.devops-logo {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.devops-header-sep {
  margin: 0 10px;
  color: var(--border-focus);
  font-weight: 300;
  font-size: 20px;
}

.devops-project-name {
  font-size: 14px;
  color: var(--text-2);
  font-weight: 400;
}

.devops-header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

/* ── Environment pills ── */

.devops-env-pills {
  display: flex;
  gap: 4px;
}

.devops-env-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
  font-family: var(--font);
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-3);
  cursor: pointer;
  transition: all 150ms;
  text-transform: capitalize;
}

.devops-env-pill:hover {
  border-color: var(--border-focus);
  color: var(--text-2);
}

.devops-env-pill--active {
  color: var(--text);
}

.devops-env-pill--production.devops-env-pill--active {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.3);
  color: #f87171;
}

.devops-env-pill--staging.devops-env-pill--active {
  background: rgba(245, 158, 11, 0.1);
  border-color: rgba(245, 158, 11, 0.3);
  color: #fbbf24;
}

.devops-env-pill--preview.devops-env-pill--active {
  background: rgba(59, 130, 246, 0.1);
  border-color: rgba(59, 130, 246, 0.3);
  color: #60a5fa;
}

.devops-env-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.6;
}

.devops-env-pill--active .devops-env-dot {
  opacity: 1;
  box-shadow: 0 0 6px currentColor;
}

/* ── Trigger button ── */

.devops-trigger {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 7px 7px 7px 14px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-3);
  font-size: 13px;
  font-family: var(--font);
  cursor: pointer;
  transition: background 150ms, border-color 150ms, color 150ms;
  min-width: 200px;
}

.devops-trigger:hover {
  background: var(--bg-elevated);
  border-color: var(--border-focus);
  color: var(--text-2);
}

.devops-trigger-text {
  font-size: 13px;
}

.devops-trigger kbd {
  font-family: var(--font);
  font-size: 11px;
  padding: 2px 6px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: var(--text-3);
}

/* ── Main layout ── */

.devops-main {
  display: grid;
  grid-template-columns: 360px 1fr;
  gap: 1px;
  background: var(--border);
  flex: 1;
  min-height: 0;
}

.devops-pipeline-panel,
.devops-deployments-panel {
  background: var(--bg);
  padding: 24px;
}

.devops-panel-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 20px;
}

/* ── Pipeline visualization ── */

.devops-pipeline-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0;
}

.devops-pipeline-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 999px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.devops-pipeline-badge--building,
.devops-pipeline-badge--testing,
.devops-pipeline-badge--deploying,
.devops-pipeline-badge--checking {
  background: rgba(59, 130, 246, 0.15);
  color: #60a5fa;
}

.devops-pipeline-badge--success {
  background: rgba(34, 197, 94, 0.15);
  color: #4ade80;
}

.devops-pipeline-badge--failed {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
}

.devops-pipeline-badge--cancelled {
  background: rgba(245, 158, 11, 0.15);
  color: #fbbf24;
}

.devops-pipeline-idle {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 20px;
  text-align: center;
}

.devops-pipeline-idle-icon {
  margin-bottom: 16px;
  color: var(--text-3);
}

.devops-pipeline-idle-text {
  font-size: 14px;
  color: var(--text-3);
  margin-bottom: 8px;
}

.devops-pipeline-idle-sub {
  font-size: 12px;
  color: var(--text-3);
  opacity: 0.6;
}

.devops-pipeline-idle-sub kbd {
  font-size: 11px;
  padding: 1px 5px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 3px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  font-family: var(--font);
}

.devops-pipeline-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
  font-size: 12px;
}

.devops-pipeline-env {
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-2);
  font-weight: 500;
  text-transform: capitalize;
}

.devops-pipeline-branch {
  color: var(--text-3);
  font-family: var(--mono);
  font-size: 11px;
}

.devops-pipeline-steps {
  padding-top: 4px;
}

.devops-step {
  position: relative;
}

.devops-step-line {
  position: absolute;
  left: 9px;
  top: -16px;
  width: 2px;
  height: 16px;
  background: var(--border);
  transition: background 300ms;
}

.devops-step-line--success {
  background: var(--green);
}

.devops-step-line--running {
  background: var(--accent);
}

.devops-step-line--failed {
  background: var(--red);
}

.devops-step-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
}

.devops-step-dot {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 300ms;
}

.devops-step-dot--pending {
  background: var(--bg-elevated);
  border: 2px solid var(--border);
}

.devops-step-dot--running {
  background: rgba(59, 130, 246, 0.2);
  border: 2px solid var(--accent);
  animation: devops-pulse 1.5s ease-in-out infinite;
}

.devops-step-dot--success {
  background: rgba(34, 197, 94, 0.2);
  border: 2px solid var(--green);
  color: var(--green);
}

.devops-step-dot--failed {
  background: rgba(239, 68, 68, 0.2);
  border: 2px solid var(--red);
  color: var(--red);
}

.devops-step-dot--skipped {
  background: var(--bg-elevated);
  border: 2px solid var(--border);
  opacity: 0.4;
}

@keyframes devops-pulse {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4);
  }
  50% {
    box-shadow: 0 0 0 6px rgba(59, 130, 246, 0);
  }
}

.devops-step-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-2);
  flex: 1;
}

.devops-step-name--running {
  color: var(--text);
}

.devops-step-name--success {
  color: var(--green);
}

.devops-step-name--failed {
  color: var(--red);
}

.devops-step-name--skipped {
  color: var(--text-3);
  opacity: 0.5;
}

.devops-step-duration {
  font-size: 11px;
  font-family: var(--mono);
  color: var(--text-3);
}

.devops-step-duration--running {
  color: var(--accent);
  animation: devops-text-pulse 1.5s ease-in-out infinite;
}

@keyframes devops-text-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

/* ── Deployment table ── */

.devops-deploy-table {
  font-size: 12px;
}

.devops-deploy-header-row {
  display: grid;
  grid-template-columns: 80px 100px 1fr 80px 70px;
  gap: 8px;
  padding: 8px 12px;
  color: var(--text-3);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-size: 10px;
  border-bottom: 1px solid var(--border);
}

.devops-deploy-row {
  display: grid;
  grid-template-columns: 80px 100px 1fr 80px 70px;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
  transition: background 150ms;
}

.devops-deploy-row:hover {
  background: rgba(255, 255, 255, 0.02);
}

.devops-deploy-id {
  font-family: var(--mono);
  color: var(--text-3);
  font-size: 11px;
}

.devops-deploy-env {
  font-weight: 500;
  text-transform: capitalize;
}

.devops-deploy-env--production { color: #f87171; }
.devops-deploy-env--staging { color: #fbbf24; }
.devops-deploy-env--preview { color: #60a5fa; }

.devops-deploy-branch {
  font-family: var(--mono);
  color: var(--text-2);
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.devops-deploy-status {
  font-weight: 500;
}

.devops-deploy-status--success { color: var(--green); }
.devops-deploy-status--failed { color: var(--red); }
.devops-deploy-status--running { color: var(--accent); }

.devops-deploy-time {
  color: var(--text-3);
}

/* ── Log panel ── */

.devops-log-panel {
  border-top: 1px solid var(--border);
  background: #0c0c0c;
  display: flex;
  flex-direction: column;
  max-height: 260px;
}

.devops-log-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 20px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.devops-log-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-3);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.devops-log-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.devops-log-status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 500;
}

.devops-log-status--active {
  color: var(--green);
}

.devops-log-live-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--green);
  box-shadow: 0 0 6px var(--green);
  animation: devops-pulse-dot 2s ease-in-out infinite;
}

@keyframes devops-pulse-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.devops-log-clear {
  font-size: 11px;
  font-family: var(--font);
  color: var(--text-3);
  background: none;
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 2px 8px;
  cursor: pointer;
  transition: all 150ms;
}

.devops-log-clear:hover {
  color: var(--text-2);
  border-color: var(--border-focus);
}

.devops-log-output {
  flex: 1;
  overflow-y: auto;
  padding: 12px 20px;
  font-family: var(--mono);
  font-size: 12px;
  line-height: 1.7;
  color: var(--text-3);
}

.devops-log-output::-webkit-scrollbar { width: 6px; }
.devops-log-output::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
.devops-log-output::-webkit-scrollbar-track { background: transparent; }

.devops-log-line {
  white-space: pre-wrap;
  word-break: break-all;
}

.devops-log-line--success { color: var(--green); }
.devops-log-line--error { color: var(--red); }
.devops-log-line--warn { color: var(--amber); }
.devops-log-line--info { color: var(--text-3); }
.devops-log-line--separator {
  color: var(--text-2);
  font-weight: 600;
  margin-top: 4px;
}

/* ── Hint ── */

.devops-hint {
  text-align: center;
  padding: 16px;
  font-size: 12px;
  color: var(--text-3);
  border-top: 1px solid var(--border);
}

.devops-hint kbd {
  font-family: var(--font);
  font-size: 11px;
  padding: 1px 5px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 3px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

/* ── Tool icon in palette ── */

.devops-tool-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  color: var(--text-3);
  flex-shrink: 0;
  margin-right: 4px;
}

/* ── Result display ── */

.devops-result {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
}

.devops-result-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  flex-shrink: 0;
}

.devops-result-icon--success {
  background: rgba(34, 197, 94, 0.15);
  color: var(--green);
}

.devops-result-icon--error {
  background: rgba(239, 68, 68, 0.15);
  color: var(--red);
}

.devops-result-message {
  font-size: 13px;
  color: var(--text);
  flex: 1;
}

.devops-result-duration {
  font-size: 11px;
  font-family: var(--mono);
  color: var(--text-3);
}

/* ── Palette footer ── */

.devops-palette-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px;
  border-top: 1px solid var(--border);
  font-size: 11px;
}

.devops-palette-footer-keys {
  display: flex;
  gap: 10px;
}

.devops-footer-key {
  color: var(--text-3);
  display: flex;
  align-items: center;
  gap: 4px;
}

.devops-footer-key kbd {
  font-family: var(--font);
  font-size: 10px;
  padding: 1px 4px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 3px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: var(--text-3);
}

.devops-palette-footer-brand {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-3);
  font-weight: 500;
}

.devops-palette-footer-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--green);
  box-shadow: 0 0 4px var(--green);
}

/* ── Responsive ── */

@media (max-width: 800px) {
  .devops-main {
    grid-template-columns: 1fr;
  }

  .devops-env-pills {
    display: none;
  }

  .devops-deploy-header-row,
  .devops-deploy-row {
    grid-template-columns: 70px 80px 1fr 60px;
  }

  .devops-deploy-time {
    display: none;
  }
}
`
