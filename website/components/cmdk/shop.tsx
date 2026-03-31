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

    // Return friendly strings — agentk renders these as <span> (not <pre>)
    if (q.includes('dress')) {
      return 'Found 3 dresses: Floral Midi Dress ($89), Satin Wrap Dress ($124), Lace A-Line Dress ($156)'
    }

    if (q.includes('shoe')) {
      return 'Found 3 shoes: Leather Block Heels ($98), Strappy Sandals ($74), Suede Ankle Boots ($145)'
    }

    if (q.includes('jacket') || q.includes('coat')) {
      return 'Found 3 outerwear: Wool Blend Overcoat ($189), Quilted Puffer Jacket ($134), Leather Moto Jacket ($210)'
    }

    return 'Found 3 items: Cotton Crew Tee ($34), High-Rise Wide Leg Pants ($88), Cashmere V-Neck Sweater ($165)'
  }

  await new Promise((r) => setTimeout(r, 400))

  switch (toolName) {
    case 'filter_results':
      return `Filtered by ${params.category || 'all'}, max $${params.maxPrice || '∞'}`
    case 'get_recommendations':
      return `Recommendations based on "${params.based_on}"`
    case 'add_to_cart':
      return `Added ${params.quantity || 1} item(s) to cart`
    default:
      return `${toolName} executed`
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
