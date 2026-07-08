/** @type {import('next').NextConfig} */

// WebMCP origin trial (stacktr.ee, subdomain-matching). Delivered as an HTTP
// header because Chrome does not reliably activate this trial from a <meta>
// tag: the same token works on stacktr.ee (header) but not here via meta.
// Renew before 2026-11-17.
const WEBMCP_ORIGIN_TRIAL_TOKEN =
  'AtwsjYQEU4rBk9go+qs0qikwxSR0KgHjwEI+pwJtYsdwnsSaWWPn4DJCyRlVb+wZo6Tz87dYpNKu5ROQKyLJ0AkAAABdeyJvcmlnaW4iOiJodHRwczovL3N0YWNrdHIuZWU6NDQzIiwiZmVhdHVyZSI6IldlYk1DUCIsImV4cGlyeSI6MTc5NDg3MzYwMCwiaXNTdWJkb21haW4iOnRydWV9'

const nextConfig = {
  transpilePackages: ['agentk'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [{ key: 'Origin-Trial', value: WEBMCP_ORIGIN_TRIAL_TOKEN }],
      },
    ]
  },
}

export default nextConfig
