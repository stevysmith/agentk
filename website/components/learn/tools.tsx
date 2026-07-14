import type { AgentKToolDef } from 'agentk'

/* ─────────────────────────────────────────────────────────
 * /learn walkthrough — shared tool catalog + plan data
 *
 * Three devices, three tools. The same defs power:
 *   - the stage's tool-card visual (stage 1)
 *   - the live inline palette (stage 2)
 *   - real WebMCP registration with a `learn_` prefix (stage 3)
 *   - the scripted plan + approval flow (stages 4-5)
 * ───────────────────────────────────────────────────────── */

// ─── Icons (16x16, currentColor) ───

export const LearnIcons = {
  lightbulb: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 13h4M6.5 14.5h3M8 1a4.5 4.5 0 00-1.5 8.75V11h3V9.75A4.5 4.5 0 008 1z" />
    </svg>
  ),
  thermometer: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 10.17V3.5a1.5 1.5 0 00-3 0v6.67a3 3 0 103 0z" />
    </svg>
  ),
  music: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 13V4l7-2v9" />
      <circle cx="4" cy="13" r="2" />
      <circle cx="11" cy="11" r="2" />
    </svg>
  ),
}

// ─── WebMCP name prefix ───
// Single source for the `learn_` prefix: page.tsx registers tools with it
// and stage.tsx renders it (stage 3), so the displayed name can never
// drift from the name actually registered on the WebMCP surface.

export const WEBMCP_PREFIX = 'learn_'

// ─── Device ↔ tool accent colors (visual connection on the stage) ───

export const TOOL_ACCENTS: Record<string, string> = {
  set_lights: '#f59e0b', // amber — light
  set_thermostat: '#3b82f6', // blue — thermostat
  play_music: '#a78bfa', // violet — speaker
}

// ─── Tool catalog ───

export const LEARN_TOOLS: AgentKToolDef[] = [
  {
    name: 'set_lights',
    label: 'Set Lights',
    description: 'Set living room brightness (0 = off)',
    icon: LearnIcons.lightbulb,
    keywords: ['light', 'lamp', 'dim', 'bright', 'brightness'],
    inputSchema: {
      type: 'object',
      properties: {
        level: { type: 'number', description: 'Brightness (0-100)', minimum: 0, maximum: 100, default: 80 },
      },
      required: ['level'],
    },
  },
  {
    name: 'set_thermostat',
    label: 'Set Thermostat',
    description: 'Set the target temperature',
    icon: LearnIcons.thermometer,
    keywords: ['temperature', 'thermostat', 'heat', 'cool', 'degrees'],
    inputSchema: {
      type: 'object',
      properties: {
        temp: { type: 'number', description: 'Degrees Fahrenheit (60-85)', minimum: 60, maximum: 85, default: 72 },
      },
      required: ['temp'],
    },
  },
  {
    name: 'play_music',
    label: 'Play Music',
    description: 'Play a genre on the speaker, or stop',
    icon: LearnIcons.music,
    keywords: ['music', 'play', 'speaker', 'audio', 'song', 'stop'],
    inputSchema: {
      type: 'object',
      properties: {
        genre: { type: 'string', description: 'What to play', enum: ['ambient', 'jazz', 'lo-fi', 'off'] },
      },
      required: ['genre'],
    },
  },
]

// ─── Home state model ───

export type HomeState = {
  light: { on: boolean; level: number }
  thermostat: { temp: number }
  music: { playing: boolean; genre: string }
}

export const INITIAL_HOME: HomeState = {
  light: { on: true, level: 80 },
  thermostat: { temp: 72 },
  music: { playing: false, genre: '' },
}

// ─── Scripted plan (stages 4-5) ───
// This is keyword matching, NOT a live LLM — and the UI says so.

export type PlanCall = { toolName: string; parameters: Record<string, any>; note: string }

export const WALKTHROUGH_PROMPT = 'Movie night: dim the lights and play something moody'

const MOVIE_NIGHT_PLAN: PlanCall[] = [
  { toolName: 'set_lights', parameters: { level: 20 }, note: '"dim the lights"' },
  // Honest provenance: the keyword matcher has no temperature cue in the
  // prompt — this call comes from the "movie" preset, not inference. The note
  // must not imply the matcher reasoned about "cozy" warmth (it can't).
  { toolName: 'set_thermostat', parameters: { temp: 70 }, note: 'movie-night preset' },
  { toolName: 'play_music', parameters: { genre: 'ambient' }, note: '"something moody"' },
]

/** Scripted keyword matcher — the walkthrough's stand-in for an LLM planner. */
export function matchPlan(prompt: string): PlanCall[] {
  const q = prompt.toLowerCase()
  if (q.includes('movie') || q.includes('moody') || q.includes('film')) return MOVIE_NIGHT_PLAN
  return []
}

// ─── Schema summary helper (tool cards + agent's-eye panel) ───

export type ParamSummary = { key: string; type: string; detail: string; required: boolean }

export function summarizeSchema(schema: any): ParamSummary[] {
  if (!schema?.properties) return []
  const required: string[] = schema.required ?? []
  return Object.entries(schema.properties).map(([key, def]: [string, any]) => {
    let detail = ''
    if (def.enum) detail = def.enum.join(' | ')
    else if (def.type === 'number' && def.minimum !== undefined && def.maximum !== undefined) detail = `${def.minimum}–${def.maximum}`
    return { key, type: def.type ?? 'string', detail, required: required.includes(key) }
  })
}

/** Compact single-line call rendering, e.g. set_lights({ level: 20 }) */
export function formatCall(call: PlanCall): string {
  const args = Object.entries(call.parameters)
    .map(([k, v]) => `${k}: ${typeof v === 'string' ? `"${v}"` : v}`)
    .join(', ')
  return `${call.toolName}({ ${args} })`
}
