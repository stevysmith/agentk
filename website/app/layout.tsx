import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL('https://agentk.stacktr.ee'),
  title: 'agentk — the command palette for the agentic web',
  description:
    'A React component: define your capabilities once as JSON Schema tools. People get a command palette; AI agents get a WebMCP endpoint — one definition, two ways in.',
  openGraph: {
    title: 'agentk — the command palette for the agentic web',
    description:
      'Define your capabilities once as JSON Schema tools. People get a command palette; AI agents get a WebMCP endpoint.',
    url: 'https://agentk.stacktr.ee',
    siteName: 'agentk',
    locale: 'en_US',
    type: 'website',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'agentk — the command palette for the agentic web. A palette UI with per-tool colors and the line: one catalog, humans get the palette, agents get WebMCP.',
        type: 'image/png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'agentk — the command palette for the agentic web',
    description:
      'Define your capabilities once as JSON Schema tools. People get a command palette; AI agents get a WebMCP endpoint.',
    images: ['/og-image.png'],
  },
  other: {
    'theme-color': '#0a0a0a',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Caveat:wght@400;500&display=swap" rel="stylesheet" />
        {/* WebMCP origin trial (stacktr.ee, subdomain-matching) so Chrome
            enables document.modelContext on agentk.stacktr.ee and agents can
            call the demo tools. Renew before 2026-11-17. Renewal checklist:
            (1) this <meta> token, (2) the Origin-Trial header token in
            next.config.mjs, (3) the /learn stage-3 copy — app/learn/page.tsx
            ("This site serves Chrome's WebMCP origin-trial token") and the
            simulated-mode note in components/learn/stage.tsx — which goes
            stale for ordinary Chrome if the token lapses. */}
        <meta
          httpEquiv="origin-trial"
          content="AtwsjYQEU4rBk9go+qs0qikwxSR0KgHjwEI+pwJtYsdwnsSaWWPn4DJCyRlVb+wZo6Tz87dYpNKu5ROQKyLJ0AkAAABdeyJvcmlnaW4iOiJodHRwczovL3N0YWNrdHIuZWU6NDQzIiwiZmVhdHVyZSI6IldlYk1DUCIsImV4cGlyeSI6MTc5NDg3MzYwMCwiaXNTdWJkb21haW4iOnRydWV9"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
