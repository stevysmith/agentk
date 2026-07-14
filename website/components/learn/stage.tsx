'use client'

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from 'react'
import { motion, AnimatePresence, useSpring, useTransform, type Transition } from 'framer-motion'
import {
  LEARN_TOOLS,
  TOOL_ACCENTS,
  WEBMCP_PREFIX,
  LearnIcons,
  summarizeSchema,
  formatCall,
  type HomeState,
  type PlanCall,
} from './tools'

/* ─────────────────────────────────────────────────────────
 * STAGE STORYBOARD — one object, progressively refined
 *
 * The scroll position picks stage 0-6 (app/learn/page.tsx).
 * The TOOL RAIL — the three tool rows — renders ONCE and
 * morphs its skin per stage. It never unmounts between
 * stages 1-5; only stages 0 (pixels) and 6 (ship) are
 * crossfade zones.
 *
 * stage 0  rail rests hidden (fade + 0.98 scale). DOM-soup
 *          card shows what an agent sees today.
 * stage 1  rows land as schema cards — accent edge, mono
 *          name, description, param chips. 60ms stagger.
 * stage 2  palette chrome fades in AROUND the same rows:
 *          search input + group label above, live note
 *          below. Rows tighten into palette skin (hover,
 *          chevron); clicking one expands a schema-generated
 *          form inline (enum → select, bounded number →
 *          slider) with a Run button wired to the real
 *          executor — the devices above respond.
 * stage 3  agent chrome replaces palette chrome: surface
 *          header + live/simulated badge above, honesty
 *          footnote below. Each mono name gains an animated
 *          `learn_` prefix (width/opacity — the name itself
 *          never remounts).
 * stage 4  prompt bubble above; +350ms "matching keywords…";
 *          +900ms call params slide into the rows (80ms
 *          stagger, near-full opacity — dimming is reserved
 *          for queued rows in the stage-5 run).
 * stage 5  Reject / Approve & run dock beneath the rows; on
 *          approve the rows tick ✓ sequentially (550ms gap)
 *          and the devices actually change. Queued rows dim
 *          until they execute.
 * stage 6  rail fades/scales out; ship panel crossfades in.
 *          The devices persist in a condensed skin — the
 *          object of the walkthrough is never abandoned.
 *
 * Every timing/spring lives in TUNE below.
 * ───────────────────────────────────────────────────────── */

// ─── TUNE — every timing and spring on this stage ───
// Defaults are hand-picked to feel calm and precise: zone
// crossfades are softer/slower than the row morphs; rows use
// layout springs with a whisper of bounce.

export const TUNE = {
  // ── zone crossfades (pixels ↔ rail ↔ ship swap) — softer than row morphs
  zoneFadeMs: 380, // ms — opacity/scale crossfade between stage zones
  zoneRise: 12, //    px — inactive zones rest ABOVE their slot (negative only: bottom overflow inflates scrollHeight)
  zoneScale: 0.98, // resting scale of an inactive zone

  // ── rail rows (the persistent tool rail, stages 1-5)
  rowVisualDuration: 0.6, // s — layout spring for row size/position morphs (lands after the crossfade midpoint so the morph reads)
  rowBounce: 0.14, //          bounce for the same spring (0 = no overshoot)
  rowStaggerS: 0.06, //        s between rows when the rail first lands (stage 1)
  rowSkinMs: 420, //           ms — CSS skin morph of the rows (background/border/padding/radius) so 1→2 etc. reads as a morph, not a cut

  // ── chrome (palette / agent / plan / approval furniture around the rows)
  chromeMs: 260, // ms — collapse+fade of chrome blocks (CSS grid-rows trick)
  prefixMs: 300, // ms — learn_ prefix width/opacity morph (stage 3)

  // ── plan beat (stage 4)
  planThinkingMs: 350, //    ms — "matching keywords…" line appears
  planCallsMs: 900, //       ms — call params land in the rows
  planCallStaggerS: 0.08, // s between rows gaining their params (short — arrival must not read as the approval run's queued dimming)

  // ── devices
  deviceVisualDuration: 0.5, // s — light-bar fill + thermostat number spring
  deviceBounce: 0.18, //         bounce for the device spring
  approvalStepMs: 550, //        ms between executed plan steps (read by page.tsx)
  deviceFlashMs: 600, //         ms a device card stays highlighted after a tool runs (read by page.tsx)
}

type Tune = typeof TUNE

const INSTANT: Transition = { duration: 0 }

// Stage indices (mirrors STAGE in app/learn/page.tsx)
const S = { PIXELS: 0, TOOLS: 1, PALETTE: 2, AGENT: 3, PLAN: 4, APPROVAL: 5, SHIP: 6 } as const

/** Build every framer-motion transition from the (possibly live-tuned)
 *  TUNE values. Reduced motion collapses all of them to duration 0. */
function makeMotion(tune: Tune, reduced: boolean) {
  if (reduced) return { zone: INSTANT, row: INSTANT, prefix: INSTANT, bar: INSTANT }
  return {
    zone: { duration: tune.zoneFadeMs / 1000, ease: [0.32, 0, 0.24, 1] } as Transition,
    row: { type: 'spring', visualDuration: tune.rowVisualDuration, bounce: tune.rowBounce } as Transition,
    prefix: { duration: tune.prefixMs / 1000, ease: [0.32, 0, 0.24, 1] } as Transition,
    bar: { type: 'spring', visualDuration: tune.deviceVisualDuration, bounce: tune.deviceBounce } as Transition,
  }
}
type MotionSet = ReturnType<typeof makeMotion>

// ─── Shared prop types ───

/** Stage-3 badge state. The rail always renders the local catalog (its rows
 *  persist across stages); page.tsx verifies the browser readback against
 *  that catalog and only reports 'live-read' when they provably match. */
export type WebMCPPanel = {
  mode: 'live-read' | 'live-registered' | 'simulated'
  /** Which WebMCP surface actually matched — document.modelContext (Chrome
   *  150+) or navigator.modelContext (earlier origin-trial builds). */
  surface: 'document.modelContext' | 'navigator.modelContext'
}

export type ApprovalState = {
  status: 'pending' | 'running' | 'done' | 'rejected'
  doneCount: number
}

type ExecuteTool = (name: string, params: Record<string, any>) => Promise<any>

type LearnStageProps = {
  stage: number
  home: HomeState
  flash: Set<string>
  executeTool: ExecuteTool
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
  const tune = TUNE
  const T = useMemo(() => makeMotion(tune, reducedMotion), [tune, reducedMotion])
  const railActive = stage >= S.TOOLS && stage <= S.APPROVAL

  // Plan beat sub-phase (stage 4): 0 prompt only · 1 "matching keywords…" ·
  // 2 call params land in the rows. Replays each time stage 4 is entered.
  const [planPhase, setPlanPhase] = useState(0)
  useEffect(() => {
    if (stage < S.PLAN) {
      setPlanPhase(0)
      return
    }
    if (stage > S.PLAN || reducedMotion) {
      setPlanPhase(2)
      return
    }
    setPlanPhase(0)
    const timers = [
      setTimeout(() => setPlanPhase(1), tune.planThinkingMs),
      setTimeout(() => setPlanPhase(2), tune.planCallsMs),
    ]
    return () => timers.forEach(clearTimeout)
  }, [stage, reducedMotion, tune.planThinkingMs, tune.planCallsMs])

  const zones: [string, boolean, ReactNode][] = [
    ['pixels', stage === S.PIXELS, <PixelsZone key="z-pixels" />],
    [
      'rail',
      railActive,
      <ToolRail
        key="z-rail"
        stage={stage}
        railActive={railActive}
        plan={props.plan}
        prompt={props.prompt}
        webmcp={props.webmcp}
        approval={props.approval}
        planPhase={planPhase}
        executeTool={props.executeTool}
        onApprove={props.onApprove}
        onReject={props.onReject}
        onResetApproval={props.onResetApproval}
        T={T}
        tune={tune}
      />,
    ],
    ['ship', stage === S.SHIP, <ShipZone key="z-ship" />],
  ]

  // aria-live is scoped to individual status lines (device readings, the
  // live/simulated badge, approval status) — NOT this container, so a
  // scroll-driven zone swap doesn't re-announce the whole panel.
  return (
    <div
      className="ls-panel"
      role="region"
      aria-label="Interactive walkthrough stage"
      style={
        {
          '--chrome-ms': reducedMotion ? '0ms' : `${tune.chromeMs}ms`,
          '--skin-ms': reducedMotion ? '0ms' : `${tune.rowSkinMs}ms`,
        } as CSSProperties
      }
    >
      {/* The devices persist through EVERY stage — including stage 6, where
          they condense (controls hide, padding tightens) instead of
          unmounting. The walkthrough's object never leaves the stage, and
          the first device card's top edge never moves. */}
      <div className="ls-devices-wrap" data-condensed={stage === S.SHIP || undefined}>
        <Devices {...props} T={T} tune={tune} />
      </div>

      {/* Three zone members stay mounted, stacked in one grid cell, and
          crossfade by opacity. The rail member is ONE persistent component
          across stages 1-5 — the continuity of the walkthrough. No
          AnimatePresence here on purpose: mode="wait" wedges permanently
          when the stage changes mid-exit (fast scrolling), and keeping the
          members mounted preserves their interactive state. */}
      <div className="ls-zone">
        {zones.map(([key, active, node]) => (
          <motion.div
            key={`zone-${key}`}
            className="ls-zone-inner"
            initial={false}
            animate={{
              opacity: active ? 1 : 0,
              // Inactive zones rest ABOVE (negative y) and slightly scaled
              // down: translated overflow past the bottom edge inflates
              // scrollHeight and resurrects the phantom scrollbar; top
              // overflow and scale-down never do.
              y: reducedMotion || active ? 0 : -tune.zoneRise,
              scale: reducedMotion || active ? 1 : tune.zoneScale,
            }}
            transition={T.zone}
            style={{
              // Only the active zone participates in layout. Inactive zones
              // are absolutely positioned AND bounded to the container with
              // overflow hidden — absolute children that extend past the box
              // still count toward scrollHeight, which put a phantom
              // scrollbar on the stage.
              position: active ? 'relative' : 'absolute',
              inset: active ? undefined : 0,
              overflow: active ? undefined : 'hidden',
              pointerEvents: active ? 'auto' : 'none',
            }}
            inert={active ? undefined : true}
          >
            {node}
          </motion.div>
        ))}
      </div>

    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Collapse — all-mounted show/hide that contributes ZERO
// height when hidden (CSS grid 0fr→1fr trick, see styles).
// `inert` keeps hidden interactive chrome out of the tab
// order and the accessibility tree.
// ─────────────────────────────────────────────────────────

function Collapse({ show, className = '', children }: { show: boolean; className?: string; children: ReactNode }) {
  // inert alone (no aria-hidden): it removes the subtree from both the tab
  // order and the accessibility tree, and unlike aria-hidden it is legal
  // while a descendant still holds focus (the browser moves focus out).
  return (
    <div
      className={`ls-collapse ${className}`}
      data-show={show || undefined}
      inert={show ? undefined : true}
    >
      <div className="ls-collapse-inner">{children}</div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Tool rail — the ONE persistent catalog (stages 1-5).
// Chrome fades in around the same three rows; the rows morph
// skin per stage and never unmount.
// ─────────────────────────────────────────────────────────

type ToolDef = (typeof LEARN_TOOLS)[number]

function ToolRail({
  stage,
  railActive,
  plan,
  prompt,
  webmcp,
  approval,
  planPhase,
  executeTool,
  onApprove,
  onReject,
  onResetApproval,
  T,
  tune,
}: {
  stage: number
  railActive: boolean
  plan: PlanCall[]
  prompt: string
  webmcp: WebMCPPanel
  approval: ApprovalState
  planPhase: number
  executeTool: ExecuteTool
  onApprove: () => void
  onReject: () => void
  onResetApproval: () => void
  T: MotionSet
  tune: Tune
}) {
  const isPalette = stage === S.PALETTE
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  // Leaving the palette stage resets its local chrome state so the rows
  // are all present (and closed) whenever the palette skin returns.
  useEffect(() => {
    if (stage !== S.PALETTE) {
      setQuery('')
      setExpanded(null)
    }
  }, [stage])

  const copy = agentModeCopy(webmcp.mode, webmcp.surface)
  const { status, doneCount } = approval

  const planRank = useMemo(() => new Map(plan.map((c, i) => [c.toolName, i] as const)), [plan])
  const planByName = useMemo(() => new Map(plan.map((c) => [c.toolName, c] as const)), [plan])
  // Rows reorder to plan order at stages 4-5 (framer layout animates the
  // move if the orders ever differ).
  const ordered = useMemo(() => {
    if (stage < S.PLAN) return LEARN_TOOLS
    return [...LEARN_TOOLS].sort(
      (a, b) => (planRank.get(a.name) ?? LEARN_TOOLS.length) - (planRank.get(b.name) ?? LEARN_TOOLS.length),
    )
  }, [stage, planRank])

  const q = query.trim().toLowerCase()
  const matches = (tool: ToolDef) =>
    !q ||
    tool.name.toLowerCase().includes(q) ||
    (tool.label ?? '').toLowerCase().includes(q) ||
    (tool.description ?? '').toLowerCase().includes(q) ||
    (tool.keywords ?? []).some((k) => k.toLowerCase().includes(q))
  const anyMatch = LEARN_TOOLS.some(matches)

  const showCallParams = (stage === S.PLAN && planPhase >= 2) || stage === S.APPROVAL

  return (
    <div
      className="ls-rail"
      data-stage={stage}
      data-hoverable={(stage >= S.PALETTE && stage <= S.APPROVAL) || undefined}
    >
      {/* ── chrome above the rows ── */}

      {/* stage 3: modelContext panel header (live/simulated semantics unchanged) */}
      <Collapse show={stage === S.AGENT}>
        <div className="ls-chrome-block">
          <div className="ls-agent-head">
            <code className="ls-agent-title">{webmcp.surface}</code>
            <span className={`ls-agent-badge ${copy.live ? 'ls-agent-badge--live' : ''}`} aria-live="polite">
              {copy.badge}
            </span>
          </div>
          {/* explains the dimmed prefix that appears on the names below */}
          <p className="ls-agent-note">
            This page registers its tools under a <code>{WEBMCP_PREFIX}</code> namespace.
          </p>
        </div>
      </Collapse>

      {/* stage 2: palette chrome */}
      <Collapse show={isPalette}>
        <div className="ls-chrome-block">
          <input
            className="ls-palette-input"
            type="text"
            placeholder="Search tools…"
            aria-label="Search tools"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="ls-palette-group">Tools</div>
        </div>
      </Collapse>

      {/* stages 4-5: the prompt being planned */}
      <Collapse show={stage === S.PLAN || stage === S.APPROVAL}>
        <div className="ls-chrome-block">
          <div className="ls-prompt">
            <span className="ls-prompt-quote">&ldquo;</span>
            {prompt}
            <span className="ls-prompt-quote">&rdquo;</span>
          </div>
        </div>
      </Collapse>

      {/* stage 4 beat: scripted matcher "thinking" */}
      <Collapse show={stage === S.PLAN && planPhase === 1}>
        <div className="ls-chrome-block">
          <div className="ls-plan-thinking">matching keywords…</div>
        </div>
      </Collapse>

      {/* stage 5: approval summary. The gate sentence fades out (visibility
          only — same string) once approval is given, so it never sits above
          green executed checks contradicting them. */}
      <Collapse show={stage === S.APPROVAL}>
        <div className="ls-chrome-block">
          <p className="ls-approval-summary">
            The plan: {plan.length} tool calls.{' '}
            <span
              className="ls-approval-gate"
              data-faded={status === 'running' || status === 'done' || undefined}
            >
              Nothing runs until you approve.
            </span>
          </p>
        </div>
      </Collapse>

      {/* ── the three persistent rows ── */}
      <div className="ls-rail-rows">
        {ordered.map((tool, i) => {
          const planIdx = planRank.get(tool.name) ?? i
          // 'queued' (dimmed) exists ONLY during the approval run — dimming
          // means exactly one thing on this stage: not-yet-executed.
          const rowStatus: 'none' | 'idx' | 'queued' | 'running' | 'done' = !showCallParams
            ? 'none'
            : stage === S.APPROVAL && planIdx < doneCount
              ? 'done'
              : stage === S.APPROVAL && status === 'running' && planIdx === doneCount
                ? 'running'
                : stage === S.APPROVAL && status === 'running'
                  ? 'queued'
                  : 'idx'
          return (
            <RailRow
              key={tool.name}
              tool={tool}
              order={i}
              stage={stage}
              railActive={railActive}
              filtered={isPalette && !matches(tool)}
              expanded={isPalette && expanded === tool.name}
              onToggle={() => setExpanded((cur) => (cur === tool.name ? null : tool.name))}
              planCall={planByName.get(tool.name)}
              planIdx={planIdx}
              rowStatus={rowStatus}
              showCallParams={showCallParams}
              executeTool={executeTool}
              T={T}
              tune={tune}
            />
          )
        })}
      </div>

      <Collapse show={isPalette && !anyMatch}>
        <p className="ls-rail-empty">No matching tools.</p>
      </Collapse>

      {/* ── chrome below the rows ── */}

      <Collapse show={isPalette}>
        <div className="ls-chrome-block ls-chrome-block--below">
          <p className="ls-card-note">
            This palette is live — run a tool and the devices above change.
            The form is generated from the schema: enum → dropdown, bounded number → slider.
          </p>
        </div>
      </Collapse>

      <Collapse show={stage === S.AGENT}>
        <div className="ls-chrome-block ls-chrome-block--below">
          <p className="ls-card-note">{copy.note}</p>
        </div>
      </Collapse>

      <Collapse show={stage === S.PLAN}>
        <div className="ls-chrome-block ls-chrome-block--below">
          <p className="ls-card-note">
            Planner scripted for this walkthrough — keyword matching, not a live LLM.
            In your app you plug in Anthropic, OpenAI, Gemini, or your own provider.
          </p>
        </div>
      </Collapse>

      <Collapse show={stage === S.APPROVAL}>
        <div className="ls-chrome-block ls-chrome-block--below">
          <Collapse show={status === 'pending' || status === 'running'}>
            <div className="ls-approve-dock">
              <button type="button" data-agentk-approval-reject="" onClick={onReject} disabled={status === 'running'}>
                Reject
              </button>
              <button
                type="button"
                data-agentk-approval-approve=""
                data-running={status === 'running' || undefined}
                onClick={onApprove}
                disabled={status === 'running'}
              >
                {status === 'running' ? 'Running…' : 'Approve & run'}
              </button>
            </div>
          </Collapse>
          {/* Live region scoped to the status line only — buttons stay outside */}
          <div aria-live="polite">
            {status === 'running' && (
              <p className="ls-approval-status">Running the plan against the devices above…</p>
            )}
            {status === 'done' && (
              <p className="ls-approval-status"><span className="ls-call-done">✓</span> Plan executed — {summarizePlanRun(plan)}.</p>
            )}
            {status === 'rejected' && (
              <p className="ls-approval-status">Plan discarded. Nothing ran — that&rsquo;s the point.</p>
            )}
          </div>
          <Collapse show={status === 'done' || status === 'rejected'}>
            <div className="ls-approval-reset">
              <button type="button" className="ls-ghost-btn" onClick={onResetApproval}>
                {status === 'done' ? 'Reset and show the plan again' : 'Show the plan again'}
              </button>
            </div>
          </Collapse>
          {/* Suppressed while the run executes so only "Running the plan…"
              narrates; restored once the run settles. */}
          <Collapse show={status !== 'running'}>
            <p className="ls-card-note">
              requireApproval gated this run — remove it, and this same plan executes the moment the agent produces it.
            </p>
          </Collapse>
        </div>
      </Collapse>
    </div>
  )
}

// ─── One rail row: a tool, morphing skin per stage ───

function RailRow({
  tool,
  order,
  stage,
  railActive,
  filtered,
  expanded,
  onToggle,
  planCall,
  planIdx,
  rowStatus,
  showCallParams,
  executeTool,
  T,
  tune,
}: {
  tool: ToolDef
  order: number
  stage: number
  railActive: boolean
  filtered: boolean
  expanded: boolean
  onToggle: () => void
  planCall: PlanCall | undefined
  planIdx: number
  rowStatus: 'none' | 'idx' | 'queued' | 'running' | 'done'
  showCallParams: boolean
  executeTool: ExecuteTool
  T: MotionSet
  tune: Tune
}) {
  const accent = TOOL_ACCENTS[tool.name]
  const params = summarizeSchema(tool.inputSchema)
  const isPalette = stage === S.PALETTE
  const showPrefix = stage === S.AGENT
  const showStatus = rowStatus !== 'none'
  // The ONLY dimmed row state: queued behind the approval run. Plan-call
  // arrival (stage 4) enters at near-full opacity so the two never read
  // the same.
  const queued = rowStatus === 'queued'
  // Stagger only when the rail first lands (stage 1) — later skin morphs
  // move all rows together. The delay is scoped per-value so framer's
  // layout spring is never postponed by it.
  const stagger = railActive && stage === S.TOOLS ? order * tune.rowStaggerS : 0

  return (
    <div className="ls-row-clip" data-hide={filtered || undefined} inert={filtered ? true : undefined}>
      <div className="ls-row-clip-inner">
        <motion.div
          layout={railActive}
          className="ls-row"
          style={{ '--tool-accent': accent } as CSSProperties}
          data-expanded={expanded || undefined}
          initial={false}
          animate={{ opacity: !railActive ? 0 : queued ? 0.55 : 1, y: railActive ? 0 : -6 }}
          transition={
            {
              ...T.row,
              opacity: { ...T.row, delay: stagger },
              y: { ...T.row, delay: stagger },
            } as Transition
          }
        >
          {/* A div that becomes a button only at the palette stage: outside
              it, screen readers see plain text — no no-op buttons in the
              tree. Deliberately not a <button>: swapping the element type
              per stage would remount the name (and its animated prefix). */}
          <div
            className="ls-row-head"
            role={isPalette ? 'button' : undefined}
            tabIndex={isPalette ? 0 : undefined}
            aria-expanded={isPalette ? expanded : undefined}
            onClick={() => {
              if (isPalette) onToggle()
            }}
            onKeyDown={(e) => {
              if (isPalette && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault()
                onToggle()
              }
            }}
          >
            {/* plan/approval status slot (index → spinner → ✓). The spinner
                is decorative — the adjacent aria-live status line ("Running
                the plan…") announces the running state. */}
            <span className="ls-row-status" data-show={showStatus || undefined} aria-hidden={showStatus ? undefined : true}>
              {rowStatus === 'done' ? (
                <span className="ls-call-done">✓</span>
              ) : rowStatus === 'running' ? (
                <span className="ls-call-spinner" aria-hidden="true" />
              ) : (
                <span className="ls-plan-index">{planIdx + 1}</span>
              )}
            </span>
            <span className="ls-chip-dot" style={{ background: accent }} aria-hidden="true" />
            <code className="ls-row-name" style={{ color: accent }}>
              {/* the learn_ prefix animates width/opacity around the SAME
                  text node — the name never remounts. It settles at 0.55
                  opacity (dimmed namespace before the full-strength name). */}
              <motion.span
                className="ls-row-prefix"
                initial={false}
                animate={{ width: showPrefix ? 'auto' : 0, opacity: showPrefix ? 0.55 : 0 }}
                transition={T.prefix}
                aria-hidden={showPrefix ? undefined : true}
              >
                {WEBMCP_PREFIX}
              </motion.span>
              {tool.name}
            </code>
            <span
              className="ls-row-chevron"
              data-show={isPalette || undefined}
              data-open={expanded || undefined}
              aria-hidden="true"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 3l5 5-5 5" />
              </svg>
            </span>
          </div>

          {/* description — schema-card + palette + agent skins */}
          <Collapse show={stage <= S.AGENT}>
            <p className="ls-row-desc">{tool.description}</p>
          </Collapse>

          {/* schema chips — schema-card + agent skins */}
          <Collapse show={stage === S.TOOLS || stage === S.AGENT}>
            <div className="ls-row-schema">
              {params.map((p) => (
                <code key={p.key} className="ls-param">
                  <span className="ls-param-key">{p.key}</span>
                  <span className="ls-param-type">{p.type}</span>
                  {p.detail && <span className="ls-param-detail">{p.detail}</span>}
                </code>
              ))}
            </div>
          </Collapse>

          {/* planned call params slide into the row — plan + approval skins */}
          {planCall && (
            <Collapse show={showCallParams}>
              <div className="ls-row-call">
                {/* Arrival is a y-translate at near-full opacity: low-opacity
                    entries would read like the approval run's queued dimming,
                    and opacity may only mean "queued" on this stage. */}
                {Object.entries(planCall.parameters).map(([k, v]) => (
                  <motion.code
                    key={k}
                    className="ls-param ls-param--call"
                    initial={false}
                    animate={{ opacity: showCallParams ? 1 : 0.92, y: showCallParams ? 0 : 8 }}
                    transition={
                      {
                        ...T.row,
                        delay: showCallParams && stage === S.PLAN ? planIdx * tune.planCallStaggerS : 0,
                      } as Transition
                    }
                  >
                    <span className="ls-param-key">{k}:</span>
                    <span className="ls-call-value">{String(v)}</span>
                  </motion.code>
                ))}
                <span className="ls-row-note">{planCall.note}</span>
              </div>
            </Collapse>
          )}

          {/* inline schema-generated form — palette skin only */}
          <Collapse show={isPalette && expanded}>
            <RailForm tool={tool} executeTool={executeTool} />
          </Collapse>
        </motion.div>
      </div>
    </div>
  )
}

// ─── Inline schema-generated form (stage 2) ───
// enum → styled select, bounded number → range slider — the
// same mapping the palette's ToolForm documents, generated
// here from the tool's inputSchema. Run calls the real
// executor, so the devices above respond.

const RUN_FLASH_MS = 1600 // "✓ Ran" confirmation on the Run button

function RailForm({ tool, executeTool }: { tool: ToolDef; executeTool: ExecuteTool }) {
  const schemaProps: Record<string, any> = (tool.inputSchema as any)?.properties ?? {}
  const [values, setValues] = useState<Record<string, any>>(() => {
    const v: Record<string, any> = {}
    for (const [key, def] of Object.entries<any>(schemaProps)) {
      if (def.enum) v[key] = def.default ?? def.enum[0]
      else if (def.type === 'number') v[key] = def.default ?? def.minimum ?? 0
      else v[key] = def.default ?? ''
    }
    return v
  })
  const [ran, setRan] = useState(false)
  const ranTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => {
    if (ranTimer.current) clearTimeout(ranTimer.current)
  }, [])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    await executeTool(tool.name, values)
    setRan(true)
    if (ranTimer.current) clearTimeout(ranTimer.current)
    ranTimer.current = setTimeout(() => setRan(false), RUN_FLASH_MS)
  }

  return (
    <form className="ls-row-form" onSubmit={submit}>
      {Object.entries<any>(schemaProps).map(([key, def]) =>
        def.enum ? (
          <label className="ls-form-field" key={key}>
            <span className="ls-form-label">{key}</span>
            <select
              className="ls-form-select"
              value={values[key]}
              onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
            >
              {def.enum.map((opt: string) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </label>
        ) : def.type === 'number' && def.minimum !== undefined && def.maximum !== undefined ? (
          <label className="ls-form-field" key={key}>
            <span className="ls-form-label">
              {key}
              <code className="ls-form-value">{values[key]}</code>
            </span>
            <input
              className="ls-form-range"
              type="range"
              min={def.minimum}
              max={def.maximum}
              step={1}
              value={values[key]}
              onChange={(e) => setValues((v) => ({ ...v, [key]: Number(e.target.value) }))}
            />
          </label>
        ) : (
          <label className="ls-form-field" key={key}>
            <span className="ls-form-label">{key}</span>
            <input
              className="ls-form-text"
              type="text"
              value={values[key]}
              onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
            />
          </label>
        ),
      )}
      {/* Neutral high-contrast Run (no tool-identity blue); the confirmation
          is a green check in a neutral pill — the same success grammar as
          the approval flow's executed checks. */}
      <button type="submit" className="ls-run-btn" data-ran={ran || undefined}>
        {ran ? (
          <>
            <span className="ls-run-check">✓</span> Ran — check the devices
          </>
        ) : (
          'Run'
        )}
      </button>
    </form>
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
  reducedMotion,
  T,
  tune,
}: LearnStageProps & { T: MotionSet; tune: Tune }) {
  const showChips = stage >= S.TOOLS

  return (
    <div className="ls-devices">
      {/* Light */}
      <div
        className={`ls-device ${flash.has('light') ? 'ls-device--flash' : ''}`}
        style={{ '--device-accent': TOOL_ACCENTS.set_lights } as React.CSSProperties}
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
        <div className="ls-bar">
          <motion.div
            className="ls-bar-fill"
            style={{ background: TOOL_ACCENTS.set_lights }}
            initial={false}
            animate={{ width: `${home.light.on ? home.light.level : 0}%` }}
            transition={T.bar}
          />
        </div>
        <DeviceChip show={showChips} name="set_lights" T={T} />
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
        <div className="ls-device-reading">
          {/* the springing digits are decorative; the ls-sr twin announces */}
          <span aria-hidden="true">
            {reducedMotion ? (
              home.thermostat.temp
            ) : (
              <SpringNumber
                value={home.thermostat.temp}
                visualDuration={tune.deviceVisualDuration}
                bounce={tune.deviceBounce}
              />
            )}
            °F
          </span>
          <span className="ls-sr" aria-live="polite">{home.thermostat.temp}°F</span>
        </div>
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
        <DeviceChip show={showChips} name="set_thermostat" T={T} />
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
        <DeviceChip show={showChips} name="play_music" T={T} />
      </div>
    </div>
  )
}

/** Spring-animated integer readout (thermostat digits). */
function SpringNumber({ value, visualDuration, bounce }: { value: number; visualDuration: number; bounce: number }) {
  const spring = useSpring(value, { visualDuration, bounce })
  const display = useTransform(spring, (v: number) => Math.round(v))
  useEffect(() => {
    spring.set(value)
  }, [spring, value])
  return <motion.span>{display}</motion.span>
}

function DeviceChip({ show, name, T }: { show: boolean; name: string; T: MotionSet }) {
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.code
          className="ls-device-chip"
          style={{ color: TOOL_ACCENTS[name] }}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={T.row}
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
// Agent's-eye copy (stage 3) — real or simulated, labeled
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

// ─────────────────────────────────────────────────────────
// Stage 5 helper — past-tense summary of what the plan ran
// ─────────────────────────────────────────────────────────

/** Derived from the plan itself so it can never contradict later device
 *  changes or drift from the plan data in tools.tsx. */
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
    // No outer bordered panel: floating chrome, same as every other stage.
    <div className="ls-ship">
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
      {/* The button's visual text swap isn't reliably announced — this
          visually-hidden status region confirms the copy for screen readers. */}
      <span className="ls-sr" role="status">
        {copied ? 'npm install command copied to clipboard' : ''}
      </span>
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

