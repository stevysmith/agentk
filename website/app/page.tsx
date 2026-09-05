'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { THEME_ICONS, GitHubIcon, CheckIcon, CopyIcon, SunIcon, MoonIcon } from '../components/icons'
import RaycastTheme from '../components/cmdk/raycast'
import LinearTheme from '../components/cmdk/linear'
import SmartHomeTheme from '../components/cmdk/smarthome'
import DevOpsTheme from '../components/cmdk/devops'
import ShopTheme from '../components/cmdk/shop'
import { showcaseStyles } from '../components/styles'
import React from 'react'
// the badge reads the published version straight from the package, so a release can't leave it stale
import { version } from '../../package.json'

// ─────────────────────────────────────────────────────────
// Lightweight JSX/JS syntax highlighter (no deps)
// ─────────────────────────────────────────────────────────

function highlightCode(code: string): React.ReactNode[] {
  const tokens: React.ReactNode[] = []
  // Regex to match: comments, strings, JSX tags, keywords, attributes, braces/punctuation
  const pattern = /(\/\/[^\n]*|'[^']*'|"[^"]*"|<\/?[A-Z][\w.]*|<\/?>|\b(?:const|let|import|from|type|true|false)\b|(?<=<\/?[\w.]+\s+)[\w]+(?==)|\{[^{}]*\})/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(code)) !== null) {
    // Plain text before the match
    if (match.index > lastIndex) {
      tokens.push(code.slice(lastIndex, match.index))
    }
    const text = match[0]
    let cls = ''
    if (text.startsWith('//')) cls = 'hl-comment'
    else if (text.startsWith("'") || text.startsWith('"')) cls = 'hl-str'
    else if (text.startsWith('<')) cls = 'hl-tag'
    else if (/^(const|let|import|from|type|true|false)$/.test(text)) cls = 'hl-kw'
    else if (/^[a-z][\w]*$/.test(text) && code[match.index + text.length] === '=') cls = 'hl-attr'

    if (cls) {
      tokens.push(<span key={match.index} className={cls}>{text}</span>)
    } else {
      tokens.push(text)
    }
    lastIndex = match.index + text.length
  }
  if (lastIndex < code.length) {
    tokens.push(code.slice(lastIndex))
  }
  return tokens
}

// ─────────────────────────────────────────────────────────
// Theme configuration
// ─────────────────────────────────────────────────────────

const THEMES = [
  { id: 'devops', label: 'DevOps', hint: 'Deploy staging from main branch', icon: THEME_ICONS.devops, demoUrl: '/devops', demoLabel: 'Try the DevOps demo' },
  { id: 'smarthome', label: 'Smart Home', hint: 'Set up a romantic evening', icon: THEME_ICONS.smarthome, demoUrl: '/smart-home', demoLabel: 'Try the Smart Home demo' },
  { id: 'linear', label: 'Linear', hint: 'Assign to me and close the ticket', icon: THEME_ICONS.linear, demoUrl: '/linear', demoLabel: 'Try the Linear demo' },
  { id: 'shop', label: 'Shop', hint: 'Something casual under $100', icon: THEME_ICONS.shop, demoUrl: '/shop', demoLabel: 'Try the Shop demo' },
  { id: 'raycast', label: 'Raycast', hint: '', icon: THEME_ICONS.raycast, demoUrl: '/docs', demoLabel: 'Try the API Docs demo' },
] as const

type ThemeId = (typeof THEMES)[number]['id']

// ─────────────────────────────────────────────────────────
// Theme renderer map
// ─────────────────────────────────────────────────────────

/** Who can actually call a page's tools today. Sourced from the WebMCP spec's
 *  implementation-status.md and shopify.dev/docs/api/web-mcp — deliberately
 *  facts rather than logos, and the gap is on the page too. */
const ADOPTION = [
  { who: 'Chrome 149', what: 'origin trial' },
  { who: 'Edge 150', what: 'origin trial' },
  { who: 'ChatGPT Desktop', what: 'supported' },
  { who: 'Brave', what: 'experimental, in Leo' },
  { who: 'Shopify', what: 'every Liquid storefront, 12 tools' },
] as const

/** For a reader who has been told to "look at WebMCP", not one who has already
 *  fought it. Consequences, not war stories: no version numbers, no issue
 *  links, nothing that reads as an unstable ecosystem to someone deciding
 *  whether to depend on it. */
const EVALUATION = [
  {
    claim: 'You define your tools once.',
    detail:
      'The same JSON Schema definition drives a \u2318K palette for people and the surface agents call. No second implementation to keep in sync, and no separate agent API to maintain.',
  },
  {
    claim: 'The work is not wasted if agents never show up.',
    detail:
      'Where WebMCP is not available, you have still shipped a command palette your users can use today. That is the whole downside case.',
  },
  {
    claim: 'You decide what an agent may do on its own.',
    detail:
      'Mark a tool read-only and it runs without interrupting anyone. Mark it consequential \u2014 paying, sending, publishing \u2014 and it stops for a person every time, whatever else is switched on.',
  },
  {
    claim: 'It works where the agents actually are.',
    detail:
      'Chrome, Edge and ChatGPT\u2019s desktop browser each expose WebMCP slightly differently, and a phone is not a laptop. agentk handles those differences so your page does not have to.',
  },
  {
    claim: 'The spec is still moving. Your code does not have to.',
    detail:
      'It is a live standard, developed in the W3C Web Machine Learning Community Group. When it changes, agentk changes \u2014 that is the point of taking a dependency rather than writing registration by hand.',
  },
] as const

/** The honest routing table. A reader who fits the last row has disqualified
 *  the other three themselves, which is worth more than claiming to win them. */
const OPTIONS = [
  { when: 'On Shopify', then: 'You already have WebMCP tools on every storefront — catalog, cart, checkout. You may need nothing.' },
  { when: 'On Cloudflare', then: 'Their edge bridge gives agents an interface with no code and no origin changes. Fastest path if generic tools are enough.' },
  { when: 'Three static tools, no UI', then: 'Registering them by hand is genuinely fine. It is not much code.' },
  { when: 'A tool list that changes as people use the app — or the same actions need a human interface too', then: 'That is agentk.', ours: true },
] as const

/** The same task, done both ways. No benchmark numbers: Chrome publishes none,
 *  and the ones circulating (89%, 90%) trace to blog posts rather than a source
 *  worth quoting on a landing page. The steps below are the argument. */
const ACTUATION: Record<ThemeId, { task: string; steps: string[]; call: string }> = {
  devops: {
    task: 'deploy staging from main',
    steps: ['Screenshot the page', 'Find something that looks like Deploy', 'Click it, screenshot again', 'Locate the environment select', 'Pick staging, type the branch', 'Screenshot to check it worked'],
    call: 'deploy({ environment: "staging", branch: "main" })',
  },
  linear: {
    task: 'file a bug and assign it',
    steps: ['Screenshot the page', 'Find the new-issue control', 'Click, wait for the panel', 'Type into the right field', 'Find the assignee picker', 'Screenshot to confirm it saved'],
    call: 'create_issue({ title: "Login redirect loops", assignee: "me" })',
  },
  smarthome: {
    task: 'dim the living room',
    steps: ['Screenshot the page', 'Find the living-room card', 'Guess which control is brightness', 'Drag the slider to roughly 30%', 'Screenshot to see where it landed', 'Drag again if it missed'],
    call: 'set_brightness({ room: "living room", level: 30 })',
  },
  shop: {
    task: 'add a size M to the cart',
    steps: ['Screenshot the page', 'Find the size selector', 'Click M, screenshot again', 'Find Add to cart', 'Click it, wait', 'Screenshot to confirm the cart changed'],
    call: 'add_to_cart({ sku: "AK-2291", size: "M" })',
  },
  raycast: {
    task: 'open the clipboard history',
    steps: ['Screenshot the page', 'Scan the list for the right row', 'Click it, screenshot again', 'Check whether the right panel opened', 'Scroll if it did not', 'Screenshot to confirm'],
    call: 'open_command({ name: "Clipboard History" })',
  },
}

const THEME_COMPONENTS: Record<ThemeId, React.FC<{ placeholder?: string }>> = {
  raycast: RaycastTheme,
  linear: LinearTheme,
  smarthome: SmartHomeTheme,
  devops: DevOpsTheme,
  shop: ShopTheme,
}

// ─── Ghost-typing placeholder (the palette input "demonstrates itself") ───
// Placeholder ONLY: never writes the input's value, never fakes a run, never
// steals focus. Always framed as `Try: “…”` so it reads as a suggestion, not
// live typing. Cancelled permanently by any user interaction with the
// palette. Reduced motion gets the same placeholder, static.
const GHOST_IDLE_MS = 3500 // idle before the first ghost-typed hint
const GHOST_TYPE_MS = 45 //   per-character typing cadence
const GHOST_HOLD_MS = 2500 // hold the full hint before clearing
const GHOST_GAP_MS = 2600 //  gentle pause between cycles

// ─────────────────────────────────────────────────────────
// Code snippets per theme
// ─────────────────────────────────────────────────────────

const THEME_CODE: Record<ThemeId, { code: string; highlights: Record<string, 'kw' | 'fn' | 'str' | 'attr' | 'tag' | 'comment'> }> = {
  raycast: {
    code: `// 1. define tools once — JSON Schema in, forms + WebMCP out
const tools = [
  {
    name: 'clipboard_history',
    label: 'Clipboard History',
    inputSchema: {
      type: 'object',
      properties: {
        filter: {
          type: 'string',
          enum: ['All', 'Text', 'Images'],
        },
        limit: { type: 'number', minimum: 1, maximum: 50 },
      },
    },
  },
]

// 2. one component, two consumers
<Command tools={tools} onToolExecute={exec}>
  <Command.Input />
  <Command.List />
  <Command.ToolForm />
  <Command.ToolResult />
</Command>`,
    highlights: {},
  },
  linear: {
    code: `// 1. define tools once — JSON Schema in, forms + WebMCP out
const tools = [
  { name: 'assign_to_me', label: 'Assign to me' },
  {
    name: 'change_status',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['Todo', 'Done'] },
      },
    },
  },
]

// 2. one component, two consumers — plans gated by approval
<Command tools={tools} onToolExecute={exec}
  agent={{ provider: 'anthropic', requireApproval: true }}>
  <Command.Input />
  <Command.List>
    <Command.AgentHint />
  </Command.List>
  <Command.Approval />
</Command>`,
    highlights: {},
  },
  smarthome: {
    code: `// 1. define tools once — JSON Schema in, forms + WebMCP out
const tools = [
  { name: 'set_brightness', label: 'Adjust Lights' },
  { name: 'set_temperature', label: 'Set Temperature' },
  { name: 'play_media', label: 'Play Media' },
]

// 2. one component, two consumers —
//    requireApproval: false, so the agent executes immediately
<Command tools={tools} onToolExecute={exec}
  agent={{ provider: 'anthropic', requireApproval: false }}>
  <Command.Input />
  <Command.List>
    <Command.AgentHint />
  </Command.List>
  <Command.ToolResult />
  <Command.ActivityFeed />
</Command>`,
    highlights: {},
  },
  devops: {
    code: `// 1. define tools once — JSON Schema in, forms + WebMCP out
const tools = [
  { name: 'run_tests', label: 'Run Tests' },
  { name: 'build', label: 'Build' },
  {
    name: 'deploy',
    inputSchema: {
      type: 'object',
      properties: {
        environment: {
          type: 'string',
          enum: ['staging', 'production'],
        },
        branch: { type: 'string' },
      },
    },
  },
]

// 2. one component, two consumers
<Command tools={tools} onToolExecute={exec}
  agent={{ provider: 'anthropic', requireApproval: true }}>
  <Command.Input />
  <Command.List />
  <Command.Approval />
  <Command.ActivityFeed />
</Command>`,
    highlights: {},
  },
  shop: {
    code: `// 1. define tools once — JSON Schema in, forms + WebMCP out
const tools = [
  { name: 'search_products', label: 'Search' },
  { name: 'get_recommendations', label: 'Recommend' },
]

// 2. one component, two consumers —
//    no <Command.Tool> rendered: agent-first UI
<Command tools={tools} onToolExecute={exec}
  shouldFilter={false}
  agent={{ provider: 'anthropic', requireApproval: false }}>
  <Command.Input placeholder="What are you looking for?" />
  <Command.List>
    <Command.AgentHint />
  </Command.List>
  <Command.ToolResult />
</Command>`,
    highlights: {},
  },
}

// Module-level guard so the DevTools easter egg logs exactly once per load,
// even through React StrictMode's double-invoked effects (mirrors /learn).
let easterEggLogged = false

// ─────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────

export default function ShowcasePage() {
  const [copied, setCopied] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [activeTheme, setActiveTheme] = useState<ThemeId>('devops')
  // The demo palette, promoted to a bottom sheet on touch. Inline stays inline:
  // the page has a code block under the palette, and a phone has no ⌘K.
  const [sheetOpen, setSheetOpen] = useState(false)
  const [dark, setDark] = useState(false)
  const [codeCopied, setCodeCopied] = useState(false)
  const themeTabsRef = useRef<HTMLDivElement>(null)
  const demoAreaRef = useRef<HTMLDivElement>(null)
  // Ghost-typed placeholder for the active palette input. null = the theme's
  // own default placeholder.
  const [ghost, setGhost] = useState<string | null>(null)
  const ghostCancelledRef = useRef(false)
  // True only while WE call input.focus() (theme-change refocus), so the
  // resulting focusin never counts as user interaction with the palette.
  const progFocusRef = useRef(false)

  // ─── DevTools easter egg (client-only, once) ───
  // Honest and dev-facing, matching /learn's: detects whether a WebMCP surface
  // exists in THIS browser and phrases the claim accordingly, and links the repo.
  useEffect(() => {
    if (easterEggLogged) return
    easterEggLogged = true
    const activeSurface =
      'modelContext' in document
        ? 'document.modelContext'
        : 'modelContext' in navigator
          ? 'navigator.modelContext'
          : null
    const reality = activeSurface
      ? `This browser exposes WebMCP — agentk can register your tools on ${activeSurface} for agents to call.`
      : "WebMCP is in origin trial in Chrome 149 and Edge 150; this browser doesn't expose it. agentk degrades to a plain command palette — nothing breaks."
    console.log(
      `%cagentk%c · the command palette for the agentic web.\n${reality}\nSource: https://github.com/stevysmith/agentk`,
      'font-weight:700;color:#f59e0b',
      'color:inherit',
    )
  }, [])

  useEffect(() => {
    setMounted(true)
    // Read dark mode: localStorage first, then system preference
    const stored = localStorage.getItem('agentk-dark')
    if (stored !== null) {
      setDark(stored === 'true')
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setDark(true)
    }
  }, [])

  // Arrow key navigation for theme tabs
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Never hijack arrows from editable controls: caret movement and
      // option selection win. Exception: an EMPTY text input (the
      // programmatically focused palette search) has no caret to move, so
      // the theme shortcut still works from the default resting state.
      const target = e.target as HTMLElement | null
      if (target) {
        if (target.isContentEditable || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return
        if (target.tagName === 'INPUT') {
          const input = target as HTMLInputElement
          const emptyTextInput = (input.type === 'text' || input.type === 'search') && input.value === ''
          if (!emptyTextInput) return
        }
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const idx = THEMES.findIndex((t) => t.id === activeTheme)
        if (e.key === 'ArrowLeft' && idx > 0) {
          e.preventDefault()
          setActiveTheme(THEMES[idx - 1].id)
        } else if (e.key === 'ArrowRight' && idx < THEMES.length - 1) {
          e.preventDefault()
          setActiveTheme(THEMES[idx + 1].id)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeTheme])

  // Focus the active theme's command input. This effect is the ONLY thing
  // that focuses the palette — the theme inputs deliberately have no
  // autoFocus, because React's commit-phase autofocus fires an unguarded
  // focusin inside .demo-area that would cancel the ghost-typed placeholder
  // on load and on every tab switch.
  useEffect(() => {
    // Try immediately, then retry after animation completes
    const tryFocus = () => {
      const input = document.querySelector('.palette-container [cmdk-input]') as HTMLInputElement
      if (input) {
        // Programmatic refocus — must not read as user interaction (which
        // would cancel the ghost-typed placeholder). focusin fires
        // synchronously inside .focus(), so the flag window is exact.
        progFocusRef.current = true
        input.focus()
        progFocusRef.current = false
        return true
      }
      return false
    }
    if (tryFocus()) return
    const t1 = setTimeout(tryFocus, 50)
    const t2 = setTimeout(tryFocus, 200)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [activeTheme])

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText('npm install @stevysmith/agentk')
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = 'npm install @stevysmith/agentk'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [])

  const ActiveThemeComponent = THEME_COMPONENTS[activeTheme]

  // /learn's motion character: one calm ease curve shared across the two pages.
  const ease = [0.32, 0, 0.24, 1] as const
  // Reduced-motion preference, deferred one render: the server can't know
  // the preference, so the first client render must match the SSR markup
  // (framer's initial styles included) or React 19 logs a hydration style
  // mismatch for reduced-motion users. Flipping via effect keeps hydration
  // clean; the flip lands in the same commit as `mounted`, so every
  // entrance still collapses to 0s before it plays.
  const prefersReduced = useReducedMotion()
  const [reduced, setReduced] = useState(false)
  useEffect(() => { setReduced(!!prefersReduced) }, [prefersReduced])
  // Reduced motion: keep the entrance choreography's timing structure but
  // collapse each transition to 0s so nothing translates or fades in.
  const rt = (duration: number, delay: number) =>
    reduced ? { duration: 0, delay: 0, ease } : { duration, delay, ease }

  // ─── Ghost-typing placeholder loop ───
  // Types the ACTIVE theme's hint into the placeholder (never the value),
  // holds, clears, and gently repeats. Restarts clean on tab change; cancels
  // permanently on any user interaction with the palette (see listener
  // effect below). Both variants carry the `Try: “…”` framing so the
  // animation reads as a suggestion, never as live typing. Reduced motion:
  // the same placeholder, static.
  useEffect(() => {
    const hint = THEMES.find((t) => t.id === activeTheme)?.hint
    if (!hint || ghostCancelledRef.current) {
      setGhost(null)
      return
    }
    if (reduced) {
      setGhost(`Try: “${hint}”`)
      return () => setGhost(null)
    }
    let alive = true
    let interval = 0
    const timers: number[] = []
    const bail = () => {
      alive = false
      if (interval) clearInterval(interval)
      timers.forEach(clearTimeout)
      setGhost(null)
    }
    const type = () => {
      if (!alive || ghostCancelledRef.current) return bail()
      let i = 0
      interval = window.setInterval(() => {
        if (!alive || ghostCancelledRef.current) return bail()
        i++
        setGhost(`Try: “${hint.slice(0, i)}”`)
        if (i >= hint.length) {
          clearInterval(interval)
          interval = 0
          timers.push(
            window.setTimeout(() => {
              if (!alive || ghostCancelledRef.current) return bail()
              setGhost(null)
              timers.push(window.setTimeout(type, GHOST_GAP_MS))
            }, GHOST_HOLD_MS),
          )
        }
      }, GHOST_TYPE_MS)
    }
    timers.push(window.setTimeout(type, GHOST_IDLE_MS))
    return bail
  }, [activeTheme, reduced])

  // Any real user interaction with the palette cancels ghost typing for good
  // — the demo must never talk over someone actually using it.
  useEffect(() => {
    const el = demoAreaRef.current
    if (!el) return
    const cancel = () => {
      ghostCancelledRef.current = true
      setGhost(null)
    }
    const onFocusIn = () => {
      if (!progFocusRef.current) cancel()
    }
    el.addEventListener('pointerdown', cancel)
    el.addEventListener('keydown', cancel)
    el.addEventListener('focusin', onFocusIn)
    return () => {
      el.removeEventListener('pointerdown', cancel)
      el.removeEventListener('keydown', cancel)
      el.removeEventListener('focusin', onFocusIn)
    }
  }, [])

  return (
    <>
      {/* Editorial serif for the hero display headline, loaded the SAME
          page-scoped way as /learn (Google Fonts, opsz axis, display=swap).
          React hoists+dedupes these into <head>; the preconnects shave the
          setup off the CSS + woff2 fetch, and the metric-tuned 'Newsreader
          Fallback' face in styles.ts keeps the swap from shifting the headline. */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,500..600&display=swap"
      />
      <style>{showcaseStyles}</style>

      <div className={`showcase-page${dark ? ' dark' : ''}`}>
        {/* Background gradient mesh */}
        <div className="bg-mesh" />

        {/* Dark mode toggle */}
        <button
          className="theme-toggle"
          onClick={() => setDark((d) => { localStorage.setItem('agentk-dark', String(!d)); return !d })}
          aria-label="Toggle dark mode"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={dark ? 'sun' : 'moon'}
              initial={{ opacity: 0, rotate: -90, scale: 0.8 }}
              animate={{ opacity: 1, rotate: 0, scale: 1 }}
              exit={{ opacity: 0, rotate: 90, scale: 0.8 }}
              transition={{ duration: 0.2 }}
              style={{ display: 'flex' }}
            >
              {dark ? <SunIcon /> : <MoonIcon />}
            </motion.span>
          </AnimatePresence>
        </button>

        <div className="page-content">
          <div className="hero">
            {/* ─── Hero copy (left) ─── */}
            <motion.div
              className="hero-copy"
              initial={reduced ? false : { opacity: 0, y: 16 }}
              animate={mounted ? { opacity: 1, y: 0 } : {}}
              transition={rt(0.6, 0.1)}
            >
              <div className="title-row">
                <h1 className="page-title">agentk</h1>
                <span className="version-badge">v{version}</span>
              </div>
              <p className="tagline">Your site has a<br />second visitor.</p>
              <p className="tagline-sub"><strong>It doesn&rsquo;t click &mdash; it calls.</strong> agentk is a React component that turns one tool definition into both: a &#8984;K palette for people, and a WebMCP surface for agents. One definition, two ways in.</p>

              {/* Walkthrough — leads the CTA stack, the interactive proof */}
              <a href="/learn" className="hero-walkthrough">
                Watch WebMCP drive a page I built &mdash; two&nbsp;minutes
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </a>

              <div className="hero-actions">
                <button className="install-btn" onClick={handleCopy}>
                  {copied ? (
                    <span className="copied-state">
                      <CheckIcon />
                      <span>Copied!</span>
                    </span>
                  ) : (
                    <>
                      <span className="install-text">npm install @stevysmith/agentk</span>
                      <span className="copy-icon-wrap">
                        <CopyIcon />
                      </span>
                    </>
                  )}
                </button>
                <a
                  className="github-link"
                  href="https://github.com/stevysmith/agentk"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <GitHubIcon />
                  <span>GitHub</span>
                </a>
              </div>

              {/* Honesty — last in the stack, as designed fine print. The
                  hedge is no longer "will this be real"; it is which engines
                  have it yet, which is why the fallback clause still earns
                  its place. Every claim here is in the spec's own
                  implementation-status.md. */}
              <div className="hero-honesty">
                <span className="hero-honesty-eyebrow">Shipping</span>
                <p>Origin trials are live in Chrome&nbsp;149 and Edge&nbsp;150, ChatGPT Desktop supports it, and Shopify puts WebMCP tools on every Liquid storefront. Firefox and Safari have standards positions open &mdash; so agentk feature-detects and falls back to a plain command palette wherever it&rsquo;s missing.</p>
              </div>

              {/* The page's one handmade moment: a quiet margin note (Caveat)
                  nudging toward the live palette. Desktop-only; clicking it
                  RUNS the suggestion — fills the palette input and submits so
                  the theme's scripted demo flow plays (same fill-and-run
                  mechanism as the Shop empty-state pill). */}
              {(() => {
                const hint = THEMES.find((t) => t.id === activeTheme)?.hint
                if (!hint) return null
                return (
                  <button
                    type="button"
                    className="demo-hint"
                    onClick={() => {
                      const input = document.querySelector('.palette-container [cmdk-input]') as HTMLInputElement | null
                      if (!input) return
                      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
                      setter?.call(input, hint)
                      input.dispatchEvent(new Event('input', { bubbles: true }))
                      input.focus()
                      // Next frame: the agent-hint item has rendered and holds
                      // selection, so Enter submits through the normal path.
                      requestAnimationFrame(() => {
                        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
                      })
                    }}
                  >
                    <span className="demo-hint-text">try: &ldquo;{hint.toLowerCase()}&rdquo;</span>
                    <svg
                      className="demo-hint-arrow"
                      width="34"
                      height="22"
                      viewBox="0 0 34 22"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M2 19c9 1 21-2 27-13"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                      />
                      <path
                        d="M24 6.5 29.5 5l.6 5.6"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                )
              })()}
            </motion.div>

            {/* ─── Live showcase (right): tabs → palette → source → CTA ─── */}
            <div className="hero-showcase">
              {/* Theme Switcher */}
              <motion.div
                className="theme-switcher"
                ref={themeTabsRef}
                initial={reduced ? false : { opacity: 0, y: 12 }}
                animate={mounted ? { opacity: 1, y: 0 } : {}}
                transition={rt(0.5, 0.4)}
                role="tablist"
              >
                <button
                  className="theme-arrow"
                  onClick={() => {
                    const idx = THEMES.findIndex((t) => t.id === activeTheme)
                    if (idx > 0) setActiveTheme(THEMES[idx - 1].id)
                  }}
                  aria-label="Previous theme"
                  data-disabled={activeTheme === THEMES[0].id ? '' : undefined}
                >
                  ←
                </button>
                {THEMES.map((theme) => (
                  <button
                    key={theme.id}
                    className="theme-tab"
                    data-active={activeTheme === theme.id ? '' : undefined}
                    onClick={() => {
                      setActiveTheme(theme.id)
                    }}
                    role="tab"
                    aria-selected={activeTheme === theme.id}
                  >
                    {activeTheme === theme.id && (
                      <motion.div
                        className="theme-tab-bg"
                        layoutId="activeThemeTab"
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      />
                    )}
                    <span className="theme-tab-icon">{theme.icon}</span>
                    <span className="theme-tab-label">{theme.label}</span>
                  </button>
                ))}
                <button
                  className="theme-arrow"
                  onClick={() => {
                    const idx = THEMES.findIndex((t) => t.id === activeTheme)
                    if (idx < THEMES.length - 1) setActiveTheme(THEMES[idx + 1].id)
                  }}
                  aria-label="Next theme"
                  data-disabled={activeTheme === THEMES[THEMES.length - 1].id ? '' : undefined}
                >
                  →
                </button>
              </motion.div>

              {/* Palette */}
              <motion.div
                className="demo-area"
                data-sheet={sheetOpen ? '' : undefined}
                ref={demoAreaRef}
                layout
                initial={reduced ? false : { opacity: 0, y: 24, scale: 0.98 }}
                animate={mounted ? { opacity: 1, y: 0, scale: 1 } : {}}
                transition={{ ...rt(0.7, 0.25), layout: { duration: reduced ? 0 : 0.3, ease } }}
              >
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTheme}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.12 }}
                  >
                    <ActiveThemeComponent placeholder={ghost ?? undefined} />
                  </motion.div>
                </AnimatePresence>
              </motion.div>

              {/* Code snippet — identical surface to the palette above */}
              <motion.div
                className="code-area"
                initial={reduced ? false : { opacity: 0, y: 12 }}
                animate={mounted ? { opacity: 1, y: 0 } : {}}
                transition={rt(0.5, 0.5)}
              >
                <AnimatePresence mode="wait">
                  <motion.pre
                    key={activeTheme}
                    className="code-block"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <button
                      className="code-copy-btn"
                      data-copied={codeCopied ? '' : undefined}
                      onClick={() => {
                        navigator.clipboard.writeText(THEME_CODE[activeTheme].code)
                        setCodeCopied(true)
                        setTimeout(() => setCodeCopied(false), 2000)
                      }}
                      aria-label="Copy code"
                    >
                      <AnimatePresence mode="wait" initial={false}>
                        <motion.span
                          key={codeCopied ? 'check' : 'copy'}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          transition={{ duration: 0.15 }}
                          style={{ display: 'flex' }}
                        >
                          {codeCopied ? <CheckIcon /> : <CopyIcon />}
                        </motion.span>
                      </AnimatePresence>
                    </button>
                    <code>{highlightCode(THEME_CODE[activeTheme].code)}</code>
                  </motion.pre>
                </AnimatePresence>
              </motion.div>

              {/* Single demo CTA (deduped) + repurposed docs link */}
              <motion.div
                className="demo-cta-row"
                initial={reduced ? false : { opacity: 0, y: 8 }}
                animate={mounted ? { opacity: 1, y: 0 } : {}}
                transition={rt(0.5, 0.55)}
              >
                <AnimatePresence mode="wait">
                  {(() => {
                    const theme = THEMES.find(t => t.id === activeTheme)!
                    return (
                      <motion.a
                        key={`cta-${activeTheme}`}
                        href={theme.demoUrl}
                        className="demo-cta"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                      >
                        {theme.demoLabel}
                        <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </motion.a>
                    )
                  })()}
                </AnimatePresence>
                {/* The real documentation is the repo README — /docs on this
                    site is the API-Docs *demo* (reachable via the Raycast
                    tab's own labeled pill), so linking it as "docs" would
                    mislead. */}
                <a
                  href="https://github.com/stevysmith/agentk#readme"
                  className="docs-link"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Read the README
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </a>
              </motion.div>
            </div>
          </div>

          {/* ─── Who has it ───
              Not a logo cloud: each row is a fact with a source, and the last
              one is the gap. Everything here comes from the spec's own
              implementation-status.md and Shopify's WebMCP docs — if it moves,
              those move first. */}
          <motion.section
            className="adoption"
            aria-label="WebMCP implementation status"
            initial={reduced ? false : { opacity: 0, y: 10 }}
            animate={mounted ? { opacity: 1, y: 0 } : {}}
            transition={rt(0.5, 0.65)}
          >
            <ul className="adoption-list" role="list">
              {ADOPTION.map((a) => (
                <li key={a.who} className="adoption-item">
                  <b>{a.who}</b>
                  <span>{a.what}</span>
                </li>
              ))}
            </ul>
            <p className="adoption-gap">Firefox and Safari: standards positions open</p>
          </motion.section>

          {/* ─── The same task, both ways ───
              The question the page never answered: why not just point a
              browser agent at the DOM? Tracks the active theme so it argues
              about the demo actually on screen. */}
          <motion.section
            className="actuation"
            initial={reduced ? false : { opacity: 0, y: 10 }}
            animate={mounted ? { opacity: 1, y: 0 } : {}}
            transition={rt(0.5, 0.7)}
          >
            <h2 className="section-title actuation-title">
              How an agent does <em>{ACTUATION[activeTheme].task}</em>
            </h2>
            <div className="actuation-cols">
              <div className="actuation-col" data-kind="pixels">
                <h3>By looking at the page</h3>
                <ol className="actuation-steps">
                  {ACTUATION[activeTheme].steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </div>
              <div className="actuation-col" data-kind="tools">
                <h3>By calling the tool</h3>
                <code className="actuation-call">{ACTUATION[activeTheme].call}</code>
                <p className="actuation-note">
                  One call, typed arguments, a result the agent can read. Chrome puts it plainly:
                  tools are &ldquo;more reliable than actuation, which may have numerous steps and
                  leaves each step open to interpretation by the agent.&rdquo;
                </p>
              </div>
            </div>
          </motion.section>

          {/* ─── For the person who was handed this ─── */}
          <motion.section
            className="evaluation"
            initial={reduced ? false : { opacity: 0, y: 10 }}
            animate={mounted ? { opacity: 1, y: 0 } : {}}
            transition={rt(0.5, 0.72)}
          >
            <h2 className="section-title">If you&rsquo;ve been asked to add WebMCP</h2>
            <ul className="evaluation-list" role="list">
              {EVALUATION.map((e) => (
                <li key={e.claim} className="evaluation-item">
                  <h3>{e.claim}</h3>
                  <p>{e.detail}</p>
                </li>
              ))}
            </ul>
          </motion.section>

          {/* ─── The honest routing table ─── */}
          <motion.section
            className="options"
            initial={reduced ? false : { opacity: 0, y: 10 }}
            animate={mounted ? { opacity: 1, y: 0 } : {}}
            transition={rt(0.5, 0.76)}
          >
            <h2 className="section-title">Which one you actually need</h2>
            <dl className="options-list">
              {OPTIONS.map((o) => (
                <div key={o.when} className="options-row" data-ours={'ours' in o && o.ours ? '' : undefined}>
                  <dt>{o.when}</dt>
                  <dd>{o.then}</dd>
                </div>
              ))}
            </dl>
          </motion.section>

          {/* ─── Footer ─── */}
          <motion.footer
            className="page-footer"
            initial={reduced ? false : { opacity: 0 }}
            animate={mounted ? { opacity: 1 } : {}}
            transition={rt(0.5, 0.6)}
          >
            Built by{' '}
            <a href="https://github.com/stevysmith" target="_blank" rel="noopener noreferrer">Steve Smith</a>
            {' '}&middot; Forked from{' '}
            <a href="https://cmdk.paco.me" target="_blank" rel="noopener noreferrer">cmdk</a>
            {' '}by{' '}
            <a href="https://paco.me" target="_blank" rel="noopener noreferrer">Paco Coursey</a>
          </motion.footer>
        </div>
      </div>

      {/* Touch only (CSS-gated on `pointer: coarse`): the way into the palette
          when there is no ⌘K to press. Tapping promotes the same demo palette
          to the bottom sheet the README documents. */}
      <div
        className="sheet-backdrop"
        data-open={sheetOpen ? '' : undefined}
        onClick={() => setSheetOpen(false)}
        aria-hidden="true"
      />
      <button
        type="button"
        className="sheet-trigger"
        onClick={() => setSheetOpen((open) => !open)}
        aria-expanded={sheetOpen}
      >
        {sheetOpen ? 'Close' : 'Ask or search\u2026'}
      </button>
    </>
  )
}
