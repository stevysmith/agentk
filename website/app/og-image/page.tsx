/* Open Graph source page — screenshotted at exactly 1200x630 and saved to
   /public/og-image.png. Not linked from anywhere; it exists so the social
   card is built from the site's real brand system (Newsreader display,
   amber accent, warm near-black, the palette motif) instead of a mockup
   drifting out of sync. Re-screenshot after any brand change. */

export default function OgImage() {
  const amber = '#f59e0b'
  const ground = '#0a0a0a'
  const card = '#141210'
  const line = '#2b2822'
  const text = '#ece9e2'
  const muted = '#8f8a7f'

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,500..600&display=swap"
        rel="stylesheet"
      />
      <div
        style={{
          width: 1200,
          height: 630,
          background: ground,
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          fontFamily: "'Inter', system-ui, sans-serif",
        }}
      >
        {/* faint amber wash, echoing the landing's single-hue warmth */}
        <div
          style={{
            position: 'absolute',
            inset: '-20%',
            background:
              'radial-gradient(at 78% 12%, rgba(245,158,11,0.14) 0px, transparent 52%), radial-gradient(at 12% 95%, rgba(217,119,6,0.08) 0px, transparent 45%)',
            filter: 'blur(70px)',
          }}
        />

        {/* left: wordmark, headline, install */}
        <div style={{ position: 'relative', paddingLeft: 84, width: 660 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 30 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 9,
                background: card,
                border: `1px solid ${line}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: amber,
                fontSize: 24,
                fontWeight: 500,
              }}
            >
              &#8984;
            </div>
            <span style={{ color: text, fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em' }}>agentk</span>
          </div>
          <h1
            style={{
              fontFamily: "'Newsreader', Georgia, serif",
              fontWeight: 600,
              fontSize: 56,
              lineHeight: 1.12,
              letterSpacing: '-0.015em',
              color: text,
              margin: 0,
              whiteSpace: 'nowrap',
            }}
          >
            The command palette
            <br />
            for the agentic web.
          </h1>
          <div
            style={{
              marginTop: 34,
              display: 'inline-flex',
              alignItems: 'center',
              border: `1px solid ${line}`,
              borderRadius: 10,
              padding: '13px 22px',
              fontFamily: "'SF Mono', ui-monospace, Menlo, monospace",
              fontSize: 19,
              color: muted,
            }}
          >
            npm install @stevysmith/agentk
          </div>
        </div>

        {/* domain — anchored to the canvas, not the column */}
        <div
          style={{
            position: 'absolute',
            left: 84,
            bottom: 44,
            fontFamily: "'SF Mono', ui-monospace, Menlo, monospace",
            fontSize: 17,
            color: muted,
          }}
        >
          agentk.stacktr.ee
        </div>

        {/* right: the palette, in miniature — one catalog, per-tool identity */}
        <div style={{ position: 'relative', width: 440, marginLeft: 8 }}>
          <div
            style={{
              background: card,
              border: `1px solid ${line}`,
              borderRadius: 14,
              overflow: 'hidden',
              boxShadow: '0 2px 24px rgba(0,0,0,0.45)',
            }}
          >
            <div
              style={{
                padding: '20px 22px',
                borderBottom: `1px solid ${line}`,
                color: muted,
                fontSize: 19,
              }}
            >
              Try: &ldquo;Deploy staging from main branch&rdquo;
              <span
                style={{
                  display: 'inline-block',
                  width: 2,
                  height: 20,
                  background: amber,
                  marginLeft: 3,
                  verticalAlign: 'middle',
                }}
              />
            </div>
            {[
              { name: 'Run Tests', tag: 'run_tests', dot: '#f59e0b', active: true },
              { name: 'Set Thermostat', tag: 'set_thermostat', dot: '#3b82f6', active: false },
              { name: 'Play Music', tag: 'play_music', dot: '#a78bfa', active: false },
            ].map((r) => (
              <div
                key={r.tag}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 13,
                  padding: '17px 22px',
                  background: r.active ? 'rgba(245,158,11,0.09)' : 'transparent',
                  borderLeft: r.active ? `3px solid ${amber}` : '3px solid transparent',
                }}
              >
                <span style={{ width: 9, height: 9, borderRadius: 99, background: r.dot }} />
                <span style={{ color: text, fontSize: 19, fontWeight: 600 }}>{r.name}</span>
                <span
                  style={{
                    marginLeft: 'auto',
                    fontFamily: "'SF Mono', ui-monospace, Menlo, monospace",
                    fontSize: 14,
                    color: muted,
                    border: `1px solid ${line}`,
                    borderRadius: 6,
                    padding: '3px 9px',
                  }}
                >
                  {r.tag}
                </span>
              </div>
            ))}
            <div
              style={{
                padding: '15px 22px',
                borderTop: `1px solid ${line}`,
                color: muted,
                fontSize: 15,
              }}
            >
              One catalog &mdash; humans get the palette, agents get WebMCP.
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
