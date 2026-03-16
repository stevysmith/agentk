'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Command, useAgentK, type AgentKToolDef, type ToolExecution, type AgentKAgentConfig } from 'agentk'

/* ─────────────────────────────────────────────────────────
 * Smart Home Demo — Multi-step Plans + Approval Flow
 *
 * Showcases agentk's killer feature: the AI agent plans
 * multiple tool calls and shows them for human approval
 * before executing. Type "movie night" or "morning routine"
 * to see a multi-step plan.
 * ───────────────────────────────────────────────────────── */

// ─────────────────────────────────────────────────────────
// SVG Icons
// ─────────────────────────────────────────────────────────

const Icons = {
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
  blinds: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="12" height="12" rx="1" />
      <path d="M2 5h12M2 8h12M2 11h12" />
    </svg>
  ),
  music: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 13V4l7-2v9" />
      <circle cx="4" cy="13" r="2" />
      <circle cx="11" cy="11" r="2" />
    </svg>
  ),
  scene: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 1v3M8 12v3M1 8h3M12 8h3M3.5 3.5l2 2M10.5 10.5l2 2M12.5 3.5l-2 2M5.5 10.5l-2 2" />
    </svg>
  ),
  volume: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3L4.5 6H2v4h2.5L8 13V3z" />
      <path d="M11 5.5a3.5 3.5 0 010 5" />
      <path d="M13 3.5a6.5 6.5 0 010 9" />
    </svg>
  ),
  color: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="6" />
      <circle cx="8" cy="5" r="1.5" fill="currentColor" />
      <circle cx="5.5" cy="9.5" r="1.5" fill="currentColor" />
      <circle cx="10.5" cy="9.5" r="1.5" fill="currentColor" />
    </svg>
  ),
  toggle: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="5" width="14" height="6" rx="3" />
      <circle cx="11" cy="8" r="2" fill="currentColor" />
    </svg>
  ),
}

// ─────────────────────────────────────────────────────────
// Smart Home State Model
// ─────────────────────────────────────────────────────────

type HomeState = {
  lights: { room: string; brightness: number; color: string; on: boolean }[]
  thermostat: { temp: number; mode: 'heat' | 'cool' | 'auto' | 'off' }
  blinds: { room: string; position: number }[]
  music: { playing: boolean; track: string; volume: number }
  scene: string | null
}

const LIGHT_COLORS: Record<string, string> = {
  'warm-white': '#fbbf24',
  'cool-white': '#e0e7ff',
  'soft-blue': '#60a5fa',
  'amber': '#f59e0b',
  'sunset': '#f97316',
}

const GENRE_TRACKS: Record<string, string> = {
  'ambient': 'Weightless - Marconi Union',
  'jazz': 'Take Five - Dave Brubeck',
  'classical': 'Clair de Lune - Debussy',
  'lo-fi': 'Coffee Shop Vibes - Lo-Fi Mix',
  'nature-sounds': 'Rain on Leaves',
}

const INITIAL_HOME: HomeState = {
  lights: [
    { room: 'living-room', brightness: 80, color: 'warm-white', on: true },
    { room: 'bedroom', brightness: 0, color: 'warm-white', on: false },
    { room: 'kitchen', brightness: 100, color: 'cool-white', on: true },
  ],
  thermostat: { temp: 72, mode: 'auto' },
  blinds: [
    { room: 'living-room', position: 100 },
    { room: 'bedroom', position: 100 },
    { room: 'kitchen', position: 100 },
  ],
  music: { playing: false, track: '', volume: 50 },
  scene: null,
}

const ROOMS = ['living-room', 'bedroom', 'kitchen'] as const
const ROOM_LABELS: Record<string, string> = {
  'living-room': 'Living Room',
  'bedroom': 'Bedroom',
  'kitchen': 'Kitchen',
}

// ─────────────────────────────────────────────────────────
// Tool Definitions
// ─────────────────────────────────────────────────────────

const TOOLS: AgentKToolDef[] = [
  {
    name: 'set_brightness',
    label: 'Set Brightness',
    description: 'Adjust light brightness in a room',
    icon: Icons.lightbulb,
    keywords: ['brightness', 'dim', 'bright', 'light', 'level'],
    inputSchema: {
      type: 'object',
      properties: {
        room: { type: 'string', description: 'Room', enum: [...ROOMS] },
        level: { type: 'number', description: 'Brightness level (0-100)', minimum: 0, maximum: 100 },
      },
      required: ['room', 'level'],
    },
  },
  {
    name: 'set_light_color',
    label: 'Set Light Color',
    description: 'Change light color in a room',
    icon: Icons.color,
    keywords: ['color', 'hue', 'warm', 'cool', 'blue', 'amber', 'sunset'],
    inputSchema: {
      type: 'object',
      properties: {
        room: { type: 'string', description: 'Room', enum: [...ROOMS] },
        color: { type: 'string', description: 'Light color', enum: ['warm-white', 'cool-white', 'soft-blue', 'amber', 'sunset'] },
      },
      required: ['room', 'color'],
    },
  },
  {
    name: 'toggle_light',
    label: 'Toggle Light',
    description: 'Turn a light on or off',
    icon: Icons.toggle,
    keywords: ['toggle', 'on', 'off', 'switch', 'light', 'turn'],
    inputSchema: {
      type: 'object',
      properties: {
        room: { type: 'string', description: 'Room', enum: [...ROOMS] },
        state: { type: 'string', description: 'On or off', enum: ['on', 'off'] },
      },
      required: ['room', 'state'],
    },
  },
  {
    name: 'set_thermostat',
    label: 'Set Thermostat',
    description: 'Adjust temperature and mode',
    icon: Icons.thermometer,
    keywords: ['temperature', 'thermostat', 'heat', 'cool', 'warm', 'cold', 'degrees'],
    inputSchema: {
      type: 'object',
      properties: {
        temperature: { type: 'number', description: 'Temperature (60-85 F)', minimum: 60, maximum: 85 },
        mode: { type: 'string', description: 'HVAC mode', enum: ['heat', 'cool', 'auto', 'off'] },
      },
      required: ['temperature', 'mode'],
    },
  },
  {
    name: 'set_blinds',
    label: 'Set Blinds',
    description: 'Adjust blind position in a room',
    icon: Icons.blinds,
    keywords: ['blinds', 'shades', 'curtains', 'open', 'close', 'window'],
    inputSchema: {
      type: 'object',
      properties: {
        room: { type: 'string', description: 'Room', enum: [...ROOMS] },
        position: { type: 'number', description: 'Position (0=closed, 100=open)', minimum: 0, maximum: 100 },
      },
      required: ['room', 'position'],
    },
  },
  {
    name: 'play_music',
    label: 'Play Music',
    description: 'Start playing music by genre',
    icon: Icons.music,
    keywords: ['music', 'play', 'song', 'audio', 'sound', 'ambient', 'jazz', 'classical'],
    inputSchema: {
      type: 'object',
      properties: {
        genre: { type: 'string', description: 'Music genre', enum: ['ambient', 'jazz', 'classical', 'lo-fi', 'nature-sounds'] },
      },
      required: ['genre'],
    },
  },
  {
    name: 'set_volume',
    label: 'Set Volume',
    description: 'Adjust music volume',
    icon: Icons.volume,
    keywords: ['volume', 'loud', 'quiet', 'mute', 'sound'],
    inputSchema: {
      type: 'object',
      properties: {
        level: { type: 'number', description: 'Volume level (0-100)', minimum: 0, maximum: 100 },
      },
      required: ['level'],
    },
  },
  {
    name: 'activate_scene',
    label: 'Activate Scene',
    description: 'Activate a preset scene',
    icon: Icons.scene,
    keywords: ['scene', 'mood', 'preset', 'movie', 'morning', 'dinner', 'focus', 'goodnight', 'night'],
    inputSchema: {
      type: 'object',
      properties: {
        scene: { type: 'string', description: 'Scene preset', enum: ['movie-night', 'morning-routine', 'dinner-party', 'focus-mode', 'goodnight'] },
      },
      required: ['scene'],
    },
  },
]

// ─────────────────────────────────────────────────────────
// Scene definitions (multi-step plans)
// ─────────────────────────────────────────────────────────

type ScenePlan = {
  summary: string
  calls: { toolName: string; parameters: Record<string, any>; reasoning?: string }[]
}

const SCENE_PLANS: Record<string, ScenePlan> = {
  'movie-night': {
    summary: 'Setting the mood for movie night \u2014 dimming lights, closing blinds, and starting ambient music.',
    calls: [
      { toolName: 'set_brightness', parameters: { room: 'living-room', level: 20 }, reasoning: 'Dim the living room for a cinematic atmosphere' },
      { toolName: 'set_light_color', parameters: { room: 'living-room', color: 'soft-blue' }, reasoning: 'Soft blue creates a theatre-like ambiance' },
      { toolName: 'set_blinds', parameters: { room: 'living-room', position: 0 }, reasoning: 'Block outside light for better viewing' },
      { toolName: 'play_music', parameters: { genre: 'ambient' }, reasoning: 'Gentle background audio' },
      { toolName: 'set_thermostat', parameters: { temperature: 70, mode: 'cool' }, reasoning: 'Comfortable viewing temperature' },
    ],
  },
  'morning-routine': {
    summary: 'Good morning! Brightening up the house and opening blinds to let the sunlight in.',
    calls: [
      { toolName: 'set_brightness', parameters: { room: 'bedroom', level: 100 }, reasoning: 'Full brightness to wake up' },
      { toolName: 'set_light_color', parameters: { room: 'bedroom', color: 'cool-white' }, reasoning: 'Cool white simulates natural daylight' },
      { toolName: 'toggle_light', parameters: { room: 'bedroom', state: 'on' }, reasoning: 'Ensure bedroom light is on' },
      { toolName: 'set_blinds', parameters: { room: 'bedroom', position: 100 }, reasoning: 'Let natural sunlight in' },
      { toolName: 'set_blinds', parameters: { room: 'kitchen', position: 100 }, reasoning: 'Open kitchen blinds for breakfast' },
      { toolName: 'set_thermostat', parameters: { temperature: 72, mode: 'auto' }, reasoning: 'Comfortable morning temperature' },
    ],
  },
  'dinner-party': {
    summary: 'Preparing for dinner guests \u2014 warm amber lighting, jazz music, and a comfortable temperature.',
    calls: [
      { toolName: 'set_brightness', parameters: { room: 'living-room', level: 60 }, reasoning: 'Warm, inviting brightness' },
      { toolName: 'set_light_color', parameters: { room: 'living-room', color: 'amber' }, reasoning: 'Amber creates a warm, elegant atmosphere' },
      { toolName: 'set_brightness', parameters: { room: 'kitchen', level: 80 }, reasoning: 'Keep kitchen well-lit for food prep' },
      { toolName: 'set_light_color', parameters: { room: 'kitchen', color: 'warm-white' }, reasoning: 'Warm kitchen lighting' },
      { toolName: 'play_music', parameters: { genre: 'jazz' }, reasoning: 'Sophisticated dinner soundtrack' },
      { toolName: 'set_thermostat', parameters: { temperature: 71, mode: 'auto' }, reasoning: 'Comfortable for guests' },
    ],
  },
  'focus-mode': {
    summary: 'Entering focus mode \u2014 bright cool lighting, blinds closed to reduce distractions, lo-fi beats.',
    calls: [
      { toolName: 'set_brightness', parameters: { room: 'living-room', level: 80 }, reasoning: 'Bright enough to stay alert' },
      { toolName: 'set_light_color', parameters: { room: 'living-room', color: 'cool-white' }, reasoning: 'Cool white promotes concentration' },
      { toolName: 'set_blinds', parameters: { room: 'living-room', position: 0 }, reasoning: 'Close blinds to reduce visual distractions' },
      { toolName: 'play_music', parameters: { genre: 'lo-fi' }, reasoning: 'Lo-fi beats for sustained focus' },
      { toolName: 'set_volume', parameters: { level: 30 }, reasoning: 'Low volume so music stays in the background' },
    ],
  },
  'goodnight': {
    summary: 'Goodnight! Turning off all lights, closing blinds, and lowering the thermostat.',
    calls: [
      { toolName: 'toggle_light', parameters: { room: 'living-room', state: 'off' }, reasoning: 'Turn off living room lights' },
      { toolName: 'toggle_light', parameters: { room: 'bedroom', state: 'off' }, reasoning: 'Turn off bedroom lights' },
      { toolName: 'toggle_light', parameters: { room: 'kitchen', state: 'off' }, reasoning: 'Turn off kitchen lights' },
      { toolName: 'set_blinds', parameters: { room: 'living-room', position: 0 }, reasoning: 'Close living room blinds' },
      { toolName: 'set_blinds', parameters: { room: 'bedroom', position: 0 }, reasoning: 'Close bedroom blinds' },
      { toolName: 'set_blinds', parameters: { room: 'kitchen', position: 0 }, reasoning: 'Close kitchen blinds' },
      { toolName: 'set_thermostat', parameters: { temperature: 68, mode: 'auto' }, reasoning: 'Lower temperature for better sleep' },
    ],
  },
}

// Map user queries to scene plans
function matchScene(query: string): ScenePlan | null {
  const q = query.toLowerCase()
  if (q.includes('movie') || q.includes('cinema') || q.includes('film') || q.includes('watch')) {
    return SCENE_PLANS['movie-night']
  }
  if (q.includes('morning') || q.includes('wake') || q.includes('sunrise') || q.includes('get up')) {
    return SCENE_PLANS['morning-routine']
  }
  if (q.includes('dinner') || q.includes('party') || q.includes('guests') || q.includes('entertain')) {
    return SCENE_PLANS['dinner-party']
  }
  if (q.includes('focus') || q.includes('work') || q.includes('study') || q.includes('concentrate')) {
    return SCENE_PLANS['focus-mode']
  }
  if (q.includes('goodnight') || q.includes('sleep') || q.includes('bed') || q.includes('night')) {
    return SCENE_PLANS['goodnight']
  }
  if (q.includes('mood') || q.includes('set the mood') || q.includes('cozy') || q.includes('relax')) {
    return SCENE_PLANS['movie-night']
  }
  return null
}

// Match single-tool queries
function matchSingleTool(query: string): ScenePlan | null {
  const q = query.toLowerCase()

  if (q.match(/dim|bright/i) && q.match(/living|lounge/i)) {
    const level = q.includes('dim') ? 30 : 100
    return {
      summary: `Setting living room brightness to ${level}%`,
      calls: [{ toolName: 'set_brightness', parameters: { room: 'living-room', level } }],
    }
  }
  if (q.match(/turn\s*(on|off)/i)) {
    const on = q.includes('on')
    const room = q.includes('bedroom') ? 'bedroom' : q.includes('kitchen') ? 'kitchen' : 'living-room'
    return {
      summary: `Turning ${on ? 'on' : 'off'} the ${ROOM_LABELS[room]} light`,
      calls: [{ toolName: 'toggle_light', parameters: { room, state: on ? 'on' : 'off' } }],
    }
  }
  if (q.match(/play\s+music|play\s+(jazz|ambient|classical|lo-fi|nature)/i)) {
    const genre = q.includes('jazz') ? 'jazz' : q.includes('classical') ? 'classical' : q.includes('lo-fi') || q.includes('lofi') ? 'lo-fi' : q.includes('nature') ? 'nature-sounds' : 'ambient'
    return {
      summary: `Playing ${genre} music`,
      calls: [{ toolName: 'play_music', parameters: { genre } }],
    }
  }
  if (q.match(/temperature|thermostat|degrees/i)) {
    const match = q.match(/(\d+)/)
    const temp = match ? Math.min(85, Math.max(60, parseInt(match[1]))) : 72
    return {
      summary: `Setting thermostat to ${temp}°F`,
      calls: [{ toolName: 'set_thermostat', parameters: { temperature: temp, mode: 'auto' } }],
    }
  }
  if (q.match(/close\s+(the\s+)?blinds/i)) {
    const room = q.includes('bedroom') ? 'bedroom' : q.includes('kitchen') ? 'kitchen' : 'living-room'
    return {
      summary: `Closing the ${ROOM_LABELS[room]} blinds`,
      calls: [{ toolName: 'set_blinds', parameters: { room, position: 0 } }],
    }
  }
  if (q.match(/open\s+(the\s+)?blinds/i)) {
    const room = q.includes('bedroom') ? 'bedroom' : q.includes('kitchen') ? 'kitchen' : 'living-room'
    return {
      summary: `Opening the ${ROOM_LABELS[room]} blinds`,
      calls: [{ toolName: 'set_blinds', parameters: { room, position: 100 } }],
    }
  }
  return null
}

// ─────────────────────────────────────────────────────────
// Result messages
// ─────────────────────────────────────────────────────────

const RESULT_MESSAGES: Record<string, (p: Record<string, any>) => string> = {
  set_brightness: (p) => `${ROOM_LABELS[p.room] || p.room} brightness set to ${p.level}%`,
  set_light_color: (p) => `${ROOM_LABELS[p.room] || p.room} color changed to ${p.color}`,
  toggle_light: (p) => `${ROOM_LABELS[p.room] || p.room} light turned ${p.state}`,
  set_thermostat: (p) => `Thermostat set to ${p.temperature}°F (${p.mode})`,
  set_blinds: (p) => `${ROOM_LABELS[p.room] || p.room} blinds set to ${p.position}%`,
  play_music: (p) => `Now playing: ${GENRE_TRACKS[p.genre] || p.genre}`,
  set_volume: (p) => `Volume set to ${p.level}%`,
  activate_scene: (p) => `Scene "${p.scene}" activated`,
}

// ─────────────────────────────────────────────────────────
// Activity feed entry type
// ─────────────────────────────────────────────────────────

type FeedEntry = {
  id: string
  timestamp: number
  message: string
  icon: string
}

// ─────────────────────────────────────────────────────────
// Page Component
// ─────────────────────────────────────────────────────────

export default function SmartHomePage() {
  const [open, setOpen] = useState(false)
  const [home, setHome] = useState<HomeState>(INITIAL_HOME)
  const [feed, setFeed] = useState<FeedEntry[]>([])
  const [animating, setAnimating] = useState<Set<string>>(new Set())
  const feedIdRef = useRef(0)

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

  const addFeedEntry = useCallback((message: string, icon: string) => {
    const id = `feed-${++feedIdRef.current}`
    setFeed((f) => [{ id, timestamp: Date.now(), message, icon }, ...f].slice(0, 20))
  }, [])

  const flashCard = useCallback((cardId: string) => {
    setAnimating((s) => new Set(s).add(cardId))
    setTimeout(() => {
      setAnimating((s) => {
        const next = new Set(s)
        next.delete(cardId)
        return next
      })
    }, 600)
  }, [])

  const executeTool = useCallback(
    async (name: string, params: Record<string, any>) => {
      await new Promise((r) => setTimeout(r, 300 + Math.random() * 300))

      switch (name) {
        case 'set_brightness': {
          setHome((h) => ({
            ...h,
            lights: h.lights.map((l) =>
              l.room === params.room ? { ...l, brightness: params.level, on: params.level > 0 } : l
            ),
          }))
          flashCard(`light-${params.room}`)
          addFeedEntry(`${ROOM_LABELS[params.room]} brightness \u2192 ${params.level}%`, '\u2600')
          return { success: true, ...params }
        }

        case 'set_light_color': {
          setHome((h) => ({
            ...h,
            lights: h.lights.map((l) =>
              l.room === params.room ? { ...l, color: params.color } : l
            ),
          }))
          flashCard(`light-${params.room}`)
          addFeedEntry(`${ROOM_LABELS[params.room]} color \u2192 ${params.color}`, '\u{1f3a8}')
          return { success: true, ...params }
        }

        case 'toggle_light': {
          const on = params.state === 'on'
          setHome((h) => ({
            ...h,
            lights: h.lights.map((l) =>
              l.room === params.room ? { ...l, on, brightness: on ? (l.brightness > 0 ? l.brightness : 80) : 0 } : l
            ),
          }))
          flashCard(`light-${params.room}`)
          addFeedEntry(`${ROOM_LABELS[params.room]} light ${on ? 'on' : 'off'}`, on ? '\u{1f4a1}' : '\u{1f319}')
          return { success: true, ...params }
        }

        case 'set_thermostat': {
          setHome((h) => ({
            ...h,
            thermostat: { temp: params.temperature, mode: params.mode },
          }))
          flashCard('thermostat')
          addFeedEntry(`Thermostat → ${params.temperature}°F (${params.mode})`, '\u{1f321}')
          return { success: true, ...params }
        }

        case 'set_blinds': {
          setHome((h) => ({
            ...h,
            blinds: h.blinds.map((b) =>
              b.room === params.room ? { ...b, position: params.position } : b
            ),
          }))
          flashCard(`blinds-${params.room}`)
          addFeedEntry(`${ROOM_LABELS[params.room]} blinds \u2192 ${params.position}%`, params.position > 0 ? '\u2600' : '\u{1f319}')
          return { success: true, ...params }
        }

        case 'play_music': {
          const track = GENRE_TRACKS[params.genre] || params.genre
          setHome((h) => ({
            ...h,
            music: { ...h.music, playing: true, track },
          }))
          flashCard('music')
          addFeedEntry(`Playing ${track}`, '\u{1f3b5}')
          return { success: true, ...params }
        }

        case 'set_volume': {
          setHome((h) => ({
            ...h,
            music: { ...h.music, volume: params.level },
          }))
          flashCard('music')
          addFeedEntry(`Volume \u2192 ${params.level}%`, '\u{1f50a}')
          return { success: true, ...params }
        }

        case 'activate_scene': {
          setHome((h) => ({ ...h, scene: params.scene }))
          flashCard('scene')
          addFeedEntry(`Scene activated: ${params.scene}`, '\u2728')
          return { success: true, ...params }
        }

        default:
          throw new Error(`Unknown tool: ${name}`)
      }
    },
    [flashCard, addFeedEntry],
  )

  // Custom provider that simulates LLM responses
  const providerFn = useCallback(
    async (prompt: string, _tools?: any, _config?: any, _signal?: AbortSignal) => {
      await new Promise((r) => setTimeout(r, 600 + Math.random() * 400))

      // Try scene match first
      const scenePlan = matchScene(prompt)
      if (scenePlan) return scenePlan

      // Try single-tool match
      const singlePlan = matchSingleTool(prompt)
      if (singlePlan) return singlePlan

      // Fallback
      return {
        summary: 'I can help you control your smart home. Try commands like "set the mood for movie night", "turn off the bedroom lights", or "play jazz music".',
        calls: [],
      }
    },
    [],
  )

  const agentConfig: AgentKAgentConfig = {
    provider: 'custom',
    providerFn,
    requireApproval: true,
  }

  const handleModeChange = useCallback((mode: string) => {
    if (mode === 'result') setTimeout(() => setOpen(false), 2500)
  }, [])

  // Compute status indicators
  const lightsOn = home.lights.filter((l) => l.on).length
  const avgBrightness = home.lights.reduce((sum, l) => sum + (l.on ? l.brightness : 0), 0) / home.lights.length

  return (
    <div className="sh-page">
      {/* Background grid effect */}
      <div className="sh-bg-grid" />

      {/* Header */}
      <header className="sh-header">
        <div className="sh-header-left">
          <span className="sh-logo">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 10l7-8 7 8-3 0 0 6-8 0 0-6-3 0z" />
            </svg>
            Smart Home
          </span>
          <div className="sh-status-dots">
            <span className="sh-status-dot" style={{ background: lightsOn > 0 ? '#22c55e' : '#666' }} title={`${lightsOn} lights on`} />
            <span className="sh-status-dot" style={{ background: home.music.playing ? '#3b82f6' : '#666' }} title={home.music.playing ? 'Music playing' : 'Music off'} />
            <span className="sh-status-dot" style={{ background: home.scene ? '#f59e0b' : '#666' }} title={home.scene ? `Scene: ${home.scene}` : 'No scene'} />
          </div>
        </div>
        <div className="sh-header-right">
          <span className="sh-temp-display">{home.thermostat.temp}°F</span>
          <button className="sh-trigger" onClick={() => setOpen(true)}>
            <span className="sh-trigger-text">Control your home...</span>
            <kbd>⌘K</kbd>
          </button>
        </div>
      </header>

      {/* Main grid */}
      <main className="sh-main">
        <div className="sh-grid">
          {/* Light cards */}
          {home.lights.map((light) => {
            const colorHex = LIGHT_COLORS[light.color] || '#fbbf24'
            const glowOpacity = light.on ? light.brightness / 200 : 0
            return (
              <div
                key={`light-${light.room}`}
                className={`sh-card ${animating.has(`light-${light.room}`) ? 'sh-card--flash' : ''}`}
                style={{ '--glow-color': colorHex, '--glow-opacity': glowOpacity } as React.CSSProperties}
              >
                <div className="sh-card-header">
                  <span className="sh-card-icon">{Icons.lightbulb}</span>
                  <span className="sh-card-title">{ROOM_LABELS[light.room]}</span>
                  <span className={`sh-card-status ${light.on ? 'sh-card-status--on' : ''}`}>
                    {light.on ? 'On' : 'Off'}
                  </span>
                </div>
                <div className="sh-card-body">
                  <div className="sh-brightness-row">
                    <span className="sh-brightness-label">Brightness</span>
                    <span className="sh-brightness-value">{light.on ? `${light.brightness}%` : '--'}</span>
                  </div>
                  <div className="sh-bar-track">
                    <div
                      className="sh-bar-fill"
                      style={{
                        width: `${light.on ? light.brightness : 0}%`,
                        background: light.on ? colorHex : '#333',
                      }}
                    />
                  </div>
                  <div className="sh-color-indicator">
                    <span className="sh-color-dot" style={{ background: light.on ? colorHex : '#333' }} />
                    <span className="sh-color-label">{light.color.replace('-', ' ')}</span>
                  </div>
                </div>
              </div>
            )
          })}

          {/* Thermostat card */}
          <div className={`sh-card sh-card--thermostat ${animating.has('thermostat') ? 'sh-card--flash' : ''}`}>
            <div className="sh-card-header">
              <span className="sh-card-icon">{Icons.thermometer}</span>
              <span className="sh-card-title">Thermostat</span>
              <span className={`sh-card-status ${home.thermostat.mode !== 'off' ? 'sh-card-status--on' : ''}`}>
                {home.thermostat.mode.charAt(0).toUpperCase() + home.thermostat.mode.slice(1)}
              </span>
            </div>
            <div className="sh-card-body">
              <div className="sh-temp-big">{home.thermostat.temp}°</div>
              <div className="sh-temp-bar-row">
                <span className="sh-temp-min">60°</span>
                <div className="sh-bar-track">
                  <div
                    className="sh-bar-fill"
                    style={{
                      width: `${((home.thermostat.temp - 60) / 25) * 100}%`,
                      background: home.thermostat.mode === 'heat' ? '#ef4444' : home.thermostat.mode === 'cool' ? '#3b82f6' : '#22c55e',
                    }}
                  />
                </div>
                <span className="sh-temp-max">85°</span>
              </div>
            </div>
          </div>

          {/* Blinds cards */}
          {home.blinds.map((blind) => (
            <div
              key={`blinds-${blind.room}`}
              className={`sh-card ${animating.has(`blinds-${blind.room}`) ? 'sh-card--flash' : ''}`}
            >
              <div className="sh-card-header">
                <span className="sh-card-icon">{Icons.blinds}</span>
                <span className="sh-card-title">{ROOM_LABELS[blind.room]} Blinds</span>
                <span className={`sh-card-status ${blind.position > 0 ? 'sh-card-status--on' : ''}`}>
                  {blind.position === 100 ? 'Open' : blind.position === 0 ? 'Closed' : `${blind.position}%`}
                </span>
              </div>
              <div className="sh-card-body">
                <div className="sh-blinds-visual">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="sh-blinds-slat"
                      style={{
                        transform: `scaleY(${1 - (blind.position / 100) * 0.7})`,
                        opacity: 1 - (blind.position / 100) * 0.6,
                      }}
                    />
                  ))}
                </div>
                <div className="sh-bar-track">
                  <div
                    className="sh-bar-fill"
                    style={{
                      width: `${blind.position}%`,
                      background: '#60a5fa',
                    }}
                  />
                </div>
              </div>
            </div>
          ))}

          {/* Music card */}
          <div className={`sh-card sh-card--music ${animating.has('music') ? 'sh-card--flash' : ''}`}>
            <div className="sh-card-header">
              <span className="sh-card-icon">{Icons.music}</span>
              <span className="sh-card-title">Music</span>
              <span className={`sh-card-status ${home.music.playing ? 'sh-card-status--on' : ''}`}>
                {home.music.playing ? 'Playing' : 'Stopped'}
              </span>
            </div>
            <div className="sh-card-body">
              {home.music.playing ? (
                <>
                  <div className="sh-music-track">{home.music.track}</div>
                  <div className="sh-music-eq">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <div key={i} className="sh-eq-bar" style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                  <div className="sh-brightness-row">
                    <span className="sh-brightness-label">Volume</span>
                    <span className="sh-brightness-value">{home.music.volume}%</span>
                  </div>
                  <div className="sh-bar-track">
                    <div
                      className="sh-bar-fill"
                      style={{ width: `${home.music.volume}%`, background: '#a78bfa' }}
                    />
                  </div>
                </>
              ) : (
                <div className="sh-music-idle">No music playing</div>
              )}
            </div>
          </div>

          {/* Scene card */}
          <div className={`sh-card sh-card--scene ${animating.has('scene') ? 'sh-card--flash' : ''}`}>
            <div className="sh-card-header">
              <span className="sh-card-icon">{Icons.scene}</span>
              <span className="sh-card-title">Active Scene</span>
            </div>
            <div className="sh-card-body">
              {home.scene ? (
                <div className="sh-scene-active">
                  <span className="sh-scene-dot" />
                  <span className="sh-scene-name">{home.scene.replace(/-/g, ' ')}</span>
                </div>
              ) : (
                <div className="sh-scene-idle">No scene active</div>
              )}
              <div className="sh-scene-presets">
                {['movie-night', 'morning-routine', 'dinner-party', 'focus-mode', 'goodnight'].map((s) => (
                  <span
                    key={s}
                    className={`sh-scene-chip ${home.scene === s ? 'sh-scene-chip--active' : ''}`}
                  >
                    {s.replace(/-/g, ' ')}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Activity feed */}
        {feed.length > 0 && (
          <div className="sh-feed">
            <span className="sh-feed-title">Activity</span>
            <div className="sh-feed-list">
              {feed.slice(0, 8).map((entry) => (
                <div key={entry.id} className="sh-feed-item">
                  <span className="sh-feed-icon">{entry.icon}</span>
                  <span className="sh-feed-msg">{entry.message}</span>
                  <span className="sh-feed-time">
                    {formatTime(entry.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Hint */}
      <p className="sh-hint">
        Press <kbd>⌘</kbd><kbd>K</kbd> to control your home with natural language. Try <strong>&quot;set the mood for movie night&quot;</strong>
      </p>

      {/* Command palette */}
      <Command.Dialog
        open={open}
        onOpenChange={setOpen}
        onToolExecute={executeTool}
        onModeChange={handleModeChange}
        tools={TOOLS}
        agent={agentConfig}
        label="Smart Home"
      >
        <Command.Input placeholder="What would you like to do? Try &quot;movie night&quot;..." />
        <SmartHomePaletteBody />
        <SmartHomePaletteFooter />
      </Command.Dialog>

      {/* Styles */}
      <style>{`
        /* ═══════════════════════════════════════════════════════
         * SMART HOME DEMO STYLES
         * ═══════════════════════════════════════════════════════ */

        .sh-page {
          min-height: 100dvh;
          background: #0a0a0a;
          position: relative;
          overflow-x: hidden;
        }

        .sh-bg-grid {
          position: fixed;
          inset: 0;
          background-image:
            radial-gradient(circle at 50% 0%, rgba(59,130,246,0.08) 0%, transparent 60%),
            linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px);
          background-size: 100% 100%, 40px 40px, 40px 40px;
          pointer-events: none;
          z-index: 0;
        }

        /* ─── Header ─── */

        .sh-header {
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

        .sh-header-left {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .sh-logo {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 15px;
          font-weight: 700;
          letter-spacing: -0.02em;
          color: var(--text);
        }

        .sh-status-dots {
          display: flex;
          gap: 6px;
          align-items: center;
        }

        .sh-status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          transition: background 300ms ease;
        }

        .sh-header-right {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .sh-temp-display {
          font-size: 13px;
          font-weight: 500;
          color: var(--text-2);
          font-variant-numeric: tabular-nums;
        }

        .sh-trigger {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 12px;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          color: var(--text-2);
          font-size: 13px;
          cursor: pointer;
          transition: border-color 150ms, color 150ms;
        }
        .sh-trigger:hover {
          border-color: var(--border-focus);
          color: var(--text);
        }
        .sh-trigger-text { pointer-events: none; }
        .sh-trigger kbd {
          font-family: var(--font);
          font-size: 11px;
          padding: 2px 6px;
          border-radius: 4px;
          background: rgba(255,255,255,0.06);
          border: 1px solid var(--border);
          color: var(--text-3);
        }

        /* ─── Main ─── */

        .sh-main {
          position: relative;
          z-index: 1;
          max-width: 1100px;
          margin: 0 auto;
          padding: 32px 24px;
        }

        .sh-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }

        @media (max-width: 900px) {
          .sh-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 600px) {
          .sh-grid {
            grid-template-columns: 1fr;
          }
        }

        /* ─── Cards ─── */

        .sh-card {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 16px;
          position: relative;
          overflow: hidden;
          transition: border-color 300ms ease, box-shadow 300ms ease;
        }

        .sh-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 60px;
          background: radial-gradient(
            ellipse at 50% -20px,
            color-mix(in srgb, var(--glow-color, transparent) calc(var(--glow-opacity, 0) * 100%), transparent),
            transparent
          );
          pointer-events: none;
          transition: opacity 500ms ease;
          opacity: var(--glow-opacity, 0);
        }

        .sh-card--flash {
          border-color: var(--accent);
          box-shadow: 0 0 20px rgba(59, 130, 246, 0.15);
        }

        .sh-card-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
        }

        .sh-card-icon {
          color: var(--text-3);
          display: flex;
          align-items: center;
        }

        .sh-card-title {
          font-size: 13px;
          font-weight: 600;
          color: var(--text);
          flex: 1;
        }

        .sh-card-status {
          font-size: 11px;
          font-weight: 500;
          padding: 2px 8px;
          border-radius: 20px;
          background: rgba(255,255,255,0.05);
          color: var(--text-3);
          transition: background 300ms ease, color 300ms ease;
        }

        .sh-card-status--on {
          background: rgba(34, 197, 94, 0.15);
          color: #22c55e;
        }

        .sh-card-body {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        /* Brightness / Volume rows */

        .sh-brightness-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .sh-brightness-label {
          font-size: 12px;
          color: var(--text-3);
        }

        .sh-brightness-value {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-2);
          font-variant-numeric: tabular-nums;
          transition: color 300ms ease;
        }

        /* Progress bars */

        .sh-bar-track {
          height: 6px;
          background: rgba(255,255,255,0.06);
          border-radius: 3px;
          overflow: hidden;
        }

        .sh-bar-fill {
          height: 100%;
          border-radius: 3px;
          transition: width 500ms cubic-bezier(0.4, 0, 0.2, 1), background 500ms ease;
          min-width: 0;
        }

        /* Color indicator */

        .sh-color-indicator {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 2px;
        }

        .sh-color-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          transition: background 400ms ease;
          box-shadow: 0 0 6px rgba(255,255,255,0.1);
        }

        .sh-color-label {
          font-size: 11px;
          color: var(--text-3);
          text-transform: capitalize;
        }

        /* Thermostat */

        .sh-temp-big {
          font-size: 36px;
          font-weight: 700;
          color: var(--text);
          text-align: center;
          font-variant-numeric: tabular-nums;
          line-height: 1;
          margin: 4px 0;
          transition: color 300ms ease;
        }

        .sh-temp-bar-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .sh-temp-min,
        .sh-temp-max {
          font-size: 10px;
          color: var(--text-3);
          font-variant-numeric: tabular-nums;
          flex-shrink: 0;
        }

        .sh-temp-bar-row .sh-bar-track {
          flex: 1;
        }

        /* Blinds */

        .sh-blinds-visual {
          display: flex;
          flex-direction: column;
          gap: 3px;
          padding: 4px 0;
          height: 40px;
          justify-content: space-between;
        }

        .sh-blinds-slat {
          height: 4px;
          background: rgba(255,255,255,0.12);
          border-radius: 2px;
          transition: transform 500ms cubic-bezier(0.4, 0, 0.2, 1), opacity 500ms ease;
        }

        /* Music */

        .sh-music-track {
          font-size: 13px;
          font-weight: 500;
          color: var(--text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .sh-music-eq {
          display: flex;
          gap: 3px;
          height: 20px;
          align-items: flex-end;
        }

        .sh-eq-bar {
          width: 4px;
          background: #a78bfa;
          border-radius: 2px;
          animation: eq-bounce 0.8s ease-in-out infinite alternate;
        }

        @keyframes eq-bounce {
          0%   { height: 4px; }
          100% { height: 18px; }
        }

        .sh-music-idle {
          font-size: 13px;
          color: var(--text-3);
          padding: 12px 0;
        }

        /* Scene */

        .sh-scene-active {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 4px;
        }

        .sh-scene-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #f59e0b;
          animation: scene-pulse 2s ease-in-out infinite;
        }

        @keyframes scene-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.4); }
          50% { box-shadow: 0 0 0 6px rgba(245, 158, 11, 0); }
        }

        .sh-scene-name {
          font-size: 14px;
          font-weight: 600;
          color: var(--text);
          text-transform: capitalize;
        }

        .sh-scene-idle {
          font-size: 13px;
          color: var(--text-3);
          padding: 4px 0;
        }

        .sh-scene-presets {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 4px;
        }

        .sh-scene-chip {
          font-size: 11px;
          padding: 3px 8px;
          border-radius: 20px;
          background: rgba(255,255,255,0.04);
          border: 1px solid var(--border);
          color: var(--text-3);
          text-transform: capitalize;
          transition: background 200ms, color 200ms, border-color 200ms;
        }

        .sh-scene-chip--active {
          background: rgba(245, 158, 11, 0.15);
          border-color: rgba(245, 158, 11, 0.3);
          color: #f59e0b;
        }

        /* ─── Activity Feed ─── */

        .sh-feed {
          margin-top: 24px;
          padding: 16px;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius);
        }

        .sh-feed-title {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-3);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          display: block;
          margin-bottom: 12px;
        }

        .sh-feed-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .sh-feed-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 0;
          border-bottom: 1px solid rgba(255,255,255,0.03);
          animation: feed-enter 300ms ease;
        }

        .sh-feed-item:last-child {
          border-bottom: none;
        }

        @keyframes feed-enter {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .sh-feed-icon {
          font-size: 14px;
          flex-shrink: 0;
          width: 20px;
          text-align: center;
        }

        .sh-feed-msg {
          font-size: 12px;
          color: var(--text-2);
          flex: 1;
        }

        .sh-feed-time {
          font-size: 11px;
          color: var(--text-3);
          font-variant-numeric: tabular-nums;
          flex-shrink: 0;
        }

        /* ─── Hint ─── */

        .sh-hint {
          position: fixed;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          font-size: 13px;
          color: var(--text-3);
          text-align: center;
          z-index: 10;
        }

        .sh-hint kbd {
          font-family: var(--font);
          font-size: 11px;
          padding: 2px 6px;
          border-radius: 4px;
          background: rgba(255,255,255,0.06);
          border: 1px solid var(--border);
          color: var(--text-3);
          margin: 0 1px;
        }

        .sh-hint strong {
          color: var(--text-2);
        }

        /* ─── Palette overrides for smart-home theme ─── */

        .sh-palette-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 12px;
          border-top: 1px solid var(--border);
          font-size: 12px;
        }

        .sh-palette-footer-keys {
          display: flex;
          gap: 12px;
        }

        .sh-palette-footer-key {
          color: var(--text-3);
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .sh-palette-footer-key kbd {
          font-family: var(--font);
          font-size: 11px;
          padding: 1px 4px;
          border-radius: 3px;
          background: rgba(255,255,255,0.06);
          border: 1px solid var(--border);
          color: var(--text-3);
        }

        .sh-palette-footer-brand {
          display: flex;
          align-items: center;
          gap: 6px;
          color: var(--text-3);
          font-size: 12px;
        }

        .sh-palette-footer-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--green);
          box-shadow: 0 0 4px rgba(34, 197, 94, 0.4);
        }
      `}</style>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Time formatter for activity feed
// ─────────────────────────────────────────────────────────

function formatTime(ts: number): string {
  const diff = Math.round((Date.now() - ts) / 1000)
  if (diff < 5) return 'just now'
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

// ─────────────────────────────────────────────────────────
// Palette Body
// ─────────────────────────────────────────────────────────

function SmartHomePaletteBody() {
  const ak = useAgentK()
  const showList = ak.state.mode === 'browse'

  return (
    <>
      {showList && (
        <Command.List>
          <Command.Group heading="Lights">
            {TOOLS.filter((t) => ['set_brightness', 'set_light_color', 'toggle_light'].includes(t.name)).map((t) => (
              <Command.Tool key={t.name} tool={t} />
            ))}
          </Command.Group>
          <Command.Group heading="Climate & Blinds">
            {TOOLS.filter((t) => ['set_thermostat', 'set_blinds'].includes(t.name)).map((t) => (
              <Command.Tool key={t.name} tool={t} />
            ))}
          </Command.Group>
          <Command.Group heading="Media">
            {TOOLS.filter((t) => ['play_music', 'set_volume'].includes(t.name)).map((t) => (
              <Command.Tool key={t.name} tool={t} />
            ))}
          </Command.Group>
          <Command.Group heading="Scenes">
            {TOOLS.filter((t) => t.name === 'activate_scene').map((t) => (
              <Command.Tool key={t.name} tool={t} />
            ))}
          </Command.Group>
          <Command.Empty>No matching tools. Try describing what you want.</Command.Empty>
        </Command.List>
      )}
      <Command.AgentHint />
      <Command.Approval />
      <Command.ToolForm />
      <Command.ToolResult renderResult={(execution: ToolExecution) => {
        const msgFn = RESULT_MESSAGES[execution.toolName]
        const message = msgFn ? msgFn({ ...execution.parameters, ...execution.result }) : JSON.stringify(execution.result, null, 2)
        if (execution.error) {
          return (
            <div data-agentk-result-rich="">
              <div data-agentk-result-icon="" data-error="">{'\u2717'}</div>
              <div data-agentk-result-message="">{execution.error}</div>
            </div>
          )
        }
        return (
          <div data-agentk-result-rich="">
            <div data-agentk-result-icon="">{'\u2713'}</div>
            <div data-agentk-result-message="">{message}</div>
            <div data-agentk-result-meta="">
              {execution.startedAt && `${((Date.now() - execution.startedAt) / 1000).toFixed(1)}s`}
            </div>
          </div>
        )
      }} />
      <Command.ActivityFeed />
    </>
  )
}

// ─────────────────────────────────────────────────────────
// Palette Footer
// ─────────────────────────────────────────────────────────

function SmartHomePaletteFooter() {
  const ak = useAgentK()

  return (
    <div className="sh-palette-footer">
      <div className="sh-palette-footer-keys">
        {ak.state.mode === 'browse' && !ak.agentHintVisible && (
          <>
            <span className="sh-palette-footer-key"><kbd>{'\u2191\u2193'}</kbd> navigate</span>
            <span className="sh-palette-footer-key"><kbd>{'\u21B5'}</kbd> select</span>
            <span className="sh-palette-footer-key"><kbd>esc</kbd> close</span>
          </>
        )}
        {ak.state.mode === 'browse' && ak.agentHintVisible && (
          <>
            <span className="sh-palette-footer-key"><kbd>{'\u21B5'}</kbd> ask agent</span>
            <span className="sh-palette-footer-key"><kbd>esc</kbd> close</span>
          </>
        )}
        {ak.state.mode === 'form' && (
          <>
            <span className="sh-palette-footer-key"><kbd>{'\u21B5'}</kbd> execute</span>
            <span className="sh-palette-footer-key"><kbd>esc</kbd> back</span>
          </>
        )}
        {ak.state.mode === 'planning' && (
          <span className="sh-palette-footer-key"><kbd>esc</kbd> cancel</span>
        )}
        {ak.state.mode === 'executing' && (
          <span className="sh-palette-footer-key"><kbd>esc</kbd> cancel</span>
        )}
        {ak.state.mode === 'approval' && (
          <>
            <span className="sh-palette-footer-key"><kbd>{'\u21B5'}</kbd> approve</span>
            <span className="sh-palette-footer-key"><kbd>esc</kbd> reject</span>
          </>
        )}
        {ak.state.mode === 'result' && (
          <span className="sh-palette-footer-key"><kbd>{'\u21B5'}</kbd> dismiss</span>
        )}
      </div>
      <span className="sh-palette-footer-brand">
        <span className="sh-palette-footer-dot" />
        agentk
      </span>
    </div>
  )
}
