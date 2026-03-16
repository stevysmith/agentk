'use client'

import { Command, type AgentKToolDef, type AgentKProvider } from 'agentk'

// ─────────────────────────────────────────────────────────
// Smart Home SVG icons (16x16, single-color, currentColor)
// ─────────────────────────────────────────────────────────

const SmartHomeIcons = {
  lightbulb: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.5 14h3M8 1.5a4.5 4.5 0 00-2.5 8.2V11.5h5V9.7A4.5 4.5 0 008 1.5z" />
      <path d="M5.5 13h5" />
    </svg>
  ),
  thermometer: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 1.5v8.764a2.5 2.5 0 10.001 0V1.5a1.5 1.5 0 00-3 0v8.764a2.5 2.5 0 102.999 0" />
      <path d="M8 11.5v-5" />
    </svg>
  ),
  window: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="12" height="12" rx="1.5" />
      <line x1="8" y1="2" x2="8" y2="14" />
      <line x1="2" y1="8" x2="14" y2="8" />
    </svg>
  ),
  music: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="4.5" cy="12" r="2" />
      <circle cx="12.5" cy="10" r="2" />
      <path d="M6.5 12V3.5l8-2v8.5" />
    </svg>
  ),
  sparkle: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 1l1.5 4.5L14 7l-4.5 1.5L8 13l-1.5-4.5L2 7l4.5-1.5L8 1z" />
    </svg>
  ),
}

// ─────────────────────────────────────────────────────────
// Smart Home tools
// ─────────────────────────────────────────────────────────

const smartHomeTools: AgentKToolDef[] = [
  {
    name: 'set_brightness',
    label: 'Adjust Lights',
    description: 'Lighting',
    icon: SmartHomeIcons.lightbulb,
    keywords: ['light', 'dim', 'bright', 'lamp'],
    inputSchema: {
      type: 'object',
      properties: {
        room: { type: 'string', description: 'Room', enum: ['Living Room', 'Bedroom', 'Kitchen', 'All Rooms'] },
        level: { type: 'number', description: 'Brightness', minimum: 0, maximum: 100, default: 50 },
      },
      required: ['level'],
    },
  },
  {
    name: 'set_temperature',
    label: 'Set Temperature',
    description: 'Climate',
    icon: SmartHomeIcons.thermometer,
    keywords: ['temp', 'heat', 'cool', 'thermostat'],
    inputSchema: {
      type: 'object',
      properties: {
        temp: { type: 'number', description: 'Degrees Fahrenheit', minimum: 60, maximum: 85, default: 72 },
        mode: { type: 'string', description: 'Mode', enum: ['Auto', 'Heat', 'Cool', 'Fan'] },
      },
      required: ['temp'],
    },
  },
  {
    name: 'close_blinds',
    label: 'Close Blinds',
    description: 'Blinds',
    icon: SmartHomeIcons.window,
    keywords: ['blinds', 'shades', 'curtains', 'window'],
    inputSchema: {
      type: 'object',
      properties: {
        room: { type: 'string', description: 'Room', enum: ['Living Room', 'Bedroom', 'Kitchen', 'All Rooms'] },
      },
    },
  },
  {
    name: 'play_media',
    label: 'Play Media',
    description: 'Entertainment',
    icon: SmartHomeIcons.music,
    keywords: ['music', 'play', 'media', 'speaker', 'audio'],
    inputSchema: {
      type: 'object',
      properties: {
        source: { type: 'string', description: 'What to play', enum: ['Morning Playlist', 'Ambient', 'Party Mix', 'Jazz', 'Lo-fi'] },
        speaker: { type: 'string', description: 'Speaker', enum: ['Living Room', 'Bedroom', 'Everywhere'] },
      },
    },
  },
  {
    name: 'set_scene',
    label: 'Set Scene',
    description: 'Scenes',
    icon: SmartHomeIcons.sparkle,
    keywords: ['scene', 'mood', 'preset', 'routine'],
    inputSchema: {
      type: 'object',
      properties: {
        scene: { type: 'string', description: 'Scene', enum: ['Movie Night', 'Morning', 'Party', 'Bedtime', 'Focus'] },
      },
      required: ['scene'],
    },
  },
]

// ─────────────────────────────────────────────────────────
// Mock agent provider (keyword matching, 500ms think delay)
// ─────────────────────────────────────────────────────────

const mockSmartHomeAgent: AgentKProvider = async (prompt) => {
  await new Promise((r) => setTimeout(r, 500))

  const q = prompt.toLowerCase()

  if (q.includes('movie') || q.includes('film')) {
    return {
      calls: [
        { toolName: 'set_brightness', parameters: { level: 20 } },
        { toolName: 'close_blinds', parameters: { room: 'living room' } },
        { toolName: 'play_media', parameters: { source: 'ambient' } },
      ],
      summary: 'Setting the mood for movie night: dimming lights, closing blinds, and playing ambient music.',
    }
  }

  if (q.includes('morning') || q.includes('wake')) {
    return {
      calls: [
        { toolName: 'set_brightness', parameters: { level: 80 } },
        { toolName: 'set_temperature', parameters: { temp: 72 } },
        { toolName: 'play_media', parameters: { source: 'morning playlist' } },
      ],
      summary: 'Good morning! Brightening lights, warming up, and playing your morning playlist.',
    }
  }

  if (q.includes('sleep') || q.includes('night') || q.includes('bed')) {
    return {
      calls: [
        { toolName: 'set_brightness', parameters: { level: 0 } },
        { toolName: 'set_temperature', parameters: { temp: 68 } },
      ],
      summary: 'Goodnight! Turning off lights and setting a comfortable sleeping temperature.',
    }
  }

  if (q.includes('party')) {
    return {
      calls: [
        { toolName: 'set_scene', parameters: { scene: 'party' } },
        { toolName: 'set_brightness', parameters: { level: 90 } },
        { toolName: 'play_media', parameters: { source: 'party mix' } },
      ],
      summary: 'Party mode activated! Setting scene, cranking lights, and playing the party mix.',
    }
  }

  // Default: set a generic scene
  return {
    calls: [{ toolName: 'set_scene', parameters: { scene: prompt.trim() } }],
    summary: `Setting scene based on your request.`,
  }
}

// ─────────────────────────────────────────────────────────
// Mock tool executor (400ms delay per tool, meaningful results)
// ─────────────────────────────────────────────────────────

const handleToolExecute = async (toolName: string, params: Record<string, any>) => {
  await new Promise((r) => setTimeout(r, 400))

  switch (toolName) {
    case 'set_brightness':
      return { message: `Lights set to ${params.level}%` }
    case 'set_temperature':
      return { message: `Temperature set to ${params.temp}\u00B0F` }
    case 'close_blinds':
      return { message: `Blinds closed in ${params.room || 'all rooms'}` }
    case 'play_media':
      return { message: `Now playing: ${params.source || 'default playlist'}` }
    case 'set_scene':
      return { message: `Scene "${params.scene}" activated` }
    default:
      return { message: `${toolName} executed` }
  }
}

// ─────────────────────────────────────────────────────────
// Theme: Smart Home (autonomous agent, no approval gate)
// ─────────────────────────────────────────────────────────

export default function SmartHomeTheme() {
  return (
    <div className="palette-container smarthome-theme">
      <Command
        label="Smart Home"
        tools={smartHomeTools}
        onToolExecute={handleToolExecute}
        agent={{
          provider: 'custom',
          providerFn: mockSmartHomeAgent,
          requireApproval: false,
        }}
      >
        <Command.Input autoFocus placeholder="What would you like to do?" />
        <Command.List>
          <Command.Empty>No devices found.</Command.Empty>
          <Command.AgentHint />
          {smartHomeTools.map((t) => (
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
