'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { useWebMCPRegistration, useWebMCPTools } from 'agentk'
import { LearnStage, TUNE, type ApprovalState, type WebMCPPanel } from '../../components/learn/stage'
import {
  LEARN_TOOLS,
  INITIAL_HOME,
  WALKTHROUGH_PROMPT,
  WEBMCP_PREFIX,
  matchPlan,
  summarizeSchema,
  type HomeState,
} from '../../components/learn/tools'

/* ─────────────────────────────────────────────────────────
 * WALKTHROUGH STORYBOARD — What is WebMCP?
 *
 * Scrollytelling: prose steps in a left column, ONE sticky
 * live stage on the right that morphs in place. A single
 * integer `stage` drives everything; a rAF-throttled scroll
 * handler picks the step section owning the viewport midpoint
 * (remount-immune — an IntersectionObserver here went stale).
 *
 * The stage's centerpiece is ONE persistent tool rail (the
 * three tool rows) that morphs its skin from stage 1 through
 * stage 5 — see components/learn/stage.tsx for the full
 * storyboard. Only stages 0 and 6 are crossfade zones.
 *
 * stage 0  A tiny smart-home mini-app (light, thermostat,
 *          music). Interactive toggles that work. Copy:
 *          agents today browse like humans — scraping DOM
 *          and clicking. This page looks like pixels to them.
 * stage 1  The page declares its capabilities: the rail rows
 *          land as JSON Schema tool cards, connected visually
 *          to the devices they control.
 * stage 2  Humans get a palette: palette chrome around the
 *          same rows; expanding a row shows the auto-generated
 *          form (enum → dropdown, bounded number → slider).
 * stage 3  Agents see the same page differently: agent chrome
 *          around the same rows, names gain the learn_ prefix
 *          — real registration when the API exists, honestly-
 *          labeled simulation when not.
 * stage 4  One sentence, planned across tools: a fixed prompt
 *          resolves into call params inside the rows. Planner
 *          is scripted keyword matching — disclosed in the UI.
 * stage 5  Human in the loop: an approval dock under the rows;
 *          Approve makes the stage devices actually change.
 *          requireApproval is opt-in.
 * stage 6  Ship it: honest status (Chrome origin trial, W3C
 *          WebML CG, not Firefox/Safari; agentk degrades to a
 *          plain palette) + npm install + links.
 * ───────────────────────────────────────────────────────── */

// ─── Stage + timing constants (no magic numbers in JSX) ───

const STAGE = {
  PIXELS: 0,
  TOOLS: 1,
  PALETTE: 2,
  AGENT: 3,
  PLAN: 4,
  APPROVAL: 5,
  SHIP: 6,
} as const

// All stage timings/springs live in the TUNE block at the top of
// components/learn/stage.tsx. The two
// values used here are read once at module load.
const TIMING = {
  approvalStepMs: TUNE.approvalStepMs, // gap between executed plan steps after Approve
  deviceFlashMs: TUNE.deviceFlashMs, // device card highlight after a tool runs
}

// A step activates when it crosses the middle band of the viewport.
const STEP_ACTIVATION_MIDPOINT = 0.5 // viewport fraction that owns the active step

const PLAN = matchPlan(WALKTHROUGH_PROMPT) // scripted keyword matching, disclosed on the stage

// ─── Step copy (data-driven — one array, mapped to sections) ───

type Step = { id: string; title: string; body: string[] }

const STEPS: Step[] = [
  {
    id: 'pixels',
    title: 'Agents browse like humans. Badly.',
    body: [
      'Here’s a tiny smart home. Three devices. They work — toggle the light, nudge the thermostat, play some music.',
      'Now picture an AI agent trying to do the same. Today it renders the page, scrapes the DOM, and guesses which pixel is a button. To an agent, this page is pixels.',
    ],
  },
  {
    id: 'tools',
    title: 'Declare what the page can do.',
    body: [
      'WebMCP flips the approach. Instead of making agents guess, the page declares its capabilities as tools: a name, a description, and a JSON Schema for the inputs. That’s the whole contract.',
      'I defined these once. Three devices became three typed, callable functions — each card on the stage is matched to the device it controls.',
    ],
  },
  {
    id: 'palette',
    title: 'Humans get a palette. Free.',
    body: [
      'The same definitions render a command palette for people. Pick a tool and the parameter form is generated straight from its schema — an enum becomes a dropdown, a bounded number becomes a slider.',
      'Try it. The palette on the stage is live, and it drives the devices above it.',
    ],
  },
  // ORIGIN-TRIAL RENEWAL CHECKLIST (token expires 2026-11-17 — see
  // app/layout.tsx + next.config.mjs): this step's copy says the site
  // serves Chrome's WebMCP origin-trial token. If the token lapses, the
  // live/simulated badge self-corrects, but the "registered its three
  // tools for real" path silently disappears for ordinary Chrome —
  // re-verify this copy whenever the token is renewed or allowed to expire.
  {
    id: 'agent',
    title: 'Agents see the same page differently.',
    body: [
      'This is the agent’s-eye view: the tools registered on document.modelContext right now. No scraping, no guessing — a typed catalog.',
      'This site serves Chrome’s WebMCP origin-trial token. If your browser has the API, this page registered its three tools for real and the panel says live. If not, the panel shows the same content, labeled simulated. Both states are the truth.',
    ],
  },
  {
    id: 'plan',
    title: 'One sentence, planned across tools.',
    body: [
      'Because the tools are typed, natural language can compile into a plan: one sentence in, three tool calls with real parameters out.',
      'Full disclosure: the planner here is scripted keyword matching, so this walkthrough works without an API key. In your app you plug in Anthropic, OpenAI, Gemini, or your own provider.',
    ],
  },
  {
    id: 'approval',
    title: 'You stay in the loop.',
    body: [
      'A plan is not an action. With requireApproval turned on, agentk shows the plan and waits for a human.',
      'Approval is opt-in — execution is instant by default, and you gate what warrants a human. Click Approve and watch the devices actually change.',
    ],
  },
  {
    id: 'ship',
    title: 'Ship it — with honest expectations.',
    body: [
      'WebMCP is early. It’s a Chrome origin trial, not a shipped standard, and agentk degrades to a plain command palette without it. That’s the deal today, stated plainly.',
      'If the trade sounds right, everything you just used is one npm install away.',
    ],
  },
]

// ─────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────

export default function LearnPage() {
  const [stage, setStage] = useState<number>(STAGE.PIXELS)
  const [home, setHome] = useState<HomeState>(INITIAL_HOME)
  const [flash, setFlash] = useState<Set<string>>(new Set())
  const [approval, setApproval] = useState<ApprovalState>({ status: 'pending', doneCount: 0 })
  const approvalRunRef = useRef(0)
  const reducedMotion = !!useReducedMotion()

  // ─── Device state + tool executor (single source of truth) ───

  const flashDevice = useCallback((id: string) => {
    setFlash((s) => new Set(s).add(id))
    setTimeout(() => {
      setFlash((s) => {
        const next = new Set(s)
        next.delete(id)
        return next
      })
    }, TIMING.deviceFlashMs)
  }, [])

  const executeTool = useCallback(
    async (name: string, params: Record<string, any>) => {
      switch (name) {
        case 'set_lights': {
          const level = Math.max(0, Math.min(100, Number(params.level ?? 0)))
          setHome((h) => ({ ...h, light: { on: level > 0, level } }))
          flashDevice('light')
          return { success: true, level }
        }
        case 'set_thermostat': {
          const temp = Math.max(60, Math.min(85, Number(params.temp ?? 72)))
          setHome((h) => ({ ...h, thermostat: { temp } }))
          flashDevice('thermostat')
          return { success: true, temp }
        }
        case 'play_music': {
          const genre = String(params.genre ?? 'ambient')
          const playing = genre !== 'off'
          setHome((h) => ({ ...h, music: { playing, genre: playing ? genre : '' } }))
          flashDevice('music')
          return { success: true, playing, genre }
        }
        default:
          throw new Error(`Unknown tool: ${name}`)
      }
    },
    [flashDevice],
  )

  // ─── Real WebMCP registration + readback (stage 3) ───
  // Registers on document.modelContext when the API exists (this site
  // serves the origin-trial token); silently a no-op everywhere else.

  const registration = useWebMCPRegistration(LEARN_TOOLS, executeTool, { prefix: WEBMCP_PREFIX })
  const { tools: discovered, refresh } = useWebMCPTools()

  useEffect(() => {
    // Re-scan when registration lands (it can arrive late in the
    // origin-trial era) and whenever the agent's-eye stage is shown.
    if (registration.active || stage === STAGE.AGENT) refresh()
  }, [registration.active, stage, refresh])

  // Which surface actually matched: agentk prefers document.modelContext
  // (Chrome 150+) and falls back to navigator.modelContext (earlier
  // origin-trial builds). Detected in an effect (browser-only) so the
  // stage-3 badge and panel title name the real surface, not a guess.
  const [surface, setSurface] = useState<WebMCPPanel['surface']>('document.modelContext')
  useEffect(() => {
    if ('modelContext' in document) setSurface('document.modelContext')
    else if ('modelContext' in navigator) setSurface('navigator.modelContext')
  }, [registration.active, stage])

  // The stage-3 rail always renders the LOCAL catalog — its rows persist
  // across stages and never remount (see stage.tsx). The readback is used
  // as verification only: 'live-read' claims the displayed list is what the
  // browser's WebMCP surface reports right now, so that mode is reported
  // only when the readback provably matches the catalog — the same
  // learn_-prefixed name set, plus matching description/params wherever the
  // surface returns them. Any divergence (partial registration, an extra
  // learn_ registrant, description/schema drift) demotes the badge to
  // live-registered/simulated rather than overclaiming readback provenance.
  // Origin-trial surfaces vary; everything read back is untrusted shape-wise.
  const readbackMatchesCatalog = (() => {
    try {
      const discoveredLearn = discovered.filter(
        (t) => typeof t?.name === 'string' && t.name.startsWith(WEBMCP_PREFIX),
      )
      if (discoveredLearn.length !== LEARN_TOOLS.length) return false
      return LEARN_TOOLS.every((tool) => {
        const read = discoveredLearn.find((t) => t.name === WEBMCP_PREFIX + tool.name)
        if (!read) return false
        if (typeof read.description === 'string' && read.description !== tool.description) return false
        if (
          read.inputSchema &&
          JSON.stringify(summarizeSchema(read.inputSchema)) !==
            JSON.stringify(summarizeSchema(tool.inputSchema))
        ) {
          return false
        }
        return true
      })
    } catch {
      return false
    }
  })()
  const webmcp: WebMCPPanel = {
    mode: readbackMatchesCatalog ? 'live-read' : registration.active ? 'live-registered' : 'simulated',
    surface,
  }

  // ─── Approval flow (stage 5) ───

  const approvePlan = useCallback(async () => {
    const runId = ++approvalRunRef.current
    setApproval({ status: 'running', doneCount: 0 })
    for (let i = 0; i < PLAN.length; i++) {
      if (!reducedMotion) await new Promise((r) => setTimeout(r, TIMING.approvalStepMs))
      if (approvalRunRef.current !== runId) return
      await executeTool(PLAN[i].toolName, PLAN[i].parameters)
      setApproval({ status: 'running', doneCount: i + 1 })
    }
    if (approvalRunRef.current === runId) setApproval({ status: 'done', doneCount: PLAN.length })
  }, [executeTool, reducedMotion])

  const rejectPlan = useCallback(() => {
    approvalRunRef.current++
    setApproval({ status: 'rejected', doneCount: 0 })
  }, [])

  const resetApproval = useCallback(() => {
    approvalRunRef.current++
    setApproval({ status: 'pending', doneCount: 0 })
  }, [])

  // ─── Scroll → stage (rAF-throttled scroll handler on step sections) ───

  useEffect(() => {
    // rAF-throttled scroll handler instead of an IntersectionObserver: it
    // re-queries the live DOM on every pick, so it cannot end up watching
    // detached nodes, and it resolves the correct stage on initial load at
    // any scroll position (including reload mid-page).
    let raf = 0
    const pick = () => {
      raf = 0
      const mid = window.innerHeight * STEP_ACTIVATION_MIDPOINT
      let best = -1
      const sections = document.querySelectorAll<HTMLElement>('[data-step-index]')
      sections.forEach((el) => {
        const r = el.getBoundingClientRect()
        if (r.top <= mid && r.bottom >= mid) best = Number(el.dataset.stepIndex)
      })
      // Above the first section (intro in view): clamp to the first stage so
      // scrolling back to the top never strands the stage on a later zone.
      if (best === -1 && sections[0] && sections[0].getBoundingClientRect().top > mid) {
        best = 0
      }
      if (best >= 0 && !Number.isNaN(best)) setStage(best)
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(pick)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    pick()
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <div className="learn-page">
      {/* Editorial serif for the h1 + step titles, scoped to /learn via the
          CSS below (same Google Fonts mechanism as Caveat in app/layout.tsx).
          React hoists+dedupes these into <head>; the preconnects shave the
          connection setup off both the CSS and the woff2 fetch, and the
          metric-tuned 'Newsreader Fallback' face in the CSS below keeps the
          display=swap landing from shifting the headings. */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        rel="stylesheet"
        precedence="default"
        href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,500..600&display=swap"
      />
      <header className="learn-header">
        <a href="/" className="learn-logo">agentk</a>
        <span className="learn-header-sep">/</span>
        <span className="learn-header-title">What is WebMCP?</span>
      </header>

      <div className="learn-layout">
        {/* Sticky stage — DOM-first so it stays on top on mobile (the intro
            is lifted above it there via flex order; see the 900px query) */}
        <div className="learn-stage-wrap">
          <LearnStage
            stage={stage}
            home={home}
            flash={flash}
            executeTool={executeTool}
            webmcp={webmcp}
            prompt={WALKTHROUGH_PROMPT}
            plan={PLAN}
            approval={approval}
            onApprove={approvePlan}
            onReject={rejectPlan}
            onResetApproval={resetApproval}
            reducedMotion={reducedMotion}
          />
        </div>

        {/* Prose steps */}
        <div className="learn-steps">
          <div className="learn-intro">
            <h1>What is WebMCP?</h1>
            <p>
              A two-minute walkthrough. I built a tiny smart home into this page &mdash;
              scroll, and watch the stage change.
            </p>
          </div>

          {STEPS.map((step, i) => (
            <section
              key={step.id}
              data-step-index={i}
              className="learn-step"
            >
              <div className="learn-step-card" data-active={stage === i || undefined}>
                <span className="learn-step-num">{i + 1} / {STEPS.length}</span>
                <h2>{step.title}</h2>
                {step.body.map((p) => (
                  <p key={p.slice(0, 24)}>{p}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      <style>{learnStyles}</style>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Styles — uses the site's global palette variables; the
// inline palette + approval visuals come from globals.css
// (cmdk-* / data-agentk-* selectors).
// ─────────────────────────────────────────────────────────

const learnStyles = `
  /* Metric-tuned local fallback for Newsreader: Georgia size-adjusted with
     capsize metrics (Newsreader@600 vs Georgia regular — the same dataset
     next/font uses) so pre-swap headings occupy nearly the same lines and
     the display=swap landing barely shifts layout. The 500-600 weight
     descriptor covers exactly the range this page requests, and declaring
     it also stops the browser from synthesizing bold (whose widths the
     metrics can't predict). */
  @font-face {
    font-family: 'Newsreader Fallback';
    src: local('Georgia');
    font-weight: 500 600;
    size-adjust: 100.94%;
    ascent-override: 72.81%;
    descent-override: 26.25%;
    line-gap-override: 0%;
  }

  .learn-page {
    min-height: 100dvh;
    background: var(--bg);
    /* clip, not hidden: hidden would make this the scroll container
       and break the sticky stage */
    overflow-x: clip;
    /* Lighten the global --text-3 (#666666) for this page: the
       walkthrough's small notes (.ls-card-note, .ls-plan-note,
       .ls-param-detail, .learn-step-num, …) sit on --bg-card and need
       WCAG AA 4.5:1 at these sizes. #8f8f8f is ~5.7:1 on #141414. */
    --text-3: #8f8f8f;
    /* Editorial serif for the h1 + step titles only — loaded on this page,
       not applied anywhere else on the site. 'Newsreader Fallback' is the
       metric-tuned Georgia face declared above. */
    --serif: 'Newsreader', 'Newsreader Fallback', Georgia, 'Times New Roman', serif;
    /* Shared easing for the rail's CSS-driven chrome collapses. --chrome-ms
       is set inline on .ls-panel from the TUNE block (0ms under reduced
       motion). */
    --ease-soft: cubic-bezier(0.32, 0, 0.24, 1);
  }

  .learn-page :focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
    border-radius: 4px;
  }

  /* ─── Header ─── */

  .learn-header {
    display: flex;
    align-items: center;
    height: 52px;
    padding: 0 24px;
    border-bottom: 1px solid var(--border);
  }

  .learn-logo {
    font-size: 15px;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--text);
    text-decoration: none;
  }
  .learn-logo:hover { color: var(--accent); }

  .learn-header-sep { margin: 0 10px; color: var(--border-focus); font-weight: 300; font-size: 18px; }
  .learn-header-title { font-size: 14px; color: var(--text-2); }

  /* ─── Layout: steps left, sticky stage right ─── */

  .learn-layout {
    display: grid;
    grid-template-columns: minmax(0, 5fr) minmax(0, 6fr);
    gap: 56px;
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 24px 120px;
    align-items: start;
  }

  /* Tail room keeps the sticky stage pinned while the last step is centered —
     without it the grid ends and the stage gets pushed up, breaking the
     constant device-row anchor at stage 6. */
  .learn-steps { grid-column: 1; grid-row: 1; padding-bottom: 18vh; }
  .learn-stage-wrap {
    grid-column: 2;
    grid-row: 1;
    position: sticky;
    top: 24px;
    height: calc(100dvh - 48px);
    display: flex;
    /* TOP-ANCHORED, not centered: stage content grows downward from a
       fixed origin, so the device row's top edge never moves between
       stages (centering made it drift as content height changed). The
       offset is constant for a given viewport and optically matches the
       old stage-1 resting position. */
    align-items: flex-start;
    padding-top: clamp(48px, 16vh, 190px);
  }

  /* ─── Intro + step cards ─── */

  .learn-intro { padding: 64px 0 8px; max-width: 460px; }
  .learn-intro h1 {
    font-family: var(--serif);
    font-optical-sizing: auto;
    font-size: 44px;
    font-weight: 600;
    letter-spacing: -0.015em;
    line-height: 1.08;
    text-wrap: balance;
    color: var(--text);
    margin-bottom: 14px;
  }
  .learn-intro p { font-size: 15px; line-height: 1.6; color: var(--text-2); }

  .learn-step {
    min-height: 82vh;
    display: flex;
    align-items: center;
  }

  .learn-step-card {
    max-width: 460px;
    padding: 22px 24px;
    border: 1px solid transparent;
    border-radius: var(--radius);
    /* 0.55, not lower: inactive steps stay legible while still receding */
    opacity: 0.55;
    /* matches TUNE.zoneFadeMs so rail and stage land together */
    transition: opacity 380ms cubic-bezier(0.32, 0, 0.24, 1), border-color 380ms cubic-bezier(0.32, 0, 0.24, 1), background 380ms cubic-bezier(0.32, 0, 0.24, 1);
  }

  .learn-step-card[data-active] {
    opacity: 1;
    background: var(--bg-card);
    border-color: var(--border);
  }

  .learn-step-num {
    display: block;
    font-family: var(--mono);
    font-size: 10.5px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--text-3);
    font-variant-numeric: tabular-nums;
    margin-bottom: 10px;
  }

  .learn-step-card h2 {
    font-family: var(--serif);
    font-optical-sizing: auto;
    font-size: 26px;
    font-weight: 580;
    letter-spacing: -0.008em;
    line-height: 1.22;
    text-wrap: balance;
    color: var(--text);
    margin-bottom: 12px;
  }

  .learn-step-card p {
    font-size: 14px;
    line-height: 1.65;
    color: var(--text-2);
  }
  .learn-step-card p + p { margin-top: 10px; }

  /* ─── Stage panel ─── */

  .ls-panel {
    width: 100%;
    max-height: 100%;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .ls-zone {
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    position: relative; /* anchor for inactive (absolute) zones */
    scrollbar-width: thin;
    scrollbar-color: var(--border) transparent;
  }
  .ls-zone::-webkit-scrollbar { width: 6px; }
  .ls-zone::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
  .ls-zone-inner { width: 100%; }

  /* ─── Devices ─── */

  /* Devices persist through EVERY stage (stage 6 condenses them via
     data-condensed instead of unmounting — the walkthrough never abandons
     its object). Equal padding and negative margins cancel at rest, giving
     the flash glow (18px) and hover lift room INSIDE the clip; flex-shrink
     0 keeps short viewports squeezing the scrollable .ls-zone, not this. */
  .ls-devices-wrap {
    overflow: hidden;
    flex-shrink: 0;
    box-sizing: border-box;
    padding: 20px;
    margin: -20px;
  }

  /* Stage 6 condensed skin: the earned final state stays visible (readings,
     light bar, eq, tool chips) while the interactive controls retire. */
  .ls-devices-wrap[data-condensed] .ls-device { padding: 8px 10px; gap: 5px; }
  .ls-devices-wrap[data-condensed] .ls-device-reading { font-size: 13px; }
  .ls-devices-wrap[data-condensed] .ls-device-toggle,
  .ls-devices-wrap[data-condensed] .ls-thermo-buttons,
  .ls-devices-wrap[data-condensed] .ls-play-btn { display: none; }

  .ls-devices {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
  }

  .ls-device {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    /* hover lift is quicker (150ms) than the flash glow (300ms); padding
       eases for the stage-6 condensed skin */
    transition: border-color 150ms ease, transform 150ms ease, box-shadow 300ms ease,
                padding var(--skin-ms, 420ms) var(--ease-soft);
  }

  .ls-device:hover {
    transform: translateY(-1px);
    border-color: var(--border-focus);
  }

  .ls-device--flash,
  .ls-device--flash:hover {
    border-color: var(--device-accent, var(--accent));
    box-shadow: 0 0 18px rgba(59, 130, 246, 0.15);
  }

  .ls-device-head { display: flex; align-items: center; gap: 6px; }

  .ls-device-icon {
    display: flex;
    color: var(--text-3);
    transition: color 300ms ease, filter 300ms ease;
  }
  .ls-device-icon[data-lit] {
    color: var(--device-accent, var(--accent));
    filter: drop-shadow(0 0 6px var(--device-accent, transparent));
  }

  .ls-device-name { font-size: 12px; font-weight: 600; color: var(--text); flex: 1; }

  .ls-device-reading {
    font-size: 18px;
    font-weight: 700;
    color: var(--text);
    font-variant-numeric: tabular-nums;
    text-transform: capitalize;
    line-height: 1.1;
  }

  .ls-bar { height: 5px; background: rgba(255,255,255,0.06); border-radius: 3px; overflow: hidden; }
  /* width is spring-animated by framer-motion (TUNE.deviceVisualDuration) — no CSS transition */
  .ls-bar-fill { height: 100%; border-radius: 3px; }

  /* Visually-hidden twin for screen readers (springing digits are decorative) */
  .ls-sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  /* Toggle switch */
  .ls-device-toggle {
    width: 30px;
    height: 18px;
    border-radius: 9px;
    border: 1px solid var(--border);
    background: rgba(255,255,255,0.06);
    cursor: pointer;
    position: relative;
    padding: 0;
    transition: background 200ms ease, border-color 200ms ease;
    flex-shrink: 0;
  }
  .ls-device-toggle[data-on] { background: var(--device-accent, var(--accent)); border-color: transparent; }
  .ls-toggle-knob {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #fff;
    transition: transform 200ms cubic-bezier(0.4, 0, 0.2, 1);
  }
  .ls-device-toggle[data-on] .ls-toggle-knob { transform: translateX(12px); }

  /* Thermostat steppers */
  .ls-thermo-buttons { display: flex; gap: 6px; }
  .ls-step-btn {
    flex: 1;
    height: 24px;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: rgba(255,255,255,0.04);
    color: var(--text-2);
    font-size: 14px;
    line-height: 1;
    cursor: pointer;
    transition: background 150ms ease, color 150ms ease;
  }
  .ls-step-btn:hover { background: rgba(255,255,255,0.08); color: var(--text); }

  /* Speaker */
  .ls-play-btn {
    height: 24px;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: rgba(255,255,255,0.04);
    color: var(--text-2);
    font-size: 11px;
    cursor: pointer;
    transition: background 150ms ease, color 150ms ease;
  }
  .ls-play-btn:hover { background: rgba(255,255,255,0.08); color: var(--text); }

  .ls-eq { display: flex; gap: 3px; height: 16px; align-items: flex-end; }
  .ls-eq-bar {
    width: 4px;
    background: #a78bfa;
    border-radius: 2px;
    animation: ls-eq 0.9s ease-in-out infinite alternate;
  }
  @keyframes ls-eq {
    0%   { height: 3px; }
    100% { height: 14px; }
  }

  /* Device → tool chip (stage 1+). margin-top auto bottom-pins the chip in
     the card's column flex (the grid stretches all three cards to equal
     height), so the three mono chips share one baseline at the cards'
     equal 12px bottom padding — no zigzag. */
  .ls-device-chip {
    display: flex;
    align-items: center;
    gap: 5px;
    font-family: var(--mono);
    font-size: 10px;
    margin-top: auto;
  }
  .ls-chip-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }

  /* ─── Generic stage card ─── */

  .ls-card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .ls-card-label {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-3);
  }

  .ls-card-note {
    font-size: 12px;
    line-height: 1.55;
    color: var(--text-3);
    border-top: 1px solid var(--border);
    padding-top: 10px;
  }

  /* Stage 0: DOM soup */
  .ls-soup {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 12px 14px;
    font-family: var(--mono);
    font-size: 12px;
    line-height: 1.6;
    color: var(--text-3);
    overflow-x: auto;
    filter: blur(0.4px);
  }

  /* ─── Tool rail — ONE persistent catalog, morphing per stage ─── */

  .ls-rail { display: flex; flex-direction: column; }

  /* All-mounted show/hide: hidden chrome contributes ZERO height (grid
     0fr trick + overflow hidden), so it can never inflate .ls-zone
     scrollHeight and resurrect the phantom scrollbar. Spacing lives
     INSIDE the collapsing block so hidden chrome leaves no gap either. */
  .ls-collapse {
    display: grid;
    grid-template-rows: 0fr;
    opacity: 0;
    transition: grid-template-rows var(--chrome-ms, 260ms) var(--ease-soft),
                opacity var(--chrome-ms, 260ms) var(--ease-soft);
  }
  .ls-collapse[data-show] { grid-template-rows: 1fr; opacity: 1; }
  .ls-collapse-inner { overflow: hidden; min-height: 0; }

  .ls-chrome-block { padding-bottom: 10px; }
  .ls-chrome-block--below { padding: 8px 0 0; display: flex; flex-direction: column; }

  /* ── the three persistent rows ── */

  .ls-row-clip {
    display: grid;
    grid-template-rows: 1fr;
    opacity: 1;
    transition: grid-template-rows var(--chrome-ms, 260ms) var(--ease-soft),
                opacity var(--chrome-ms, 260ms) var(--ease-soft);
  }
  .ls-row-clip[data-hide] { grid-template-rows: 0fr; opacity: 0; }
  .ls-row-clip-inner { overflow: hidden; min-height: 0; }

  /* default skin = stage 1 schema card (accent edge via inset shadow so
     no border-width change ever shifts layout).
     The skin morph itself takes visible time: --skin-ms (~420ms, TUNE
     rowSkinMs) on every skin-affecting property with the zone-fade ease,
     so a stage change reads as the SAME rows re-dressing mid-crossfade,
     never a hard cut. */
  .ls-row {
    display: flex;
    flex-direction: column;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    box-shadow: inset 3px 0 0 var(--tool-accent, var(--accent));
    padding: 10px 14px;
    margin-bottom: 8px;
    transition: background var(--skin-ms, 420ms) var(--ease-soft),
                border-color var(--skin-ms, 420ms) var(--ease-soft),
                box-shadow var(--skin-ms, 420ms) var(--ease-soft),
                padding var(--skin-ms, 420ms) var(--ease-soft),
                border-radius var(--skin-ms, 420ms) var(--ease-soft),
                margin var(--skin-ms, 420ms) var(--ease-soft);
  }

  /* stage 3 — agent's-eye rows (hairline dividers, no card) */
  .ls-rail[data-stage="3"] .ls-row {
    background: transparent;
    border-color: transparent;
    border-bottom-color: rgba(255,255,255,0.04);
    border-radius: 0;
    box-shadow: none;
    padding: 9px 2px;
    margin-bottom: 0;
  }

  /* stages 4-5 — planned-invocation rows */
  .ls-rail[data-stage="4"] .ls-row,
  .ls-rail[data-stage="5"] .ls-row {
    box-shadow: none;
    padding: 9px 12px;
    margin-bottom: 6px;
  }

  /* hover highlight at stages 2-5 only */
  .ls-rail[data-hoverable] .ls-row:hover { background: rgba(255,255,255,0.05); }

  .ls-row-head {
    display: flex;
    align-items: center;
    gap: 7px;
    width: 100%;
    padding: 0;
    background: none;
    border: none;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: default;
  }

  .ls-row-name { font-family: var(--mono); font-size: 13px; font-weight: 600; display: inline-flex; align-items: baseline; }
  /* namespace prefix: inherits the tool accent and rests at 0.55 opacity
     (framer animates it there) — a dimmed namespace before the
     full-strength base name */
  .ls-row-prefix { display: inline-block; overflow: hidden; white-space: nowrap; }

  /* plan/approval status slot — width-collapsed until stages 4-5 */
  .ls-row-status {
    display: inline-flex;
    align-items: center;
    overflow: hidden;
    flex-shrink: 0;
    width: 0;
    opacity: 0;
    transition: width var(--chrome-ms, 260ms) var(--ease-soft),
                opacity var(--chrome-ms, 260ms) var(--ease-soft);
  }
  .ls-row-status[data-show] { width: 24px; opacity: 1; }

  .ls-row-desc { font-size: 12px; color: var(--text-2); padding-top: 4px; }
  .ls-row-schema { display: flex; flex-wrap: wrap; gap: 6px; padding-top: 8px; }
  .ls-row-call { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; padding-top: 8px; }
  .ls-row-note { font-size: 11px; color: var(--text-3); margin-left: auto; }

  .ls-param {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-family: var(--mono);
    font-size: 10.5px;
    padding: 2px 7px;
    border-radius: 5px;
    background: rgba(255,255,255,0.04);
    border: 1px solid var(--border);
    max-width: 100%;
  }
  .ls-param-key { color: var(--text); }
  .ls-param-type { color: var(--accent); }
  .ls-param-detail { color: var(--text-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ls-param--call { background: rgba(59, 130, 246, 0.08); border-color: rgba(59, 130, 246, 0.25); font-size: 11px; }
  .ls-call-value { color: var(--accent); font-weight: 600; }

  /* ── real <Command> palette embed (stage 2) ──
     Stage 2 renders the ACTUAL shipped agentk <Command> (see
     components/learn/stage.tsx → PaletteZone), so its chrome comes from the
     global [cmdk-*] / [data-agentk-*] rules in globals.css. These overrides
     only reseat it INSIDE the stage: drop the modal drop-shadow, sit it on
     the card surface, and tighten padding to the stage's scale. The form
     itself (enum → dropdown, bounded number → slider) is the component's own
     Command.ToolForm — untouched. */
  .ls-palette-embed [cmdk-root] {
    background: var(--bg-card);
    box-shadow: none;
  }
  .ls-palette-embed [cmdk-input] { padding: 12px 16px; font-size: 14px; }
  .ls-palette-embed [cmdk-list] { max-height: 260px; padding: 6px; }
  .ls-palette-embed [data-agentk-form],
  .ls-palette-embed [data-agentk-result] { padding: 0 16px 16px; }
  .ls-palette-embed [data-agentk-form-heading] { padding: 14px 0; margin-bottom: 16px; }

  /* ── agent chrome (stage 3) ── */

  .ls-agent-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
  .ls-agent-title { font-family: var(--mono); font-size: 13px; color: var(--text); }
  .ls-agent-badge {
    font-size: 10.5px;
    font-weight: 500;
    padding: 3px 9px;
    border-radius: 999px;
    background: rgba(255,255,255,0.05);
    border: 1px solid var(--border);
    color: var(--text-3);
  }
  .ls-agent-badge--live {
    background: rgba(34, 197, 94, 0.1);
    border-color: rgba(34, 197, 94, 0.2);
    color: var(--green);
  }
  .ls-agent-note { font-size: 11.5px; line-height: 1.5; color: var(--text-3); padding-top: 6px; }
  .ls-agent-note code { font-family: var(--mono); font-size: 10.5px; color: var(--text-2); }

  /* ── plan chrome (stage 4) ── */

  .ls-prompt {
    font-size: 15px;
    font-weight: 500;
    line-height: 1.5;
    color: var(--text);
    background: rgba(59, 130, 246, 0.07);
    border: 1px solid rgba(59, 130, 246, 0.15);
    border-radius: var(--radius-sm);
    padding: 12px 14px;
  }
  .ls-prompt-quote { color: var(--accent); }

  .ls-plan-thinking { font-size: 12px; color: var(--text-3); font-family: var(--mono); padding: 4px 2px; }
  .ls-plan-index {
    font-size: 10px;
    font-weight: 600;
    color: var(--text-3);
    border: 1px solid var(--border);
    border-radius: 50%;
    width: 17px;
    height: 17px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    align-self: center;
    font-variant-numeric: tabular-nums;
  }

  /* ── approval chrome (stage 5) ──
     button visuals come from globals.css [data-agentk-approval-*] */

  .ls-approval-summary { font-size: 13.5px; font-weight: 500; line-height: 1.5; color: var(--text); }
  /* the gate sentence fades (visibility only) once approval is given so it
     never contradicts green executed checks below it */
  .ls-approval-gate { transition: opacity 300ms var(--ease-soft); }
  .ls-approval-gate[data-faded] { opacity: 0; }

  .ls-approve-dock { display: flex; justify-content: flex-end; gap: 8px; padding-bottom: 10px; }
  .ls-approve-dock [data-agentk-approval-approve]:active,
  .ls-approve-dock [data-agentk-approval-reject]:active { transform: scale(0.98); }
  /* One primary-action grammar for the whole walkthrough: Approve matches
     the neutral Run pill (blue stays reserved for tool identity). */
  .ls-approve-dock [data-agentk-approval-approve] {
    background: #ececec;
    color: #141414;
    border-color: transparent;
  }
  .ls-approve-dock [data-agentk-approval-approve]:hover { background: #ffffff; }
  .ls-approve-dock [data-agentk-approval-approve][data-running] {
    animation: ls-approve-pulse 1.1s ease-in-out infinite;
    cursor: default;
  }
  @keyframes ls-approve-pulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(236, 236, 236, 0.30); }
    50%      { box-shadow: 0 0 0 6px rgba(236, 236, 236, 0); }
  }

  .ls-call-done { color: var(--green); font-size: 13px; }
  .ls-call-spinner {
    display: inline-block;
    width: 12px;
    height: 12px;
    border: 2px solid var(--border);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: ls-spin 600ms linear infinite;
  }
  @keyframes ls-spin { to { transform: rotate(360deg); } }

  .ls-approval-status { font-size: 13px; color: var(--text-2); padding: 0 0 10px; line-height: 1.5; }
  .ls-approval-reset { padding-bottom: 10px; }
  .ls-ghost-btn {
    align-self: flex-start;
    padding: 6px 14px;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: transparent;
    color: var(--text-2);
    font-size: 12px;
    font-family: var(--font);
    cursor: pointer;
    transition: background 150ms ease;
  }
  .ls-ghost-btn:hover { background: rgba(255,255,255,0.05); }

  /* Stage 6: ship — floating chrome (no outer bordered panel), same as
     every other stage; the condensed devices stay visible above it */
  .ls-ship {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 2px;
  }

  .ls-ship-status {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 9px;
  }
  .ls-ship-status li {
    font-size: 13px;
    line-height: 1.55;
    color: var(--text-2);
    padding-left: 18px;
    position: relative;
  }
  .ls-ship-status li::before {
    content: '–';
    position: absolute;
    left: 2px;
    color: var(--text-3);
  }

  .ls-install {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 11px 16px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--bg);
    color: var(--text);
    font-size: 13px;
    cursor: pointer;
    transition: border-color 150ms ease, background 150ms ease;
  }
  .ls-install:hover { border-color: var(--border-focus); background: var(--bg-elevated); }
  .ls-install code { font-family: var(--mono); font-size: 13px; }
  .ls-install svg { color: var(--text-3); flex-shrink: 0; }

  .ls-ship-links { display: flex; flex-direction: column; gap: 2px; }
  .ls-ship-link {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 6px 2px;
    font-size: 13px;
    color: var(--text-2);
    text-decoration: none;
    transition: color 150ms ease;
  }
  .ls-ship-link:hover { color: var(--text); }
  .ls-ship-link svg { transition: transform 150ms ease; }
  .ls-ship-link:hover svg { transform: translateX(2px); }

  /* ─── Mobile: stage becomes a sticky top panel ─── */

  @media (max-width: 900px) {
    .learn-layout {
      display: flex;
      flex-direction: column;
      padding: 0 16px 80px;
    }

    /* The intro leads the page: .learn-steps dissolves (display: contents)
       so the intro and step sections become flex items of .learn-layout,
       and order -1 lifts the intro above the sticky stage — the first
       screenful opens with "What is WebMCP?", not the machinery. */
    .learn-steps { display: contents; }
    .learn-intro { order: -1; padding: 24px 0 16px; }

    .learn-stage-wrap {
      position: sticky;
      top: 0;
      z-index: 40;
      /* auto-size to the stage's content (capped) instead of a fixed
         height: shorter stages take less of the viewport, taller stages
         get enough room that all three tool rows stay visible */
      height: auto;
      max-height: 60vh;
      padding: 10px 0;
      background: var(--bg);
      box-shadow: 0 12px 24px -18px rgba(0,0,0,0.9);
      align-items: stretch;
    }
    /* prose dissolves over a real distance under the sticky stage instead
       of being sliced mid-line by its hard edge */
    .learn-stage-wrap::after {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      top: 100%;
      height: 36px;
      background: linear-gradient(var(--bg), transparent);
      pointer-events: none;
    }

    /* wrap height is auto, so the cap must live on the panel itself
       (60vh minus the wrap's 10px vertical paddings) */
    .ls-panel { max-height: calc(60vh - 20px); }
    .ls-zone { flex: 1; }

    .learn-intro h1 { font-size: 32px; }

    .learn-step { min-height: 62vh; }
    .learn-step-card { max-width: none; padding: 18px; }
    .learn-step-card h2 { font-size: 22px; }

    .ls-devices { gap: 8px; }
    .ls-device { padding: 10px; }
    .ls-device-reading { font-size: 15px; }
    .ls-row-note { display: none; }
  }

  /* ≤480px: the schema param chips retire so all three tool rows stay
     visible on a phone-height stage. The plan's call params still render —
     they are the payload of stages 4-5. */
  @media (max-width: 480px) {
    /* keep the stage under half the viewport mid-walkthrough */
    .ls-row { padding-top: 8px; padding-bottom: 8px; }
    .ls-panel { gap: 10px; }
    .ls-device { padding: 10px; gap: 4px; }
    .ls-device-reading { font-size: 15px; }
    .ls-zone-caption, .ls-note { margin-top: 4px; }

    .ls-row-schema { display: none; }
    .ls-card { padding: 12px; }
    .ls-soup { font-size: 11px; }
    .ls-prompt { font-size: 13.5px; padding: 10px 12px; }
  }

  /* ─── Reduced motion: no ambient animation, instant everything.
     (Framer springs collapse to duration 0 via useReducedMotion, and
     --chrome-ms is set to 0ms inline — these rules catch the rest.) ─── */

  @media (prefers-reduced-motion: reduce) {
    .ls-eq-bar { animation: none; height: 10px; }
    .ls-call-spinner { animation: none; }
    .ls-approve-dock [data-agentk-approval-approve][data-running] { animation: none; }
    .learn-step-card,
    .ls-device,
    .ls-toggle-knob,
    .ls-device-toggle,
    .ls-device-icon,
    .ls-collapse,
    .ls-row-clip,
    .ls-row,
    .ls-row-status,
    .ls-approval-gate,
    .ls-ghost-btn {
      transition: none;
    }
    .ls-device:hover { transform: none; }
    .ls-approve-dock [data-agentk-approval-approve]:active,
    .ls-approve-dock [data-agentk-approval-reject]:active { transform: none; }
  }
`
