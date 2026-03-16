'use client'

import { Command, type AgentKToolDef, type AgentKProvider } from 'agentk'

// ─────────────────────────────────────────────────────────
// Tools — hidden from UI, available to the agent
// ─────────────────────────────────────────────────────────

const shopTools: AgentKToolDef[] = [
  {
    name: 'search_products',
    label: 'Search Products',
    keywords: ['search', 'find'],
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Search query' } },
      required: ['query'],
    },
  },
  {
    name: 'filter_results',
    label: 'Filter Results',
    inputSchema: {
      type: 'object',
      properties: {
        category: { type: 'string' },
        maxPrice: { type: 'number' },
      },
    },
  },
  {
    name: 'get_recommendations',
    label: 'Get Recommendations',
    inputSchema: {
      type: 'object',
      properties: { based_on: { type: 'string' } },
    },
  },
  {
    name: 'add_to_cart',
    label: 'Add to Cart',
    inputSchema: {
      type: 'object',
      properties: {
        product_id: { type: 'string' },
        quantity: { type: 'number', default: 1 },
      },
      required: ['product_id'],
    },
  },
]

// ─────────────────────────────────────────────────────────
// Mock agent — always interprets as search
// ─────────────────────────────────────────────────────────

const mockShopAgent: AgentKProvider = async (prompt, _tools, _config, _signal) => {
  await new Promise((r) => setTimeout(r, 500))

  return {
    calls: [{ toolName: 'search_products', parameters: { query: prompt } }],
    summary: `Searching for "${prompt}"`,
  }
}

// ─────────────────────────────────────────────────────────
// Mock tool executor — returns products based on query
// ─────────────────────────────────────────────────────────

const handleToolExecute = async (toolName: string, params: Record<string, any>) => {
  if (toolName === 'search_products') {
    await new Promise((r) => setTimeout(r, 600))

    const q = (params.query || '').toLowerCase()

    if (q.includes('dress')) {
      return {
        products: [
          { name: 'Floral Midi Dress', price: '$89', description: 'Lightweight floral print, perfect for garden weddings' },
          { name: 'Satin Wrap Dress', price: '$124', description: 'Elegant satin with adjustable wrap tie' },
          { name: 'Lace A-Line Dress', price: '$156', description: 'Classic lace overlay with scalloped hem' },
        ],
      }
    }

    if (q.includes('shoe')) {
      return {
        products: [
          { name: 'Leather Block Heels', price: '$98', description: 'Comfortable 2-inch block heel in nude leather' },
          { name: 'Strappy Sandals', price: '$74', description: 'Minimalist strappy design, gold hardware' },
          { name: 'Suede Ankle Boots', price: '$145', description: 'Soft suede with side zip closure' },
        ],
      }
    }

    if (q.includes('jacket') || q.includes('coat')) {
      return {
        products: [
          { name: 'Wool Blend Overcoat', price: '$189', description: 'Double-breasted, fully lined wool blend' },
          { name: 'Quilted Puffer Jacket', price: '$134', description: 'Lightweight warmth with recycled fill' },
          { name: 'Leather Moto Jacket', price: '$210', description: 'Classic fit with asymmetric zip' },
        ],
      }
    }

    return {
      products: [
        { name: 'Cotton Crew Tee', price: '$34', description: 'Essential relaxed-fit cotton tee' },
        { name: 'High-Rise Wide Leg Pants', price: '$88', description: 'Tailored wide leg with pressed crease' },
        { name: 'Cashmere V-Neck Sweater', price: '$165', description: 'Ultra-soft cashmere in 12 colors' },
      ],
    }
  }

  // Other tools — generic success
  await new Promise((r) => setTimeout(r, 400))

  switch (toolName) {
    case 'filter_results':
      return { ok: true, message: `Filtered by ${params.category || 'all'}, max $${params.maxPrice || '∞'}` }
    case 'get_recommendations':
      return { ok: true, message: `Recommendations based on "${params.based_on}"` }
    case 'add_to_cart':
      return { ok: true, message: `Added ${params.quantity || 1} item(s) to cart` }
    default:
      return { ok: true, message: `${toolName} executed` }
  }
}

// ─────────────────────────────────────────────────────────
// Theme: Shop — pure agent-first NL interaction
// ─────────────────────────────────────────────────────────

export default function ShopTheme() {
  return (
    <div className="palette-container shop-theme">
      <Command
        label="Shop"
        tools={shopTools}
        onToolExecute={handleToolExecute}
        agent={{
          provider: 'custom',
          providerFn: mockShopAgent,
          requireApproval: false,
        }}
        shouldFilter={false}
      >
        <Command.Input autoFocus placeholder="What are you looking for?" />
        <Command.List>
          <Command.Empty>Type to search with AI...</Command.Empty>
          <Command.AgentHint />
        </Command.List>
        <Command.ToolResult />
        <Command.Approval />
      </Command>
    </div>
  )
}
