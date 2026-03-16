import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'agentk — human-in-the-loop for the agentic web',
  description: 'A cmdk fork that gives humans transparency and control over WebMCP tools. Browse what the agent can do, trigger or override actions, see results.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
