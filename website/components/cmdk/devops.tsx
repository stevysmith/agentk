'use client'

import { Command, type AgentKToolDef, type AgentKProvider } from 'agentk'

// ─────────────────────────────────────────────────────────
// DevOps SVG icons (16x16, single-color currentColor)
// ─────────────────────────────────────────────────────────

const DevOpsIcons = {
  runTests: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13.5 4.5L6.5 11.5L2.5 7.5" />
    </svg>
  ),
  build: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 4L8 1.5L13.5 4V12L8 14.5L2.5 12V4Z" />
      <path d="M2.5 4L8 6.5L13.5 4" />
      <path d="M8 6.5V14.5" />
    </svg>
  ),
  deploy: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 1.5V10.5" />
      <path d="M4.5 7L8 10.5L11.5 7" />
      <path d="M2.5 13.5H13.5" />
    </svg>
  ),
  rollback: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 6.5H10C11.933 6.5 13.5 8.067 13.5 10C13.5 11.933 11.933 13.5 10 13.5H8" />
      <path d="M5.5 3.5L2.5 6.5L5.5 9.5" />
    </svg>
  ),
  scale: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2.5" width="5" height="4" rx="0.5" />
      <rect x="9" y="2.5" width="5" height="4" rx="0.5" />
      <rect x="2" y="9.5" width="5" height="4" rx="0.5" />
      <rect x="9" y="9.5" width="5" height="4" rx="0.5" />
    </svg>
  ),
  viewLogs: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="12" height="12" rx="1.5" />
      <path d="M5 6L7 8L5 10" />
      <path d="M9 10H12" />
    </svg>
  ),
}

// ─────────────────────────────────────────────────────────
// DevOps tools
// ─────────────────────────────────────────────────────────

const devopsTools: AgentKToolDef[] = [
  {
    name: 'run_tests',
    label: 'Run Tests',
    description: 'Testing',
    icon: DevOpsIcons.runTests,
    keywords: ['test', 'ci', 'check', 'validate'],
  },
  {
    name: 'build',
    label: 'Build',
    description: 'CI/CD',
    icon: DevOpsIcons.build,
    keywords: ['compile', 'package', 'artifact', 'ci'],
  },
  {
    name: 'deploy',
    label: 'Deploy',
    description: 'Deployment',
    icon: DevOpsIcons.deploy,
    keywords: ['ship', 'release', 'staging', 'production'],
    inputSchema: {
      type: 'object',
      properties: {
        environment: { type: 'string', enum: ['staging', 'production'] },
        branch: { type: 'string', description: 'Git branch to deploy' },
      },
      required: ['environment'],
    },
  },
  {
    name: 'rollback',
    label: 'Rollback',
    description: 'Recovery',
    icon: DevOpsIcons.rollback,
    keywords: ['undo', 'revert', 'previous', 'restore'],
  },
  {
    name: 'scale',
    label: 'Scale Service',
    description: 'Infrastructure',
    icon: DevOpsIcons.scale,
    keywords: ['replicas', 'instances', 'autoscale', 'horizontal'],
  },
  {
    name: 'view_logs',
    label: 'View Logs',
    description: 'Monitoring',
    icon: DevOpsIcons.viewLogs,
    keywords: ['logs', 'stdout', 'stderr', 'tail', 'debug'],
  },
]

// ─────────────────────────────────────────────────────────
// Mock agent provider
// ─────────────────────────────────────────────────────────

const mockDevOpsAgent: AgentKProvider = async (prompt) => {
  await new Promise((r) => setTimeout(r, 600))
  const q = prompt.toLowerCase()

  if (q.includes('deploy') && q.includes('staging')) {
    return {
      calls: [
        { toolName: 'run_tests', parameters: {} },
        { toolName: 'build', parameters: {} },
        { toolName: 'deploy', parameters: { environment: 'staging', branch: 'main' } },
      ],
      summary: 'Run tests, build, and deploy to staging from main.',
    }
  }

  if (q.includes('deploy') && (q.includes('production') || q.includes('prod'))) {
    return {
      calls: [
        { toolName: 'run_tests', parameters: {} },
        { toolName: 'build', parameters: {} },
        { toolName: 'deploy', parameters: { environment: 'production', branch: 'main' } },
      ],
      summary: 'Run tests, build, and deploy to production from main.',
    }
  }

  if (q.includes('rollback')) {
    return {
      calls: [{ toolName: 'rollback', parameters: {} }],
      summary: 'Roll back to the previous stable version.',
    }
  }

  if (q.includes('scale')) {
    return {
      calls: [{ toolName: 'scale', parameters: { replicas: 3 } }],
      summary: 'Scale the service to 3 replicas.',
    }
  }

  if (q.includes('log')) {
    return {
      calls: [{ toolName: 'view_logs', parameters: {} }],
      summary: 'Tail the latest application logs.',
    }
  }

  // Default: run tests and build
  return {
    calls: [
      { toolName: 'run_tests', parameters: {} },
      { toolName: 'build', parameters: {} },
    ],
    summary: 'Run the test suite and build the project.',
  }
}

// ─────────────────────────────────────────────────────────
// Mock tool executor
// ─────────────────────────────────────────────────────────

const handleToolExecute = async (toolName: string, _params: Record<string, any>) => {
  switch (toolName) {
    case 'run_tests':
      await new Promise((r) => setTimeout(r, 600))
      return { passed: 42, failed: 0, duration: '3.2s' }
    case 'build':
      await new Promise((r) => setTimeout(r, 800))
      return { artifact: 'app-v2.4.1.tar.gz', size: '24MB' }
    case 'deploy':
      await new Promise((r) => setTimeout(r, 500))
      return { url: 'https://staging.app.com', status: 'healthy' }
    case 'rollback':
      await new Promise((r) => setTimeout(r, 300))
      return { version: 'v2.3.0', status: 'rolled back' }
    case 'scale':
      await new Promise((r) => setTimeout(r, 400))
      return { replicas: 3, status: 'scaled' }
    case 'view_logs':
      await new Promise((r) => setTimeout(r, 300))
      return { lines: 150, errors: 0 }
    default:
      await new Promise((r) => setTimeout(r, 300))
      return { message: `${toolName} executed` }
  }
}

// ─────────────────────────────────────────────────────────
// Theme: DevOps
// ─────────────────────────────────────────────────────────

export default function DevOpsTheme() {
  return (
    <div className="palette-container devops-theme">
      <Command
        label="DevOps"
        tools={devopsTools}
        onToolExecute={handleToolExecute}
        agent={{
          provider: 'custom',
          providerFn: mockDevOpsAgent,
          requireApproval: true,
        }}
      >
        <Command.Input autoFocus placeholder="What needs to be done?" />
        <Command.List>
          <Command.Empty>No commands found.</Command.Empty>
          <Command.AgentHint />
          {devopsTools.map((t) => (
            <Command.Tool key={t.name} tool={t} />
          ))}
        </Command.List>
        <Command.ToolForm />
        <Command.ToolResult />
        <Command.Approval />
        <Command.ActivityFeed />
      </Command>
    </div>
  )
}
