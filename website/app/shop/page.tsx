'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Command, useAgentK, type AgentKToolDef, type ToolExecution, type AgentKAgentConfig } from 'agentk'

// ─────────────────────────────────────────────────────────
// SVG Icons
// ─────────────────────────────────────────────────────────

const Icons = {
  search: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5L14 14" />
    </svg>
  ),
  sparkle: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 1v3M8 12v3M1 8h3M12 8h3M3.5 3.5l2 2M10.5 10.5l2 2M12.5 3.5l-2 2M5.5 10.5l-2 2" />
    </svg>
  ),
  bag: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 5h8l1 9H3L4 5z" />
      <path d="M6 5V3a2 2 0 014 0v2" />
    </svg>
  ),
  similar: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="1" width="6" height="6" rx="1" />
      <rect x="9" y="1" width="6" height="6" rx="1" />
      <rect x="1" y="9" width="6" height="6" rx="1" />
      <rect x="9" y="9" width="6" height="6" rx="1" />
    </svg>
  ),
  tag: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 8.5V2.5a1 1 0 011-1h6l6.5 6.5-7 7L1 8.5z" />
      <circle cx="5" cy="5" r="1" fill="currentColor" />
    </svg>
  ),
  eye: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5S1 8 1 8z" />
      <circle cx="8" cy="8" r="2" />
    </svg>
  ),
  x: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  ),
  heart: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 14s-5.5-3.5-6.5-7C.5 3.5 3 1 5.5 2.5L8 5l2.5-2.5C13 1 15.5 3.5 14.5 7 13.5 10.5 8 14 8 14z" />
    </svg>
  ),
}

// ─────────────────────────────────────────────────────────
// Product data model
// ─────────────────────────────────────────────────────────

type Product = {
  id: string
  name: string
  brand: string
  price: number
  originalPrice?: number
  rating: number
  reviewCount: number
  category: string
  colors: string[]
  sizes: string[]
  description: string
  occasion: string[]
  style: string[]
  gradient: string
  emoji: string
}

const PRODUCTS: Product[] = [
  { id: 'p1', name: 'Midnight Slip Dress', brand: 'Aura Studio', price: 185, rating: 4.8, reviewCount: 124, category: 'dresses', colors: ['black', 'navy'], sizes: ['XS', 'S', 'M', 'L'], description: 'Fluid satin slip dress with cowl neckline', occasion: ['date-night', 'wedding-guest'], style: ['minimalist', 'classic'], gradient: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)', emoji: '🖤' },
  { id: 'p2', name: 'Botanical Wrap Dress', brand: 'Lune Collective', price: 142, rating: 4.6, reviewCount: 89, category: 'dresses', colors: ['green', 'cream'], sizes: ['XS', 'S', 'M', 'L', 'XL'], description: 'Flowing wrap dress with botanical print', occasion: ['wedding-guest', 'casual'], style: ['boho'], gradient: 'linear-gradient(135deg, #2d5016 0%, #4a7c23 50%, #6b8e23 100%)', emoji: '🌿' },
  { id: 'p3', name: 'Cloud Maxi Dress', brand: 'Selene', price: 218, rating: 4.9, reviewCount: 203, category: 'dresses', colors: ['white', 'blush'], sizes: ['S', 'M', 'L'], description: 'Ethereal chiffon maxi with tiered skirt', occasion: ['wedding-guest'], style: ['classic', 'boho'], gradient: 'linear-gradient(135deg, #fce4ec 0%, #f8bbd0 50%, #f48fb1 100%)', emoji: '☁️' },
  { id: 'p4', name: 'Power Blazer Dress', brand: 'Vero', price: 265, rating: 4.7, reviewCount: 67, category: 'dresses', colors: ['black', 'camel'], sizes: ['XS', 'S', 'M', 'L'], description: 'Structured blazer-dress with gold buttons', occasion: ['work', 'date-night'], style: ['classic', 'minimalist'], gradient: 'linear-gradient(135deg, #1a1a1a 0%, #333333 50%, #4a4a4a 100%)', emoji: '🏛️' },
  { id: 'p5', name: 'Silk Camisole', brand: 'Aura Studio', price: 78, rating: 4.5, reviewCount: 156, category: 'tops', colors: ['champagne', 'black', 'ivory'], sizes: ['XS', 'S', 'M', 'L'], description: 'Pure silk cami with lace trim detail', occasion: ['date-night', 'casual'], style: ['minimalist'], gradient: 'linear-gradient(135deg, #d4a574 0%, #c9956c 50%, #b8860b 100%)', emoji: '✨' },
  { id: 'p6', name: 'Oversized Linen Shirt', brand: 'Noma', price: 95, rating: 4.4, reviewCount: 211, category: 'tops', colors: ['white', 'sky', 'sand'], sizes: ['S', 'M', 'L', 'XL'], description: 'Relaxed-fit linen button-up for effortless days', occasion: ['casual', 'weekend'], style: ['minimalist', 'boho'], gradient: 'linear-gradient(135deg, #e8e4e0 0%, #d4cfc9 50%, #bfb8ae 100%)', emoji: '🤍' },
  { id: 'p7', name: 'Cashmere Turtleneck', brand: 'Ciel', price: 195, rating: 4.8, reviewCount: 92, category: 'tops', colors: ['oat', 'charcoal', 'burgundy'], sizes: ['XS', 'S', 'M', 'L'], description: 'Lightweight cashmere with relaxed rolled neck', occasion: ['work', 'casual', 'weekend'], style: ['classic', 'minimalist'], gradient: 'linear-gradient(135deg, #8B7355 0%, #7B6348 50%, #6B533B 100%)', emoji: '🧶' },
  { id: 'p8', name: 'Cropped Knit Tank', brand: 'Lune Collective', price: 58, originalPrice: 82, rating: 4.3, reviewCount: 178, category: 'tops', colors: ['white', 'lavender', 'sage'], sizes: ['XS', 'S', 'M', 'L'], description: 'Ribbed cotton-blend cropped tank', occasion: ['casual', 'weekend'], style: ['trendy', 'athleisure'], gradient: 'linear-gradient(135deg, #e6e0f3 0%, #d4c8e8 50%, #b39ddb 100%)', emoji: '💜' },
  { id: 'p9', name: 'Sculptural Gold Cuff', brand: 'Vero', price: 128, rating: 4.7, reviewCount: 45, category: 'accessories', colors: ['gold'], sizes: ['one-size'], description: 'Hammered gold-plated brass statement cuff', occasion: ['date-night', 'wedding-guest', 'work'], style: ['classic', 'minimalist'], gradient: 'linear-gradient(135deg, #b8860b 0%, #daa520 50%, #ffd700 100%)', emoji: '💫' },
  { id: 'p10', name: 'Woven Leather Belt', brand: 'Noma', price: 68, originalPrice: 95, rating: 4.5, reviewCount: 134, category: 'accessories', colors: ['tan', 'black'], sizes: ['S', 'M', 'L'], description: 'Hand-woven Italian leather with brass buckle', occasion: ['work', 'casual'], style: ['classic'], gradient: 'linear-gradient(135deg, #8B4513 0%, #A0522D 50%, #CD853F 100%)', emoji: '🪢' },
  { id: 'p11', name: 'Oversized Sunglasses', brand: 'Selene', price: 145, rating: 4.6, reviewCount: 88, category: 'accessories', colors: ['tortoise', 'black'], sizes: ['one-size'], description: 'Acetate cat-eye frames with gradient lenses', occasion: ['casual', 'weekend'], style: ['trendy', 'classic'], gradient: 'linear-gradient(135deg, #4a2800 0%, #6b3a00 50%, #8B4513 100%)', emoji: '🕶️' },
  { id: 'p12', name: 'Pearl Drop Earrings', brand: 'Aura Studio', price: 88, originalPrice: 120, rating: 4.9, reviewCount: 201, category: 'accessories', colors: ['pearl', 'gold'], sizes: ['one-size'], description: 'Freshwater pearl drops on 14k gold vermeil', occasion: ['wedding-guest', 'date-night', 'work'], style: ['classic', 'minimalist'], gradient: 'linear-gradient(135deg, #f5f0e8 0%, #e8dfd4 50%, #daa520 100%)', emoji: '🦪' },
  { id: 'p13', name: 'Strappy Heeled Sandal', brand: 'Selene', price: 215, rating: 4.7, reviewCount: 76, category: 'shoes', colors: ['black', 'nude'], sizes: ['36', '37', '38', '39', '40', '41'], description: '90mm heel with minimal ankle strap', occasion: ['date-night', 'wedding-guest'], style: ['minimalist', 'classic'], gradient: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 50%, #404040 100%)', emoji: '👠' },
  { id: 'p14', name: 'Canvas Espadrille', brand: 'Noma', price: 72, rating: 4.3, reviewCount: 267, category: 'shoes', colors: ['natural', 'navy', 'red'], sizes: ['36', '37', '38', '39', '40', '41'], description: 'Classic jute-sole espadrille with cushioned insole', occasion: ['casual', 'weekend'], style: ['boho', 'classic'], gradient: 'linear-gradient(135deg, #d2b48c 0%, #c4a87c 50%, #b8956c 100%)', emoji: '🏖️' },
  { id: 'p15', name: 'Leather Ankle Boot', brand: 'Vero', price: 295, rating: 4.8, reviewCount: 112, category: 'shoes', colors: ['black', 'cognac'], sizes: ['36', '37', '38', '39', '40', '41'], description: 'Polished leather with stacked heel and side zip', occasion: ['work', 'date-night', 'casual'], style: ['classic', 'minimalist'], gradient: 'linear-gradient(135deg, #1c1c1c 0%, #2e2e2e 50%, #3d3d3d 100%)', emoji: '🥾' },
  { id: 'p16', name: 'Knit Sneaker', brand: 'Ciel', price: 118, originalPrice: 155, rating: 4.5, reviewCount: 189, category: 'shoes', colors: ['white', 'grey', 'blush'], sizes: ['36', '37', '38', '39', '40', '41'], description: 'Breathable flyknit upper on a cloud sole', occasion: ['casual', 'weekend'], style: ['athleisure', 'minimalist'], gradient: 'linear-gradient(135deg, #f0f0f0 0%, #e0e0e0 50%, #d0d0d0 100%)', emoji: '👟' },
  { id: 'p17', name: 'Quilted Mini Bag', brand: 'Aura Studio', price: 238, rating: 4.8, reviewCount: 93, category: 'bags', colors: ['black', 'ivory', 'sage'], sizes: ['one-size'], description: 'Diamond-quilted lambskin with chain strap', occasion: ['date-night', 'wedding-guest'], style: ['classic'], gradient: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 50%, #3a3a3a 100%)', emoji: '👜' },
  { id: 'p18', name: 'Woven Tote', brand: 'Noma', price: 165, rating: 4.6, reviewCount: 154, category: 'bags', colors: ['tan', 'black'], sizes: ['one-size'], description: 'Intrecciato-weave leather tote with suede lining', occasion: ['work', 'casual'], style: ['classic', 'minimalist'], gradient: 'linear-gradient(135deg, #a0826d 0%, #8B7355 50%, #7B6348 100%)', emoji: '🧳' },
  { id: 'p19', name: 'Canvas Crossbody', brand: 'Lune Collective', price: 48, originalPrice: 68, rating: 4.2, reviewCount: 312, category: 'bags', colors: ['olive', 'sand', 'black'], sizes: ['one-size'], description: 'Organic cotton canvas with adjustable strap', occasion: ['casual', 'weekend'], style: ['boho', 'athleisure'], gradient: 'linear-gradient(135deg, #556b2f 0%, #6b8e23 50%, #8fbc8f 100%)', emoji: '🌱' },
  { id: 'p20', name: 'Structured Clutch', brand: 'Ciel', price: 155, originalPrice: 195, rating: 4.7, reviewCount: 58, category: 'bags', colors: ['gold', 'silver', 'black'], sizes: ['one-size'], description: 'Geometric metal frame clutch with detachable chain', occasion: ['wedding-guest', 'date-night'], style: ['trendy', 'classic'], gradient: 'linear-gradient(135deg, #b8860b 0%, #c9a43e 50%, #daa520 100%)', emoji: '💎' },
]

const CATEGORIES = ['all', 'dresses', 'tops', 'accessories', 'shoes', 'bags'] as const
const PROMO_CODES: Record<string, { discount: number; label: string } | { freeShipping: true; label: string }> = {
  'WELCOME10': { discount: 10, label: '10% off' },
  'STYLE20': { discount: 20, label: '20% off' },
  'MAISON': { freeShipping: true, label: 'Free shipping' },
}

type CartItem = { product: Product; size: string }

// ─────────────────────────────────────────────────────────
// WebMCP tool definitions
// ─────────────────────────────────────────────────────────

const TOOLS: AgentKToolDef[] = [
  {
    name: 'search_products',
    label: 'Search Products',
    description: 'Semantic search across the collection',
    icon: Icons.search,
    keywords: ['search', 'find', 'look', 'show', 'filter', 'want', 'need', 'something'],
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Describe what you\'re looking for (e.g. "elegant dress for a summer wedding under $200")' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_styling_advice',
    label: 'Get Styling Advice',
    description: 'Curated outfit picks for an occasion',
    icon: Icons.sparkle,
    keywords: ['style', 'styling', 'outfit', 'advice', 'look', 'occasion', 'recommend', 'suggest'],
    inputSchema: {
      type: 'object',
      properties: {
        occasion: { type: 'string', description: 'Occasion', enum: ['wedding-guest', 'date-night', 'casual', 'work', 'weekend'] },
        budget: { type: 'number', description: 'Maximum budget', minimum: 50, maximum: 500 },
      },
      required: ['occasion', 'budget'],
    },
  },
  {
    name: 'add_to_bag',
    label: 'Add to Bag',
    description: 'Add a product to your shopping bag',
    icon: Icons.bag,
    keywords: ['add', 'bag', 'cart', 'buy', 'purchase'],
    inputSchema: {
      type: 'object',
      properties: {
        product: { type: 'string', description: 'Product name', enum: PRODUCTS.map((p) => p.name) },
        size: { type: 'string', description: 'Size', enum: ['XS', 'S', 'M', 'L', 'XL'] },
      },
      required: ['product', 'size'],
    },
  },
  {
    name: 'find_similar',
    label: 'Find Similar',
    description: 'Discover items similar to a product',
    icon: Icons.similar,
    keywords: ['similar', 'like', 'related', 'more', 'alternative'],
    inputSchema: {
      type: 'object',
      properties: {
        product: { type: 'string', description: 'Product name', enum: PRODUCTS.map((p) => p.name) },
      },
      required: ['product'],
    },
  },
  {
    name: 'apply_promo',
    label: 'Apply Promo Code',
    description: 'Apply a discount code',
    icon: Icons.tag,
    keywords: ['promo', 'discount', 'code', 'coupon', 'deal', 'sale'],
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'Promo code (e.g. WELCOME10, STYLE20, MAISON)' },
      },
      required: ['code'],
    },
  },
]

const QUICK_ACTIONS: AgentKToolDef[] = [
  { name: 'view_bag', label: 'View Bag', description: 'Open your shopping bag', icon: Icons.eye, keywords: ['view', 'bag', 'cart', 'open'] },
  { name: 'clear_filters', label: 'Clear Filters', description: 'Show all products', icon: Icons.x, keywords: ['clear', 'reset', 'all', 'remove'] },
]

// ─────────────────────────────────────────────────────────
// Rich result messages
// ─────────────────────────────────────────────────────────

const RESULT_MESSAGES: Record<string, (p: Record<string, any>) => string> = {
  search_products: (p) => `Found ${p._count ?? 0} products matching "${p.query}"`,
  get_styling_advice: (p) => `${p._count ?? 0} stylist picks for ${p.occasion} under $${p.budget}`,
  add_to_bag: (p) => `Added ${p.product} (${p.size}) to bag`,
  find_similar: (p) => `Found ${p._count ?? 0} items similar to ${p.product}`,
  apply_promo: (p) => p._error ? `Invalid code "${p.code}"` : `Applied ${p._label}`,
  view_bag: (p) => `${p._count} item${p._count !== 1 ? 's' : ''} in your bag`,
  clear_filters: () => 'Showing all products',
}

// ─────────────────────────────────────────────────────────
// Search scoring
// ─────────────────────────────────────────────────────────

function scoreProduct(product: Product, query: string): number {
  const q = query.toLowerCase()
  const words = q.split(/\s+/).filter(Boolean)
  let score = 0

  // Price constraints
  const underMatch = q.match(/under\s*\$?(\d+)/)
  if (underMatch && product.price > parseInt(underMatch[1])) return -1

  const overMatch = q.match(/over\s*\$?(\d+)/)
  if (overMatch && product.price < parseInt(overMatch[1])) return -1

  // "on sale"
  if ((q.includes('sale') || q.includes('deal') || q.includes('discount')) && product.originalPrice) score += 3
  if ((q.includes('sale') || q.includes('deal') || q.includes('discount')) && !product.originalPrice) score -= 2

  const searchable = [
    product.name,
    product.brand,
    product.category,
    product.description,
    ...product.colors,
    ...product.occasion,
    ...product.style,
  ].join(' ').toLowerCase()

  for (const word of words) {
    if (['under', 'over', 'for', 'a', 'the', 'and', 'or', 'in', 'with'].includes(word)) continue
    if (word.startsWith('$') || /^\d+$/.test(word)) continue
    if (searchable.includes(word)) score += 1
  }

  return score
}

function findSimilar(product: Product): Product[] {
  return PRODUCTS
    .filter((p) => p.id !== product.id)
    .map((p) => {
      let score = 0
      if (p.category === product.category) score += 3
      score += p.occasion.filter((o) => product.occasion.includes(o)).length
      score += p.style.filter((s) => product.style.includes(s)).length
      const priceDiff = Math.abs(p.price - product.price)
      if (priceDiff < 30) score += 2
      else if (priceDiff < 60) score += 1
      return { product: p, score }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((r) => r.product)
}

// ─────────────────────────────────────────────────────────
// Page component
// ─────────────────────────────────────────────────────────

export default function ShopPage() {
  const [open, setOpen] = useState(false)
  const [displayedProducts, setDisplayedProducts] = useState<Product[]>(PRODUCTS)
  const [cart, setCart] = useState<CartItem[]>([])
  const [cartOpen, setCartOpen] = useState(false)
  const [activeLabel, setActiveLabel] = useState<string | null>(null)
  const [stylistPickIds, setStylistPickIds] = useState<string[]>([])
  const [promoDiscount, setPromoDiscount] = useState<number | null>(null)
  const [promoLabel, setPromoLabel] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [wishlist, setWishlist] = useState<Set<string>>(new Set())
  const [bagPulse, setBagPulse] = useState(false)

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

  const doFlash = useCallback((key: string) => {
    setFlash(key)
    setTimeout(() => setFlash(null), 800)
  }, [])

  const handleCategoryFilter = useCallback((cat: string) => {
    setActiveCategory(cat)
    setStylistPickIds([])
    setActiveLabel(null)
    if (cat === 'all') {
      setDisplayedProducts(PRODUCTS)
    } else if (cat === 'under100') {
      setDisplayedProducts(PRODUCTS.filter((p) => p.price < 100))
      setActiveLabel('Under $100')
    } else if (cat === 'sale') {
      setDisplayedProducts(PRODUCTS.filter((p) => !!p.originalPrice))
      setActiveLabel('On Sale')
    } else {
      setDisplayedProducts(PRODUCTS.filter((p) => p.category === cat))
    }
  }, [])

  const toolCount = TOOLS.length + QUICK_ACTIONS.length

  const executeTool = useCallback(
    async (name: string, params: Record<string, any>) => {
      await new Promise((r) => setTimeout(r, 400 + Math.random() * 400))

      switch (name) {
        case 'search_products': {
          const q = (params.query || '').toLowerCase()
          const scored = PRODUCTS.map((p) => ({ product: p, score: scoreProduct(p, q) }))
            .filter((r) => r.score > 0)
            .sort((a, b) => b.score - a.score)
          const results = scored.map((r) => r.product)
          setDisplayedProducts(results)
          setActiveLabel(`"${params.query}"`)
          setActiveCategory('all')
          setStylistPickIds([])
          doFlash('grid')
          return { success: true, query: params.query, _count: results.length }
        }

        case 'get_styling_advice': {
          const occasion = params.occasion as string
          const budget = (params.budget as number) ?? 275
          const candidates = PRODUCTS
            .filter((p) => p.occasion.includes(occasion) && p.price <= budget)
          // Pick up to 4 across different categories
          const categories = [...new Set(candidates.map((p) => p.category))]
          const picks: Product[] = []
          for (const cat of categories) {
            const catItems = candidates.filter((p) => p.category === cat)
            if (catItems.length > 0 && picks.length < 4) {
              picks.push(catItems.sort((a, b) => b.rating - a.rating)[0])
            }
          }
          setDisplayedProducts(picks.length > 0 ? picks : candidates.slice(0, 4))
          setStylistPickIds(picks.map((p) => p.id))
          setActiveLabel(`Stylist picks for ${occasion}`)
          setActiveCategory('all')
          doFlash('grid')
          return { success: true, occasion, budget, _count: picks.length }
        }

        case 'add_to_bag': {
          const product = PRODUCTS.find((p) => p.name === params.product)
          if (!product) throw new Error(`Product not found: ${params.product}`)
          setCart((c) => [...c, { product, size: params.size }])
          setBagPulse(true)
          setTimeout(() => setBagPulse(false), 600)
          setCartOpen(true)
          setTimeout(() => setCartOpen(false), 3000)
          return { success: true, product: params.product, size: params.size }
        }

        case 'find_similar': {
          const product = PRODUCTS.find((p) => p.name === params.product)
          if (!product) throw new Error(`Product not found: ${params.product}`)
          const similar = findSimilar(product)
          setDisplayedProducts(similar)
          setActiveLabel(`Similar to ${product.name}`)
          setActiveCategory('all')
          setStylistPickIds([])
          doFlash('grid')
          return { success: true, product: params.product, _count: similar.length }
        }

        case 'apply_promo': {
          const code = (params.code || '').toUpperCase()
          const promo = PROMO_CODES[code]
          if (!promo) {
            return { success: false, code: params.code, _error: true }
          }
          if ('discount' in promo) {
            setPromoDiscount(promo.discount)
            setPromoLabel(promo.label)
          } else {
            setPromoDiscount(null)
            setPromoLabel(promo.label)
          }
          doFlash('grid')
          return { success: true, code, _label: promo.label }
        }

        case 'view_bag': {
          setCartOpen(true)
          return { success: true, _count: cart.length }
        }

        case 'clear_filters': {
          setDisplayedProducts(PRODUCTS)
          setActiveLabel(null)
          setStylistPickIds([])
          setActiveCategory('all')
          return { success: true }
        }

        default:
          throw new Error(`Unknown tool: ${name}`)
      }
    },
    [cart.length, doFlash],
  )

  const agentConfig: AgentKAgentConfig = {
    provider: 'anthropic',
    endpoint: '/api/agent',
    requireApproval: true,
  }

  // ── WebMCP registration ──
  const [webmcpActive, setWebmcpActive] = useState(false)
  const executeRef = useRef(executeTool)
  executeRef.current = executeTool

  useEffect(() => {
    const mc = (navigator as any).modelContext
    if (!mc) return

    setWebmcpActive(true)
    const allTools = [...TOOLS, ...QUICK_ACTIONS]

    for (const tool of allTools) {
      mc.registerTool({
        name: tool.name,
        description: tool.description,
        ...(tool.inputSchema ? { inputSchema: tool.inputSchema } : {}),
        execute: async (params: Record<string, any>) => {
          try {
            const result = await executeRef.current(tool.name, params)
            const msgFn = RESULT_MESSAGES[tool.name]
            const text = msgFn ? msgFn({ ...params, ...result }) : JSON.stringify(result)
            return { content: [{ type: 'text', text }] }
          } catch (err: any) {
            return { content: [{ type: 'text', text: `Error: ${err.message}` }] }
          }
        },
      })
    }

    return () => {
      for (const tool of allTools) {
        try { mc.unregisterTool(tool.name) } catch {}
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleModeChange = useCallback((mode: string) => {
    if (mode === 'result') setTimeout(() => setOpen(false), 2500)
  }, [])

  const cartTotal = cart.reduce((sum, item) => {
    const price = promoDiscount ? item.product.price * (1 - promoDiscount / 100) : item.product.price
    return sum + price
  }, 0)

  const toggleWishlist = useCallback((id: string) => {
    setWishlist((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  return (
    <div className="shop-page">
      {/* ── Header ── */}
      <header className="shop-header">
        <div className="shop-header-left">
          <span className="shop-logo">Maison</span>
          <nav className="shop-nav">
            <a className="shop-nav-link">New Arrivals</a>
            <a className="shop-nav-link">Sale</a>
            <a className="shop-nav-link">Collections</a>
          </nav>
        </div>
        <div className="shop-header-right">
          <span className={`docs-webmcp-badge ${webmcpActive ? '' : 'docs-webmcp-badge--inactive'}`}>
            <span className="docs-webmcp-dot" />
            {webmcpActive ? `WebMCP ${toolCount} tools` : `${toolCount} tools · WebMCP not detected`}
          </span>
          <button className="shop-bag-btn" onClick={() => setCartOpen(!cartOpen)}>
            {Icons.bag}
            {cart.length > 0 && (
              <span className={`shop-bag-count ${bagPulse ? 'shop-bag-count--pulse' : ''}`}>{cart.length}</span>
            )}
          </button>
          <button className="docs-trigger" onClick={() => setOpen(true)}>
            <span className="docs-trigger-text">Describe your style...</span>
            <kbd>⌘K</kbd>
          </button>
        </div>
      </header>

      {/* ── Filter pills ── */}
      <div className="shop-filters">
        <div className="shop-filter-pills">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              className={`shop-filter-pill ${activeCategory === cat ? 'shop-filter-pill--active' : ''}`}
              onClick={() => handleCategoryFilter(cat)}
            >
              {cat === 'all' ? 'All' : cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
          <button
            className={`shop-filter-pill ${activeCategory === 'under100' ? 'shop-filter-pill--active' : ''}`}
            onClick={() => handleCategoryFilter('under100')}
          >
            Under $100
          </button>
          <button
            className={`shop-filter-pill ${activeCategory === 'sale' ? 'shop-filter-pill--active' : ''}`}
            onClick={() => handleCategoryFilter('sale')}
          >
            On Sale
          </button>
        </div>
        {activeLabel && (
          <div className="shop-active-label">
            Results for: <strong>{activeLabel}</strong>
            <button className="shop-clear-label" onClick={() => {
              setDisplayedProducts(PRODUCTS)
              setActiveLabel(null)
              setStylistPickIds([])
              setActiveCategory('all')
            }}>Clear</button>
          </div>
        )}
      </div>

      {/* ── Product grid ── */}
      <main className="shop-grid" data-flash={flash === 'grid' ? '' : undefined}>
        {displayedProducts.map((product, i) => (
          <div
            key={product.id}
            className="shop-card"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div className="shop-card-image" style={{ background: product.gradient }}>
              <span className="shop-card-emoji">{product.emoji}</span>
              <button
                className={`shop-card-heart ${wishlist.has(product.id) ? 'shop-card-heart--active' : ''}`}
                onClick={() => toggleWishlist(product.id)}
              >
                {Icons.heart}
              </button>
              {product.originalPrice && (
                <span className="shop-card-sale-badge">Sale</span>
              )}
              {stylistPickIds.includes(product.id) && (
                <span className="shop-card-stylist-badge">Stylist Pick</span>
              )}
            </div>
            <div className="shop-card-body">
              <span className="shop-card-brand">{product.brand}</span>
              <h3 className="shop-card-name">{product.name}</h3>
              <p className="shop-card-desc">{product.description}</p>
              <div className="shop-card-footer">
                <div className="shop-card-price">
                  {promoDiscount ? (
                    <>
                      <span className="shop-card-price-original">${product.price}</span>
                      <span className="shop-card-price-discounted">${Math.round(product.price * (1 - promoDiscount / 100))}</span>
                    </>
                  ) : product.originalPrice ? (
                    <>
                      <span className="shop-card-price-original">${product.originalPrice}</span>
                      <span className="shop-card-price-current">${product.price}</span>
                    </>
                  ) : (
                    <span className="shop-card-price-current">${product.price}</span>
                  )}
                </div>
                <div className="shop-card-rating">
                  {'★'.repeat(Math.floor(product.rating))}
                  <span className="shop-card-review-count">({product.reviewCount})</span>
                </div>
              </div>
            </div>
          </div>
        ))}
        {displayedProducts.length === 0 && (
          <div className="shop-empty">No products match your search. Try different keywords or <button className="shop-empty-reset" onClick={() => { setDisplayedProducts(PRODUCTS); setActiveLabel(null); setActiveCategory('all') }}>view all</button>.</div>
        )}
      </main>

      {/* ── Cart drawer ── */}
      {cartOpen && (
        <div className="shop-cart-overlay" onClick={() => setCartOpen(false)}>
          <div className="shop-cart-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="shop-cart-header">
              <h2 className="shop-cart-title">Your Bag ({cart.length})</h2>
              <button className="shop-cart-close" onClick={() => setCartOpen(false)}>{Icons.x}</button>
            </div>
            <div className="shop-cart-items">
              {cart.length === 0 && <p className="shop-cart-empty">Your bag is empty</p>}
              {cart.map((item, i) => (
                <div key={i} className="shop-cart-item">
                  <div className="shop-cart-item-swatch" style={{ background: item.product.gradient }}>
                    <span style={{ fontSize: '20px' }}>{item.product.emoji}</span>
                  </div>
                  <div className="shop-cart-item-info">
                    <span className="shop-cart-item-name">{item.product.name}</span>
                    <span className="shop-cart-item-meta">{item.product.brand} · Size {item.size}</span>
                  </div>
                  <span className="shop-cart-item-price">
                    {promoDiscount
                      ? `$${Math.round(item.product.price * (1 - promoDiscount / 100))}`
                      : `$${item.product.price}`}
                  </span>
                </div>
              ))}
            </div>
            {cart.length > 0 && (
              <div className="shop-cart-footer">
                {promoLabel && <div className="shop-cart-promo">{promoLabel} applied</div>}
                <div className="shop-cart-total">
                  <span>Total</span>
                  <span>${Math.round(cartTotal)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Hint ── */}
      <p className="docs-hint">
        This store exposes <strong>{toolCount} WebMCP tools</strong>. Press <kbd>⌘</kbd><kbd>K</kbd> to shop smarter.
      </p>

      {/* ── Palette ── */}
      <Command.Dialog
        open={open}
        onOpenChange={setOpen}
        onToolExecute={executeTool}
        onModeChange={handleModeChange}
        tools={[...TOOLS, ...QUICK_ACTIONS]}
        agent={agentConfig}
        label="Maison Shopping"
      >
        <Command.Input placeholder="Describe your style..." />
        <ShopPaletteBody />
        <PaletteFooter />
      </Command.Dialog>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Palette body
// ─────────────────────────────────────────────────────────

function ShopPaletteBody() {
  const ak = useAgentK()
  const showList = ak.state.mode === 'browse'

  return (
    <>
      {showList && (
        <Command.List>
          <Command.Group heading="Shop Tools">
            {TOOLS.map((t) => (
              <Command.Tool key={t.name} tool={t} />
            ))}
          </Command.Group>
          <Command.Group heading="Quick Actions">
            {QUICK_ACTIONS.map((s) => (
              <Command.Tool key={s.name} tool={s} />
            ))}
          </Command.Group>
          <Command.Empty>No matching tools.</Command.Empty>
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
              <div data-agentk-result-icon="" data-error="">✗</div>
              <div data-agentk-result-message="">{execution.error}</div>
            </div>
          )
        }
        return (
          <div data-agentk-result-rich="">
            <div data-agentk-result-icon="">✓</div>
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
// Palette footer
// ─────────────────────────────────────────────────────────

function PaletteFooter() {
  const ak = useAgentK()

  return (
    <div className="palette-footer">
      <div className="palette-footer-keys">
        {ak.state.mode === 'browse' && !ak.agentHintVisible && (
          <>
            <span className="palette-footer-key"><kbd>↑↓</kbd> navigate</span>
            <span className="palette-footer-key"><kbd>↵</kbd> select</span>
            <span className="palette-footer-key"><kbd>esc</kbd> close</span>
          </>
        )}
        {ak.state.mode === 'browse' && ak.agentHintVisible && (
          <>
            <span className="palette-footer-key"><kbd>↵</kbd> ask agent</span>
            <span className="palette-footer-key"><kbd>esc</kbd> close</span>
          </>
        )}
        {ak.state.mode === 'form' && (
          <>
            <span className="palette-footer-key"><kbd>↵</kbd> execute</span>
            <span className="palette-footer-key"><kbd>esc</kbd> back</span>
          </>
        )}
        {ak.state.mode === 'planning' && (
          <span className="palette-footer-key"><kbd>esc</kbd> cancel</span>
        )}
        {ak.state.mode === 'executing' && (
          <span className="palette-footer-key"><kbd>esc</kbd> cancel</span>
        )}
        {ak.state.mode === 'approval' && (
          <>
            <span className="palette-footer-key"><kbd>↵</kbd> approve</span>
            <span className="palette-footer-key"><kbd>esc</kbd> reject</span>
          </>
        )}
        {ak.state.mode === 'result' && (
          <span className="palette-footer-key"><kbd>↵</kbd> dismiss</span>
        )}
      </div>
      <span className="palette-footer-brand">
        <span className="palette-footer-dot" />
        agentk
      </span>
    </div>
  )
}
