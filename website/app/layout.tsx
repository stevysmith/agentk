import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'agentk — human-in-the-loop for the agentic web',
  description: 'A cmdk fork that gives humans transparency and control over WebMCP tools. Browse what the agent can do, trigger or override actions, see results.',
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
