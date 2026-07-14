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
// Demo hint with dynamic arrow positioning
// ─────────────────────────────────────────────────────────

function DemoHint({ text, onClickHint }: { text: string; onClickHint: () => void }) {
  const hintRef = useRef<HTMLDivElement>(null)
  const [offset, setOffset] = useState({ x: 0, y: 0 })

  useEffect(() => {
    const measure = () => {
      const palette = document.querySelector('.palette-container')
      const input = palette?.querySelector('[cmdk-input]')
      const demoArea = document.querySelector('.demo-area')
      if (!palette || !input || !demoArea) return

      const paletteRect = palette.getBoundingClientRect()
      const inputRect = input.getBoundingClientRect()
      const demoRect = demoArea.getBoundingClientRect()

      setOffset({
        x: paletteRect.right - demoRect.left + 20,
        y: inputRect.top - demoRect.top + inputRect.height / 2,
      })
    }
    measure()
    const t = setTimeout(measure, 200)
    return () => clearTimeout(t)
  }, [text])

  return (
    <motion.div
      ref={hintRef}
      className="demo-hint"
      style={{ left: offset.x, top: offset.y - 25 }}
      initial={{ opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -8 }}
      transition={{ duration: 0.25, delay: 0.15 }}
      onClick={onClickHint}
    >
      <svg className="demo-hint-arrow" width="50" height="50" viewBox="0 0 50 50" fill="none">
        <path d="M46 48 C 38 36, 26 28, 16 22 C 10 18, 6 16, 4 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" strokeDasharray="3 3" />
        <path d="M4 18 L2 13 L7 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
      <span className="demo-hint-text">{text}</span>
    </motion.div>
  )
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

const THEME_COMPONENTS: Record<ThemeId, React.FC> = {
  raycast: RaycastTheme,
  linear: LinearTheme,
  smarthome: SmartHomeTheme,
  devops: DevOpsTheme,
  shop: ShopTheme,
}

// ─────────────────────────────────────────────────────────
// Code snippets per theme
// ─────────────────────────────────────────────────────────

const THEME_CODE: Record<ThemeId, { code: string; highlights: Record<string, 'kw' | 'fn' | 'str' | 'attr' | 'tag' | 'comment'> }> = {
  raycast: {
    code: `const tools = [
  {
    name: 'clipboard_history',
    label: 'Clipboard History',
    inputSchema: {
      type: 'object',
      properties: {
        filter: { type: 'string', enum: ['All', 'Text', 'Images'] },
        limit: { type: 'number', minimum: 1, maximum: 50 },
      },
    },
  },
]

<Command tools={tools} onToolExecute={exec}>
  <Command.Input />
  <Command.List />
  <Command.ToolForm />
  <Command.ToolResult />
</Command>`,
    highlights: {},
  },
  linear: {
    code: `const tools = [
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
    code: `const tools = [
  { name: 'set_brightness', label: 'Adjust Lights' },
  { name: 'set_temperature', label: 'Set Temperature' },
  { name: 'play_media', label: 'Play Media' },
]

// requireApproval: false — agent executes immediately
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
    code: `const tools = [
  { name: 'run_tests', label: 'Run Tests' },
  { name: 'build', label: 'Build' },
  {
    name: 'deploy',
    inputSchema: {
      type: 'object',
      properties: {
        environment: { type: 'string', enum: ['staging', 'production'] },
        branch: { type: 'string' },
      },
    },
  },
]

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
    code: `const tools = [
  { name: 'search_products', label: 'Search' },
  { name: 'get_recommendations', label: 'Recommend' },
]

// No <Command.Tool> rendered — pure agent-first UI
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
  const [dark, setDark] = useState(false)
  const [codeCopied, setCodeCopied] = useState(false)
  const [showArrowHint, setShowArrowHint] = useState(false)
  const hasClickedTab = useRef(false)
  const themeTabsRef = useRef<HTMLDivElement>(null)

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
      : "WebMCP is a Chrome origin trial, so this browser doesn't expose it. agentk degrades to a plain command palette — nothing breaks."
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
      // auto-focused palette search) has no caret to move, so the theme
      // shortcut still works from the default resting state.
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

  // Focus the active theme's command input
  useEffect(() => {
    // Try immediately, then retry after animation completes
    const tryFocus = () => {
      const input = document.querySelector('.palette-container [cmdk-input]') as HTMLInputElement
      if (input) { input.focus(); return true }
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
  const reduced = !!useReducedMotion()
  // Reduced motion: keep the entrance choreography's timing structure but
  // collapse each transition to 0s so nothing translates or fades in.
  const rt = (duration: number, delay: number) =>
    reduced ? { duration: 0, delay: 0, ease } : { duration, delay, ease }

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
          {/* ─── Header ─── */}
          <motion.header
            className="header"
            initial={reduced ? false : { opacity: 0, y: 16 }}
            animate={mounted ? { opacity: 1, y: 0 } : {}}
            transition={rt(0.6, 0.1)}
          >
            <div className="header-left">
              <div className="title-row">
                <h1 className="page-title">agentk</h1>
                <span className="version-badge">v0.4.1</span>
              </div>
              <p className="tagline">The command palette for the agentic web.</p>
              <p className="tagline-sub">Define your app&rsquo;s capabilities once as JSON&nbsp;Schema tools. The same catalog gives people a command palette and AI agents a WebMCP surface &mdash; one definition, two consumers.</p>
              <p className="hero-honesty">
                WebMCP is a Chrome origin trial, not a shipped standard &mdash; so I built agentk to feature-detect and fall back to a plain palette wherever it&rsquo;s missing. Nothing breaks.
              </p>
              <a href="/learn" className="hero-learn-link">
                Learn WebMCP interactively &mdash; a 2-minute walkthrough
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </a>
            </div>
            <div className="header-right">
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
          </motion.header>

          {/* ─── Inline Demo ─── */}
          <motion.div
            className="demo-area"
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
                <ActiveThemeComponent />
              </motion.div>
            </AnimatePresence>
            {THEMES.find(t => t.id === activeTheme)!.hint && <DemoHint
              key={`hint-${activeTheme}`}
              text={THEMES.find(t => t.id === activeTheme)!.hint}
              onClickHint={() => {
                const input = document.querySelector('.palette-container [cmdk-input]') as HTMLInputElement
                if (input) {
                  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
                  nativeInputValueSetter?.call(input, THEMES.find(t => t.id === activeTheme)!.hint)
                  input.dispatchEvent(new Event('input', { bubbles: true }))
                  input.focus()
                }
              }}
            />}
          </motion.div>

          {/* ─── Theme Switcher ─── */}
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

          {/* ─── Full-demo CTA ─── */}
          <motion.div
            className="demo-cta-row"
            initial={reduced ? false : { opacity: 0, y: 8 }}
            animate={mounted ? { opacity: 1, y: 0 } : {}}
            transition={rt(0.5, 0.45)}
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
                    {theme.demoLabel.replace('Try the', 'Try the full')}
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </motion.a>
                )
              })()}
            </AnimatePresence>
          </motion.div>

          {/* ─── Code snippet ─── */}
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
            <AnimatePresence mode="wait">
              {(() => {
                const theme = THEMES.find(t => t.id === activeTheme)!
                return (
                  <motion.a
                    key={`demo-${activeTheme}`}
                    href={theme.demoUrl}
                    className="tab-demo-link"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    {theme.demoLabel}
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </motion.a>
                )
              })()}
            </AnimatePresence>
          </motion.div>

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
    </>
  )
}
