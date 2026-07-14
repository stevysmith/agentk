'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { motion, AnimatePresence, type Transition } from 'framer-motion'
import { Command } from 'agentk'
import {
  LEARN_TOOLS,
  TOOL_ACCENTS,
  LearnIcons,
  summarizeSchema,
  formatCall,
  type HomeState,
  type PlanCall,
  type ParamSummary,
} from './tools'

/* ─────────────────────────────────────────────────────────
 * STAGE PANEL STORYBOARD (within-stage micro-animations)
 *
 * The page's scroll position picks the stage (0-6); this file
 * animates what happens INSIDE the panel when a stage lands.
 *
 *    zone swap   spring crossfade + 12px rise (mode="wait")
 *    stage 1     tool cards stagger in (60ms apart), device
 *                cards grow a matching mono chip
 *    stage 4     0ms prompt bubble → 350ms "matching keywords…"
 *                → 900ms plan rows land (180ms stagger)
 *    stage 5     approval rows tick ✓ as the plan executes
 * ───────────────────────────────────────────────────────── */

const PLAN_TIMING = {
  thinking: 350, // "matching keywords…" line appears
  calls: 900, // first plan row lands
  callStaggerS: 0.18, // seconds between plan rows
}

const STAGGER = {
  toolCardS: 0.06, // seconds between tool cards (stage 1)
  agentRowS: 0.05, // seconds between agent's-eye rows (stage 3)
}

const ZONE_OFFSET_Y = 12 // px each zone rises from on entry

const SPRING = {
  zone: { type: 'spring', stiffness: 300, damping: 30 } as Transition,
  row: { type: 'spring', stiffness: 350, damping: 28 } as Transition,
}

const INSTANT: Transition = { duration: 0 }

// Stage indices (mirrors STAGE in app/learn/page.tsx)
const S = { PIXELS: 0, TOOLS: 1, PALETTE: 2, AGENT: 3, PLAN: 4, APPROVAL: 5, SHIP: 6 } as const

// ─── Shared prop types ───

export type WebMCPPanel = {
  mode: 'live-read' | 'live-registered' | 'simulated'
  /** Which WebMCP surface actually matched — document.modelContext (Chrome
   *  150+) or navigator.modelContext (earlier origin-trial builds). */
  surface: 'document.modelContext' | 'navigator.modelContext'
  tools: { name: string; description?: string; params: ParamSummary[] }[]
}

export type ApprovalState = {
  status: 'pending' | 'running' | 'done' | 'rejected'
  doneCount: number
}

type LearnStageProps = {
  stage: number
  home: HomeState
  flash: Set<string>
  executeTool: (name: string, params: Record<string, any>) => Promise<any>
  webmcp: WebMCPPanel
  prompt: string
  plan: PlanCall[]
  approval: ApprovalState
  onApprove: () => void
  onReject: () => void
  onResetApproval: () => void
  reducedMotion: boolean
}

// ─────────────────────────────────────────────────────────
// Stage panel
// ─────────────────────────────────────────────────────────

export function LearnStage(props: LearnStageProps) {
  const { stage, reducedMotion } = props
  const t = (spring: Transition) => (reducedMotion ? INSTANT : spring)


  // aria-live is scoped to individual status lines (device readings, the
  // live/simulated badge, approval status) — NOT this container, so a
  // scroll-driven zone swap doesn't re-announce the whole panel.
  return (
    <div className="ls-panel">
      <AnimatePresence initial={false}>
        {stage !== S.SHIP && (
          <motion.div
            key="devices"
            className="ls-devices-wrap"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={t(SPRING.zone)}
          >
            <Devices {...props} t={t} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* All zones stay mounted, stacked in one grid cell, crossfaded by
          opacity. No AnimatePresence here on purpose: mode="wait" wedges
          permanently when the stage changes mid-exit (fast scrolling), and
          keeping zones mounted also preserves their interactive state. */}
      <div className="ls-zone">
        {(
          [
            [S.PIXELS, <PixelsZone key="z-pixels" />],
            [S.TOOLS, <ToolCardsZone key="z-tools" t={t} />],
            [S.PALETTE, <PaletteZone key="z-palette" executeTool={props.executeTool} />],
            [S.AGENT, <AgentZone key="z-agent" webmcp={props.webmcp} t={t} />],
            [S.PLAN, <PlanZone key="z-plan" prompt={props.prompt} plan={props.plan} reducedMotion={reducedMotion} t={t} />],
            [
              S.APPROVAL,
              <ApprovalZone
                key="z-approval"
                prompt={props.prompt}
                plan={props.plan}
                approval={props.approval}
                onApprove={props.onApprove}
                onReject={props.onReject}
                onResetApproval={props.onResetApproval}
              />,
            ],
            [S.SHIP, <ShipZone key="z-ship" />],
          ] as [number, ReactNode][]
        ).map(([zoneStage, node]) => {
          const active = stage === zoneStage
          return (
            <motion.div
              key={`zone-${zoneStage}`}
              className="ls-zone-inner"
              initial={false}
              animate={{
                opacity: active ? 1 : 0,
                y: reducedMotion || active ? 0 : ZONE_OFFSET_Y,
              }}
              transition={t(SPRING.zone)}
              style={{ gridArea: '1 / 1', pointerEvents: active ? 'auto' : 'none' }}
              aria-hidden={active ? undefined : true}
            >
              {node}
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Devices — always-visible mini smart home (stages 0-5)
// ─────────────────────────────────────────────────────────

const THERMOSTAT_LIMITS = { min: 60, max: 85 } // matches the tool's inputSchema
const LIGHT_ON_LEVEL = 80 // level restored when toggling a light back on

function Devices({
  home,
  flash,
  stage,
  executeTool,
  t,
}: LearnStageProps & { t: (s: Transition) => Transition }) {
  const showChips = stage >= S.TOOLS

  return (
    <div className="ls-devices">
      {/* Light */}
      <div
        className={`ls-device ${flash.has('light') ? 'ls-device--flash' : ''}`}
        style={{ '--device-accent': TOOL_ACCENTS.set_lights, '--glow': home.light.on ? home.light.level / 130 : 0 } as React.CSSProperties}
      >
        <div className="ls-device-head">
          <span className="ls-device-icon" data-lit={home.light.on || undefined}>{LearnIcons.lightbulb}</span>
          <span className="ls-device-name">Light</span>
          <button
            className="ls-device-toggle"
            data-on={home.light.on || undefined}
            onClick={() => executeTool('set_lights', { level: home.light.on ? 0 : LIGHT_ON_LEVEL })}
            aria-label={home.light.on ? 'Turn light off' : 'Turn light on'}
          >
            <span className="ls-toggle-knob" />
          </button>
        </div>
        <div className="ls-device-reading" aria-live="polite">{home.light.on ? `${home.light.level}%` : 'Off'}</div>
        <div className="ls-bar"><div className="ls-bar-fill" style={{ width: `${home.light.on ? home.light.level : 0}%`, background: TOOL_ACCENTS.set_lights }} /></div>
        <DeviceChip show={showChips} name="set_lights" t={t} />
      </div>

      {/* Thermostat */}
      <div
        className={`ls-device ${flash.has('thermostat') ? 'ls-device--flash' : ''}`}
        style={{ '--device-accent': TOOL_ACCENTS.set_thermostat } as React.CSSProperties}
      >
        <div className="ls-device-head">
          <span className="ls-device-icon">{LearnIcons.thermometer}</span>
          <span className="ls-device-name">Thermostat</span>
        </div>
        <div className="ls-device-reading" aria-live="polite">{home.thermostat.temp}°F</div>
        <div className="ls-thermo-buttons">
          <button
            className="ls-step-btn"
            onClick={() => executeTool('set_thermostat', { temp: Math.max(THERMOSTAT_LIMITS.min, home.thermostat.temp - 1) })}
            aria-label="Lower temperature"
          >
            −
          </button>
          <button
            className="ls-step-btn"
            onClick={() => executeTool('set_thermostat', { temp: Math.min(THERMOSTAT_LIMITS.max, home.thermostat.temp + 1) })}
            aria-label="Raise temperature"
          >
            +
          </button>
        </div>
        <DeviceChip show={showChips} name="set_thermostat" t={t} />
      </div>

      {/* Speaker */}
      <div
        className={`ls-device ${flash.has('music') ? 'ls-device--flash' : ''}`}
        style={{ '--device-accent': TOOL_ACCENTS.play_music } as React.CSSProperties}
      >
        <div className="ls-device-head">
          <span className="ls-device-icon" data-lit={home.music.playing || undefined}>{LearnIcons.music}</span>
          <span className="ls-device-name">Speaker</span>
        </div>
        <div className="ls-device-reading" aria-live="polite">{home.music.playing ? home.music.genre : 'Silent'}</div>
        {home.music.playing ? (
          <div className="ls-eq" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((i) => <span key={i} className="ls-eq-bar" style={{ animationDelay: `${i * 0.13}s` }} />)}
          </div>
        ) : (
          <button className="ls-play-btn" onClick={() => executeTool('play_music', { genre: 'ambient' })}>
            Play ambient
          </button>
        )}
        {home.music.playing && (
          <button className="ls-play-btn" onClick={() => executeTool('play_music', { genre: 'off' })}>
            Stop
          </button>
        )}
        <DeviceChip show={showChips} name="play_music" t={t} />
      </div>
    </div>
  )
}

function DeviceChip({ show, name, t }: { show: boolean; name: string; t: (s: Transition) => Transition }) {
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.code
          className="ls-device-chip"
          style={{ color: TOOL_ACCENTS[name] }}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={t(SPRING.row)}
        >
          <span className="ls-chip-dot" style={{ background: TOOL_ACCENTS[name] }} />
          {name}
        </motion.code>
      )}
    </AnimatePresence>
  )
}

// ─────────────────────────────────────────────────────────
// Stage 0 — what an agent sees today: pixels and DOM soup
// ─────────────────────────────────────────────────────────

const DOM_SOUP = `<div class="x9k _f3 css-1qhz">
  <svg viewBox="0 0 16 16">…</svg>
  <span class="v _t">72°</span>
  <button class="btn-4a" onclick="…">
    <i class="ico ico--sm"></i>
  </button>
</div>`

function PixelsZone() {
  return (
    <div className="ls-card">
      <div className="ls-card-label">What an agent sees today</div>
      <pre className="ls-soup" aria-label="Minified markup with no meaning"><code>{DOM_SOUP}</code></pre>
      <p className="ls-card-note">
        Scrape the DOM. Guess which pixel is a button. Click and hope.
        It breaks the moment the markup changes.
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Stage 1 — the page declares its tools
// ─────────────────────────────────────────────────────────

function ToolCardsZone({ t }: { t: (s: Transition) => Transition }) {
  return (
    <div className="ls-toolcards">
      {LEARN_TOOLS.map((tool, i) => (
        <motion.div
          key={tool.name}
          className="ls-toolcard"
          style={{ '--tool-accent': TOOL_ACCENTS[tool.name] } as React.CSSProperties}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...t(SPRING.row), delay: i * STAGGER.toolCardS }}
        >
          <div className="ls-toolcard-head">
            <span className="ls-chip-dot" style={{ background: TOOL_ACCENTS[tool.name] }} />
            <code className="ls-toolcard-name">{tool.name}</code>
          </div>
          <p className="ls-toolcard-desc">{tool.description}</p>
          <div className="ls-toolcard-schema">
            {summarizeSchema(tool.inputSchema).map((p) => (
              <code key={p.key} className="ls-param">
                <span className="ls-param-key">{p.key}</span>
                <span className="ls-param-type">{p.type}</span>
                {p.detail && <span className="ls-param-detail">{p.detail}</span>}
              </code>
            ))}
          </div>
        </motion.div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Stage 2 — live inline palette (humans)
// ─────────────────────────────────────────────────────────

function PaletteZone({ executeTool }: { executeTool: (name: string, params: Record<string, any>) => Promise<any> }) {
  return (
    <div className="ls-palette">
      <Command label="Walkthrough command palette" tools={LEARN_TOOLS} onToolExecute={executeTool}>
        <Command.Input placeholder="Search tools…" />
        <Command.List>
          <Command.Empty>No matching tools.</Command.Empty>
          {LEARN_TOOLS.map((tool) => (
            <Command.Tool key={tool.name} tool={tool} />
          ))}
        </Command.List>
        <Command.ToolForm />
        <Command.ToolResult />
      </Command>
      <p className="ls-card-note">
        This palette is live — run a tool and the devices above change.
        The form is generated from the schema: enum → dropdown, bounded number → slider.
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Stage 3 — the agent's-eye view (real or simulated, labeled)
// ─────────────────────────────────────────────────────────

// Badge + note name the surface that actually matched: document.modelContext
// (Chrome 150+) or navigator.modelContext (earlier origin-trial builds).
function agentModeCopy(
  mode: WebMCPPanel['mode'],
  surface: WebMCPPanel['surface'],
): { badge: string; note: string; live: boolean } {
  switch (mode) {
    case 'live-read':
      return {
        badge: `live — read from ${surface}`,
        note: 'This list is read back from the browser’s WebMCP surface right now. An agent on this page sees the same thing.',
        live: true,
      }
    case 'live-registered':
      return {
        badge: `live — registered on ${surface}`,
        note: `This page just registered these tools on ${surface}. Chrome doesn’t expose a page-readable listing here, so this shows the exact catalog that was registered.`,
        live: true,
      }
    case 'simulated':
      return {
        badge: 'simulated',
        note: 'Your browser does not expose WebMCP yet — this is exactly what an agent sees in Chrome with the origin trial active.',
        live: false,
      }
  }
}

function AgentZone({ webmcp, t }: { webmcp: WebMCPPanel; t: (s: Transition) => Transition }) {
  const copy = agentModeCopy(webmcp.mode, webmcp.surface)
  return (
    <div className="ls-card ls-agent">
      <div className="ls-agent-head">
        <code className="ls-agent-title">{webmcp.surface}</code>
        <span className={`ls-agent-badge ${copy.live ? 'ls-agent-badge--live' : ''}`} aria-live="polite">{copy.badge}</span>
      </div>
      <div className="ls-agent-rows">
        {webmcp.tools.map((tool, i) => (
          <motion.div
            key={tool.name}
            className="ls-agent-row"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...t(SPRING.row), delay: i * STAGGER.agentRowS }}
          >
            <code className="ls-agent-tool">{tool.name}</code>
            <span className="ls-agent-desc">{tool.description}</span>
            <span className="ls-agent-params">
              {tool.params.map((p) => (
                <code key={p.key} className="ls-param">
                  <span className="ls-param-key">{p.key}</span>
                  <span className="ls-param-type">{p.type}</span>
                  {p.detail && <span className="ls-param-detail">{p.detail}</span>}
                </code>
              ))}
            </span>
          </motion.div>
        ))}
      </div>
      <p className="ls-card-note">{copy.note}</p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Stage 4 — one sentence becomes a plan (scripted matcher)
// ─────────────────────────────────────────────────────────

function PlanZone({
  prompt,
  plan,
  reducedMotion,
  t,
}: {
  prompt: string
  plan: PlanCall[]
  reducedMotion: boolean
  t: (s: Transition) => Transition
}) {
  // 0: prompt only · 1: "matching keywords…" · 2: plan rows land
  const [sub, setSub] = useState(reducedMotion ? 2 : 0)

  useEffect(() => {
    if (reducedMotion) {
      setSub(2)
      return
    }
    setSub(0)
    const timers = [
      setTimeout(() => setSub(1), PLAN_TIMING.thinking),
      setTimeout(() => setSub(2), PLAN_TIMING.calls),
    ]
    return () => timers.forEach(clearTimeout)
  }, [reducedMotion])

  return (
    <div className="ls-card">
      <div className="ls-prompt">
        <span className="ls-prompt-quote">&ldquo;</span>
        {prompt}
        <span className="ls-prompt-quote">&rdquo;</span>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {sub === 1 && (
          <motion.div
            key="thinking"
            className="ls-plan-thinking"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={t(SPRING.row)}
          >
            matching keywords…
          </motion.div>
        )}
        {sub >= 2 && (
          <motion.div key="calls" className="ls-plan-calls" initial={false}>
            {plan.map((call, i) => (
              <motion.div
                key={call.toolName}
                className="ls-plan-call"
                initial={{ opacity: 0, x: reducedMotion ? 0 : -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ ...t(SPRING.row), delay: reducedMotion ? 0 : i * PLAN_TIMING.callStaggerS }}
              >
                <span className="ls-plan-index">{i + 1}</span>
                <code className="ls-plan-code" style={{ color: TOOL_ACCENTS[call.toolName] }}>{formatCall(call)}</code>
                <span className="ls-plan-note">{call.note}</span>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <p className="ls-card-note">
        Planner scripted for this walkthrough — keyword matching, not a live LLM.
        In your app you plug in Anthropic, OpenAI, Gemini, or your own provider.
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Stage 5 — human in the loop: approve and run for real
// ─────────────────────────────────────────────────────────

/** Past-tense summary of what the plan just ran, derived from the plan
 *  itself so it can never contradict later device changes or drift from
 *  the plan data in tools.tsx. */
function summarizePlanRun(plan: PlanCall[]): string {
  return plan
    .map((call) => {
      switch (call.toolName) {
        case 'set_lights':
          return `lights to ${call.parameters.level}%`
        case 'set_thermostat':
          return `thermostat to ${call.parameters.temp}°F`
        case 'play_music':
          return `${call.parameters.genre} on the speaker`
        default:
          return formatCall(call)
      }
    })
    .join(', ')
}

function ApprovalZone({
  prompt,
  plan,
  approval,
  onApprove,
  onReject,
  onResetApproval,
}: {
  prompt: string
  plan: PlanCall[]
  approval: ApprovalState
  onApprove: () => void
  onReject: () => void
  onResetApproval: () => void
}) {
  const { status, doneCount } = approval

  return (
    <div className="ls-card ls-approval-card">
      <div data-agentk-approval="">
        <div data-agentk-approval-summary="">
          Agent plan for &ldquo;{prompt}&rdquo; — {plan.length} tool calls. Nothing runs until you approve.
        </div>
        <div data-agentk-approval-calls="">
          {plan.map((call, i) => {
            const done = i < doneCount
            const running = status === 'running' && i === doneCount
            return (
              <div key={call.toolName} data-agentk-approval-call="">
                <span data-agentk-approval-call-icon="">
                  {done ? <span className="ls-call-done">✓</span> : running ? <span className="ls-call-spinner" aria-label="running" /> : <span className="ls-call-idx">{i + 1}</span>}
                </span>
                <span data-agentk-approval-call-name="">{call.toolName}</span>
                <span data-agentk-approval-call-params="">
                  {Object.entries(call.parameters).map(([k, v]) => (
                    <span key={k} data-agentk-approval-param="">
                      {k}: <span data-agentk-approval-param-value="">{String(v)}</span>
                    </span>
                  ))}
                </span>
              </div>
            )
          })}
        </div>

        {status === 'pending' && (
          <div data-agentk-approval-actions="">
            <button data-agentk-approval-reject="" onClick={onReject}>Reject</button>
            <button data-agentk-approval-approve="" onClick={onApprove}>Approve &amp; run</button>
          </div>
        )}
        {/* Live region scoped to the status line only — buttons stay outside */}
        <div aria-live="polite">
          {status === 'running' && <p className="ls-approval-status">Running the plan against the devices above…</p>}
          {status === 'done' && (
            <p className="ls-approval-status">✓ Plan executed — {summarizePlanRun(plan)}.</p>
          )}
          {status === 'rejected' && (
            <p className="ls-approval-status">Plan discarded. Nothing ran — that&rsquo;s the point.</p>
          )}
        </div>
        {status === 'done' && (
          <div className="ls-approval-done">
            <button className="ls-ghost-btn" onClick={onResetApproval}>Reset and show the plan again</button>
          </div>
        )}
        {status === 'rejected' && (
          <div className="ls-approval-done">
            <button className="ls-ghost-btn" onClick={onResetApproval}>Show the plan again</button>
          </div>
        )}
      </div>
      <p className="ls-card-note">
        requireApproval is opt-in — plans execute instantly by default. Gate what warrants a human.
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Stage 6 — ship it: honest status, install, links
// ─────────────────────────────────────────────────────────

const SHIP_STATUS = [
  'WebMCP is a Chrome origin trial (Chrome 149–156), not a shipped standard. The API even moved mid-trial, from navigator.modelContext to document.modelContext.',
  'It is being developed in the W3C Web Machine Learning Community Group.',
  'Firefox and Safari don’t have it.',
  'agentk feature-detects: without WebMCP you still ship a full command palette. Nothing breaks.',
]

const SHIP_LINKS = [
  { label: 'Full Smart Home demo', href: '/smart-home', external: false },
  { label: 'agentk on GitHub', href: 'https://github.com/stevysmith/agentk', external: true },
  { label: 'WebMCP spec repo (W3C)', href: 'https://github.com/webmachinelearning/webmcp', external: true },
  { label: 'Chrome WebMCP docs', href: 'https://developer.chrome.com/docs/ai/webmcp', external: true },
]

const INSTALL_CMD = 'npm install @stevysmith/agentk'
const COPY_RESET_MS = 2000

function ShipZone() {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(INSTALL_CMD)
    } catch {
      /* clipboard unavailable — nothing else to do */
    }
    setCopied(true)
    setTimeout(() => setCopied(false), COPY_RESET_MS)
  }

  return (
    <div className="ls-card ls-ship">
      <div className="ls-card-label">Where this stands</div>
      <ul className="ls-ship-status">
        {SHIP_STATUS.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <button className="ls-install" onClick={copy}>
        {copied ? '✓ Copied!' : (
          <>
            <code>{INSTALL_CMD}</code>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <rect x="5" y="5" width="9" height="9" rx="1.5" />
              <path d="M11 5V3.5A1.5 1.5 0 009.5 2h-6A1.5 1.5 0 002 3.5v6A1.5 1.5 0 003.5 11H5" />
            </svg>
          </>
        )}
      </button>
      <div className="ls-ship-links">
        {SHIP_LINKS.map((link) => (
          <a
            key={link.href}
            className="ls-ship-link"
            href={link.href}
            {...(link.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          >
            {link.label}
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </a>
        ))}
      </div>
    </div>
  )
}
