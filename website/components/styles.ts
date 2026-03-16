export const showcaseStyles = `
  /* ─── Inter Font ─── */
  @font-face {
    font-family: 'Inter';
    font-style: normal;
    font-weight: 100 900;
    font-display: swap;
    src: url(https://rsms.me/inter/font-files/InterVariable.woff2) format('woff2');
  }

  /* ─── Reset & Variables ─── */
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  ::selection {
    background: hotpink;
    color: white;
  }

  :root {
    --gray1: hsl(0, 0%, 99%);
    --gray2: hsl(0, 0%, 97.3%);
    --gray3: hsl(0, 0%, 95.1%);
    --gray4: hsl(0, 0%, 93%);
    --gray5: hsl(0, 0%, 90.9%);
    --gray6: hsl(0, 0%, 88.7%);
    --gray7: hsl(0, 0%, 85.8%);
    --gray8: hsl(0, 0%, 78%);
    --gray9: hsl(0, 0%, 56.1%);
    --gray10: hsl(0, 0%, 52.3%);
    --gray11: hsl(0, 0%, 43.5%);
    --gray12: hsl(0, 0%, 9%);
    --grayA3: hsla(0, 0%, 0%, 0.047);
    --grayA4: hsla(0, 0%, 0%, 0.071);
    --grayA5: hsla(0, 0%, 0%, 0.09);
    --grayA6: hsla(0, 0%, 0%, 0.114);

    --bg: var(--gray1);
    --card-bg: #ffffff;
    --card-border: var(--gray6);
    --card-shadow: 0 16px 70px rgb(0 0 0 / 20%);
    --text: var(--gray12);
    --text-2: var(--gray11);
    --text-3: var(--gray9);
    --border: var(--gray6);
    --accent: hsl(206, 100%, 50%);
    --font: 'Inter', system-ui, -apple-system, sans-serif;
    --mono: 'SF Mono', ui-monospace, 'Fira Code', monospace;
  }

  .dark {
    --gray1: hsl(0, 0%, 8.5%);
    --gray2: hsl(0, 0%, 11%);
    --gray3: hsl(0, 0%, 13.6%);
    --gray4: hsl(0, 0%, 15.8%);
    --gray5: hsl(0, 0%, 17.9%);
    --gray6: hsl(0, 0%, 20.5%);
    --gray7: hsl(0, 0%, 24.3%);
    --gray8: hsl(0, 0%, 31.2%);
    --gray9: hsl(0, 0%, 43.9%);
    --gray10: hsl(0, 0%, 49.4%);
    --gray11: hsl(0, 0%, 62.8%);
    --gray12: hsl(0, 0%, 93%);
    --grayA3: hsla(0, 0%, 100%, 0.056);
    --grayA4: hsla(0, 0%, 100%, 0.086);
    --grayA5: hsla(0, 0%, 100%, 0.11);
    --grayA6: hsla(0, 0%, 100%, 0.138);
    --bg: var(--gray1);
    --card-bg: var(--gray2);
    --card-border: var(--gray6);
    --card-shadow: 0 16px 70px rgb(0 0 0 / 50%);
    --text: var(--gray12);
    --text-2: var(--gray11);
    --text-3: var(--gray9);
    --border: var(--gray6);
  }

  body {
    font-family: var(--font);
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  /* ─── Page ─── */
  .showcase-page {
    min-height: 100vh;
    background: var(--bg);
    color: var(--text);
    position: relative;
    overflow-x: hidden;
    transition: background 0.3s, color 0.3s;
  }

  .page-content {
    max-width: 800px;
    margin: 0 auto;
    padding: 0 24px;
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    min-height: 100vh;
  }

  /* ─── Background gradient mesh ─── */
  .bg-mesh {
    position: fixed;
    width: 100%;
    height: 100%;
    top: 0;
    left: 0;
    pointer-events: none;
    z-index: 0;
  }

  .bg-mesh::after {
    content: '';
    background-image:
      radial-gradient(at 27% 37%, hsla(215, 98%, 61%, 1) 0px, transparent 50%),
      radial-gradient(at 97% 21%, hsla(256, 98%, 72%, 1) 0px, transparent 50%),
      radial-gradient(at 52% 99%, hsla(354, 98%, 61%, 1) 0px, transparent 50%),
      radial-gradient(at 10% 29%, hsla(133, 96%, 67%, 1) 0px, transparent 50%),
      radial-gradient(at 97% 96%, hsla(38, 60%, 74%, 1) 0px, transparent 50%),
      radial-gradient(at 33% 50%, hsla(222, 67%, 73%, 1) 0px, transparent 50%),
      radial-gradient(at 79% 53%, hsla(343, 68%, 79%, 1) 0px, transparent 50%);
    position: fixed;
    width: 120%;
    height: 120%;
    top: -10%;
    left: -10%;
    filter: blur(100px) saturate(150%);
    opacity: 0.15;
    pointer-events: none;
    z-index: 0;
    transform: translateZ(0);
    animation: meshDrift 20s ease-in-out infinite alternate;
  }

  @keyframes meshDrift {
    0% { transform: translateZ(0) translate(0, 0) scale(1); }
    33% { transform: translateZ(0) translate(2%, -1.5%) scale(1.02); }
    66% { transform: translateZ(0) translate(-1.5%, 2%) scale(0.98); }
    100% { transform: translateZ(0) translate(1%, -1%) scale(1.01); }
  }

  .dark .bg-mesh::after { opacity: 0.08; }

  /* ─── Dark mode toggle ─── */
  .theme-toggle {
    position: fixed;
    top: 16px;
    right: 16px;
    z-index: 100;
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    border: 1px solid var(--card-border);
    background: var(--card-bg);
    color: var(--text-2);
    cursor: pointer;
    transition: all 0.2s;
  }

  .theme-toggle:hover {
    color: var(--text);
    border-color: var(--text-3);
  }

  /* ─── Header ─── */
  .header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding: 80px 0 48px;
    gap: 24px;
    flex-wrap: wrap;
  }

  .header-left {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .title-row {
    display: flex;
    align-items: baseline;
    gap: 12px;
  }

  .version-badge {
    display: inline-flex;
    align-items: center;
    color: var(--gray11);
    background: var(--grayA3);
    padding: 3px 8px;
    border-radius: 4px;
    font-weight: 500;
    font-size: 13px;
    border: none;
  }

  .page-title {
    font-size: 42px;
    font-weight: 700;
    letter-spacing: -0.04em;
    line-height: 1;
    color: var(--text);
  }

  .tagline {
    font-size: 17px;
    color: var(--text);
    font-weight: 400;
    margin-top: 4px;
    line-height: 1.4;
  }

  .tagline-sub {
    font-size: 15px;
    color: var(--text-2);
    font-weight: 400;
    margin-top: 2px;
    line-height: 1.4;
  }

  .tagline-traits {
    font-size: 13px;
    color: var(--text-3);
    font-weight: 400;
    margin-top: 6px;
    letter-spacing: 0.02em;
  }

  .header-right {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 12px;
    padding-top: 4px;
  }

  .install-btn {
    display: inline-flex;
    align-items: center;
    gap: 16px;
    padding: 0 8px 0 16px;
    border-radius: 9999px;
    height: 40px;
    font-size: 14px;
    font-family: var(--mono);
    background: var(--grayA3);
    color: var(--text);
    border: none;
    cursor: copy;
    transition: background 150ms ease, transform 150ms ease;
    white-space: nowrap;
    font-weight: 500;
  }

  .install-btn:hover {
    background: var(--grayA4);
  }

  .install-btn .copy-icon-wrap {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--grayA3);
    border-radius: 9999px;
    transition: background 150ms ease;
  }

  .install-btn:hover .copy-icon-wrap {
    background: var(--grayA5);
  }

  .install-text { font-family: var(--mono); font-size: 13px; }

  .copied-state {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: #22c55e;
    font-family: var(--font);
    font-size: 13px;
    font-weight: 500;
  }

  .github-link {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 0 12px;
    height: 40px;
    border-radius: 9999px;
    font-size: 14px;
    font-weight: 500;
    color: var(--gray12);
    text-decoration: none;
    border: none;
    background: transparent;
    transition: background 150ms ease, transform 150ms ease;
  }

  .github-link:hover {
    background: var(--grayA3);
  }

  /* ─── Demo area ─── */
  .demo-area {
    position: relative;
    margin: 0 auto;
    width: 100%;
    max-width: 640px;
  }

  /* ─── Button press feedback ─── */
  .install-btn:active, .github-link:active, .theme-tab:active {
    transform: scale(0.97);
  }

  /* ─── Palette container (shared across themes) ─── */
  .palette-container {
    background: var(--card-bg);
    border: 1px solid var(--gray6);
    border-radius: 12px;
    box-shadow: var(--card-shadow);
    overflow: hidden;
    transition: background 0.3s, border-color 0.3s, box-shadow 0.3s;
  }

  /* ─── Shared cmdk styling ─── */
  .palette-container [cmdk-root] { background: transparent; }

  .palette-container [cmdk-input] {
    width: 100%;
    padding: 16px 20px;
    border: none;
    border-bottom: 1px solid var(--border);
    background: transparent;
    font-size: 16px;
    color: var(--text);
    outline: none;
    font-family: var(--font);
  }

  .palette-container [cmdk-input]::placeholder { color: var(--text-3); }

  .palette-container [cmdk-list] {
    max-height: 340px;
    overflow-y: auto;
    padding: 8px;
  }

  .palette-container [cmdk-group-heading] {
    padding: 8px 12px 4px;
    font-size: 12px;
    font-weight: 500;
    color: var(--text-3);
    user-select: none;
  }

  .palette-container [cmdk-item] {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    border-radius: 8px;
    font-size: 14px;
    color: var(--text);
    cursor: pointer;
    transition: background 0.1s;
    user-select: none;
    position: relative;
  }

  .palette-container [cmdk-item][aria-selected="true"] {
    background: rgba(0, 0, 0, 0.06);
  }

  .palette-container [cmdk-item]:hover {
    background: rgba(0, 0, 0, 0.03);
  }

  .dark .palette-container [cmdk-item][aria-selected="true"] {
    background: rgba(255, 255, 255, 0.08);
  }

  .dark .palette-container [cmdk-item]:hover {
    background: rgba(255, 255, 255, 0.04);
  }

  .palette-container [cmdk-item] [data-agentk-tool-icon] {
    color: var(--text-3);
    flex-shrink: 0;
    display: flex;
    align-items: center;
  }

  .palette-container [cmdk-item][aria-selected="true"] [data-agentk-tool-icon] {
    color: var(--accent);
  }

  .dark .palette-container [cmdk-item][aria-selected="true"] [data-agentk-tool-icon] {
    color: #60a5fa;
  }

  .palette-container [cmdk-item] [data-agentk-tool-description] {
    margin-left: auto;
    font-size: 12px;
    color: var(--text-3);
  }

  .palette-container [cmdk-empty] {
    padding: 24px;
    text-align: center;
    font-size: 14px;
    color: var(--text-3);
  }

  /* ─── Form and result styling (shared) ─── */
  .palette-container [data-agentk-form] { padding: 16px 20px; }
  .palette-container [data-agentk-form-heading] {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;
    font-size: 14px;
    color: var(--text);
    font-weight: 500;
  }
  .palette-container [data-agentk-form-fields] { margin-bottom: 16px; }
  .palette-container [data-agentk-form-field] { margin-bottom: 12px; }
  .palette-container [data-agentk-form-label] { display: block; font-size: 12px; color: var(--text-2); margin-bottom: 6px; }

  .palette-container [data-agentk-field-range] { display: flex; align-items: center; gap: 12px; }
  .palette-container [data-agentk-field-range] input[type="range"] { flex: 1; accent-color: var(--accent); }
  .palette-container [data-agentk-field-range-value] {
    font-size: 13px;
    color: var(--text-2);
    font-variant-numeric: tabular-nums;
    min-width: 32px;
    text-align: right;
  }

  .palette-container select,
  .palette-container [data-agentk-form] select {
    width: 100%;
    padding: 8px 12px;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--card-bg);
    color: var(--text);
    font-size: 13px;
    font-family: var(--font);
    outline: none;
    cursor: pointer;
  }

  .palette-container select:focus {
    border-color: var(--accent);
  }

  .palette-container [data-agentk-form-actions] { display: flex; gap: 8px; justify-content: flex-end; }

  .palette-container [data-agentk-form-cancel],
  .palette-container [data-agentk-form-submit] {
    padding: 6px 14px;
    border-radius: 6px;
    font-size: 13px;
    font-family: var(--font);
    cursor: pointer;
    transition: all 0.15s;
    border: 1px solid var(--border);
  }

  .palette-container [data-agentk-form-cancel] {
    background: transparent;
    color: var(--text-2);
  }

  .palette-container [data-agentk-form-cancel]:hover {
    background: rgba(0, 0, 0, 0.03);
  }

  .dark .palette-container [data-agentk-form-cancel]:hover {
    background: rgba(255, 255, 255, 0.04);
  }

  .palette-container [data-agentk-form-submit] {
    background: var(--accent);
    color: white;
    border-color: var(--accent);
  }

  .palette-container [data-agentk-form-submit]:hover {
    background: #005ec4;
  }

  .palette-container [data-agentk-result] { padding: 16px 20px; }
  .palette-container [data-agentk-result-heading] { font-size: 13px; color: #22c55e; margin-bottom: 8px; }
  .palette-container [data-agentk-result-data] {
    font-size: 12px;
    color: var(--text-2);
    font-family: var(--mono);
    background: rgba(0, 0, 0, 0.03);
    padding: 8px 12px;
    border-radius: 6px;
    white-space: pre-wrap;
  }
  .dark .palette-container [data-agentk-result-data] {
    background: rgba(255, 255, 255, 0.03);
  }
  .palette-container [data-agentk-result-dismiss] {
    margin-top: 12px;
    padding: 6px 14px;
    border-radius: 6px;
    font-size: 13px;
    font-family: var(--font);
    cursor: pointer;
    background: transparent;
    color: var(--text-2);
    border: 1px solid var(--border);
  }
  .palette-container [data-agentk-result-meta] { display: none; }

  /* ─── Raycast theme — pixel-perfect match of cmdk2 ─── */

  /* Container overrides */
  .raycast-theme.palette-container {
    border-radius: 12px;
    padding: 8px 0;
    border: 1px solid var(--gray6);
    position: relative;
    background: var(--gray1);
  }
  .dark .raycast-theme.palette-container {
    background: var(--gray2);
    border: 0;
  }

  /* Remove selection bar (Raycast has none) */
  .raycast-theme [cmdk-item][aria-selected="true"]::before { display: none; }

  /* Input — exact cmdk2: font-size 15px, padding 8px 16px */
  .raycast-theme [cmdk-input] {
    font-size: 15px;
    padding: 12px 16px;
    background: transparent;
    color: var(--gray12);
    border: none;
    border-bottom: none;
  }
  .raycast-theme [cmdk-input]::placeholder { color: var(--gray9); }

  /* Loader — exact cmdk2: margin-top 12px, margin-bottom 12px */
  .raycast-loader {
    border: 0;
    width: 100%;
    height: 1px;
    background: var(--gray6);
    display: block;
    margin-top: 2px;
    margin-bottom: 12px;
  }

  /* List */
  .raycast-theme [cmdk-list] {
    padding: 0 8px;
    padding-bottom: 40px;
    max-height: none;
    overflow: auto;
    overscroll-behavior: contain;
    transition: 100ms ease;
    transition-property: height;
  }

  /* Group spacing & heading */
  .raycast-theme *:not([hidden]) + [cmdk-group] { margin-top: 8px; }
  .raycast-theme [cmdk-group-heading] {
    font-size: 12px;
    padding: 0 8px;
    color: var(--gray11);
    user-select: none;
  }

  /* Items — exact cmdk2: height 40px, font-size 14px, gap 8px, padding 0 8px */
  .raycast-theme [cmdk-item] {
    height: 40px;
    padding: 0 8px;
    border-radius: 8px;
    gap: 8px;
    font-size: 14px;
    color: var(--gray12);
    transition: all 150ms ease;
  }
  .raycast-theme [cmdk-item]:first-child { margin-top: 8px; }
  .raycast-theme [cmdk-item] + [cmdk-item] { margin-top: 4px; }
  .raycast-theme [cmdk-item] svg { width: 18px; height: 18px; }

  /* Item states */
  .raycast-theme [cmdk-item][aria-selected="true"],
  .dark .raycast-theme [cmdk-item][aria-selected="true"] {
    background: var(--gray4);
    color: var(--gray12);
  }
  .raycast-theme [cmdk-item]:active {
    transition-property: background;
    background: var(--gray4);
  }
  .raycast-theme [cmdk-item][aria-disabled="true"] {
    color: var(--gray8);
    cursor: not-allowed;
  }

  /* Meta label ("Application", "Command") */
  .raycast-theme [data-agentk-tool-description] {
    margin-left: auto;
    color: var(--gray11);
    font-size: 13px;
  }

  /* Empty */
  .raycast-theme [cmdk-empty] {
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 64px;
    white-space: pre-wrap;
    color: var(--gray11);
  }

  /* Logo wrapper — blur effect matching cmdk2 */
  .raycast-logo {
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    width: 20px;
    height: 20px;
    border-radius: 4px;
    overflow: hidden;
    box-shadow: inset 0 0 1px 1px rgba(0, 0, 0, 0.015);
    flex-shrink: 0;
  }
  .raycast-logo-bg {
    display: flex;
    align-items: center;
    justify-content: center;
    position: absolute;
    z-index: 1;
    pointer-events: none;
    user-select: none;
    top: 0; left: 0;
    width: 100%; height: 100%;
    transform: scale(1.5) translateZ(0);
    filter: blur(12px) opacity(0.4) saturate(100%);
  }
  .raycast-logo-bg svg { width: 100%; height: 100%; }
  .raycast-logo-inner {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%; height: 100%;
    user-select: none;
    pointer-events: none;
    border-radius: inherit;
    z-index: 2;
  }
  .raycast-logo-inner svg {
    width: 14px;
    height: 14px;
    filter: drop-shadow(0 4px 4px rgba(0, 0, 0, 0.16));
  }

  /* Colored command icon wrappers */
  .raycast-cmd-icon {
    width: 20px;
    height: 20px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #ffffff;
    flex-shrink: 0;
  }
  .raycast-cmd-icon svg { width: 14px; height: 14px; }

  /* kbd styling inside raycast root */
  .raycast-theme [cmdk-root] kbd {
    font-family: var(--font);
    background: var(--gray3);
    color: var(--gray11);
    height: 20px;
    width: 20px;
    border-radius: 4px;
    padding: 0 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    border: none;
  }
  .raycast-theme [cmdk-root] kbd:first-of-type { margin-left: 8px; }

  /* Footer */
  .raycast-footer {
    display: flex;
    height: 40px;
    align-items: center;
    width: 100%;
    position: absolute;
    background: var(--gray1);
    bottom: 0;
    padding: 8px;
    border-top: 1px solid var(--gray6);
    border-radius: 0 0 12px 12px;
  }
  .dark .raycast-footer { background: var(--gray2); }

  /* Ensure form/result/approval content clears the absolute footer */
  .raycast-theme [data-agentk-form],
  .raycast-theme [data-agentk-result],
  .raycast-theme [data-agentk-approval] {
    padding-bottom: 48px;
  }

  .raycast-footer svg {
    width: 20px;
    height: 20px;
    filter: grayscale(1);
    margin-right: auto;
  }

  .raycast-footer hr {
    height: 12px;
    width: 1px;
    border: 0;
    background: var(--gray6);
    margin: 0 4px 0 12px;
  }

  .raycast-open-trigger {
    color: var(--gray12);
    padding: 0 4px 0 8px;
    border-radius: 6px;
    font-weight: 500;
    font-size: 12px;
    height: 28px;
    letter-spacing: -0.25px;
    display: flex;
    align-items: center;
    cursor: pointer;
    border: none;
    background: transparent;
  }

  .raycast-subcommand-trigger {
    color: var(--gray11);
    padding: 0 4px 0 8px;
    border-radius: 6px;
    font-weight: 500;
    font-size: 12px;
    height: 28px;
    letter-spacing: -0.25px;
    display: flex;
    align-items: center;
    gap: 4px;
    cursor: pointer;
    border: none;
    background: transparent;
  }

  .raycast-subcommand-trigger:hover,
  .raycast-subcommand-active {
    background: var(--gray4);
    border-radius: 6px;
  }

  .raycast-subcommand-trigger:hover kbd,
  .raycast-subcommand-active kbd {
    background: var(--gray7) !important;
  }

  /* Submenu popover */
  .raycast-submenu-backdrop {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    z-index: 99;
  }

  .raycast-submenu {
    position: absolute;
    bottom: 56px;
    right: 8px;
    z-index: 100;
    width: 320px;
    border: 1px solid var(--gray6);
    background: var(--gray2);
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    animation: raycastSubmenuIn 0.2s ease forwards;
    transform-origin: bottom right;
    box-shadow: 0 16px 70px rgb(0 0 0 / 20%);
  }

  @keyframes raycastSubmenuIn {
    from { opacity: 0; transform: scale(0.96); }
    to { opacity: 1; transform: scale(1); }
  }

  .raycast-submenu-heading {
    font-size: 12px;
    color: var(--gray11);
    font-weight: 500;
    margin-top: 8px;
    margin-bottom: 8px;
    margin-left: 12px;
  }

  .raycast-submenu-list {
    padding: 8px;
    display: flex;
    flex-direction: column;
  }

  .raycast-submenu-item {
    cursor: pointer;
    height: 40px;
    border-radius: 8px;
    font-size: 13px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 8px;
    color: var(--gray12);
    user-select: none;
    will-change: background, color;
    transition: all 150ms ease;
    text-align: left;
  }

  .raycast-submenu-item:first-child {
    background: var(--gray5);
  }
  .raycast-submenu-item:first-child .raycast-submenu-shortcuts kbd {
    background: var(--gray7);
  }

  .raycast-submenu-item:hover {
    background: var(--gray5);
  }

  .raycast-submenu-item svg {
    width: 16px;
    height: 16px;
  }

  .raycast-submenu-shortcuts {
    display: flex;
    margin-left: auto;
    gap: 2px;
  }

  .raycast-submenu-shortcuts kbd {
    font-family: var(--font);
    background: var(--gray5);
    color: var(--gray11);
    height: 20px;
    width: 20px;
    border-radius: 4px;
    padding: 0 4px;
    font-size: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
  }

  .raycast-submenu-item:hover .raycast-submenu-shortcuts kbd {
    background: var(--gray7);
  }

  .raycast-submenu-input {
    padding: 12px;
    border: 0;
    border-top: 1px solid var(--gray6);
    font-size: 13px;
    background: transparent;
    margin-top: auto;
    width: 100%;
    outline: 0;
    color: var(--gray12);
    font-family: var(--font);
    border-radius: 0 0 8px 8px;
  }
  .raycast-submenu-input::placeholder { color: var(--gray9); }

  /* ─── DevOps theme — teal/green CI/CD accent ─── */
  .devops-theme [cmdk-item] {
    border-radius: 0 8px 8px 0;
    padding-left: 16px;
  }
  .devops-theme [cmdk-item][aria-selected="true"]::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 3px;
    border-radius: 0;
    background: #0d9488;
  }
  .devops-theme [cmdk-item][aria-selected="true"] [data-agentk-tool-icon] {
    color: #0d9488;
  }
  .dark .devops-theme [cmdk-item][aria-selected="true"] [data-agentk-tool-icon] {
    color: #2dd4bf;
  }
  .devops-theme [cmdk-input] {
    caret-color: #0d9488;
  }

  /* ─── Smart Home theme — warm orange/amber accent ─── */
  .smarthome-theme [cmdk-item] {
    border-radius: 0 8px 8px 0;
    padding-left: 16px;
  }
  .smarthome-theme [cmdk-item][aria-selected="true"]::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 3px;
    border-radius: 0;
    background: #f59e0b;
  }
  .smarthome-theme [cmdk-item][aria-selected="true"] [data-agentk-tool-icon] {
    color: #d97706;
  }
  .dark .smarthome-theme [cmdk-item][aria-selected="true"] [data-agentk-tool-icon] {
    color: #fbbf24;
  }
  .smarthome-theme [cmdk-input] {
    caret-color: #f59e0b;
  }

  /* ─── Linear theme — pixel-perfect match of cmdk2 ─── */
  .linear-theme.palette-container {
    border-radius: 8px;
    border-color: var(--gray6);
  }

  .linear-theme [cmdk-root] {
    border-radius: 8px;
    padding: 0;
    outline: none;
    box-shadow: var(--card-shadow);
  }

  .dark .linear-theme [cmdk-root] {
    background: linear-gradient(136.61deg, rgb(39, 40, 43) 13.72%, rgb(45, 46, 49) 74.3%);
  }

  .linear-badge {
    height: 24px;
    padding: 0 8px;
    font-size: 12px;
    color: var(--gray11);
    background: var(--gray3);
    border-radius: 4px;
    width: fit-content;
    display: flex;
    align-items: center;
    margin: 16px 16px 0;
  }

  .linear-theme [cmdk-input] {
    font-size: 18px;
    padding: 20px;
    background: transparent;
    color: var(--gray12);
    border-bottom: 1px solid var(--gray6);
    caret-color: #6e5ed2;
    margin: 0;
  }
  .linear-theme [cmdk-input]::placeholder { color: var(--gray9); }

  .linear-theme [cmdk-list] {
    height: min(300px, var(--cmdk-list-height));
    min-height: 120px;
    max-height: 400px;
    padding: 0;
    overscroll-behavior: contain;
    transition: 100ms ease;
    transition-property: height;
  }

  .linear-theme [cmdk-item] {
    height: 48px;
    padding: 0 16px;
    border-radius: 0;
    gap: 12px;
    font-size: 14px;
    color: var(--gray12);
    transition-property: none;
  }
  .linear-theme [cmdk-item] + [cmdk-item] { margin-top: 4px; }

  .linear-theme [cmdk-item][aria-selected="true"] {
    background: var(--gray3);
  }
  .dark .linear-theme [cmdk-item][aria-selected="true"] {
    background: var(--gray3);
  }

  .linear-theme [cmdk-item][aria-selected="true"]::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    width: 3px;
    height: 100%;
    border-radius: 0;
    background: #5f6ad2;
    z-index: 123;
    transform: none;
    box-shadow: none;
  }

  .linear-theme [cmdk-item][aria-selected="true"] svg {
    color: var(--gray12);
  }

  .linear-theme [cmdk-item]:active {
    transition-property: background;
    background: var(--gray4);
  }

  .linear-theme [cmdk-item] svg {
    width: 16px;
    height: 16px;
    color: var(--gray10);
  }

  .linear-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }

  .linear-shortcuts {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .linear-kbd {
    font-size: 13px;
    color: var(--gray11);
    background: none;
    border: none;
    padding: 0;
    font-family: var(--font);
    font-weight: 400;
  }

  .linear-theme [cmdk-empty] {
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 64px;
    white-space: pre-wrap;
    color: var(--gray11);
  }

  .linear-theme [cmdk-group-heading] {
    user-select: none;
    font-size: 12px;
    color: var(--gray11);
    padding: 0 8px;
    display: flex;
    align-items: center;
  }

  /* ─── Smart Home theme ─── */
  .sh-header {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 20px;
  }

  .sh-icon {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    background: rgba(245, 158, 11, 0.1);
    color: #f59e0b;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .dark .sh-icon {
    background: rgba(245, 158, 11, 0.15);
  }

  .sh-header-text { flex: 1; }

  .sh-title {
    font-size: 15px;
    font-weight: 600;
    color: var(--text);
    margin-bottom: 2px;
  }

  .sh-subtitle {
    font-size: 12px;
    color: var(--text-3);
  }

  .sh-divider {
    height: 1px;
    background: var(--border);
    margin: 0 20px;
  }

  .sh-plan {
    padding: 12px 20px 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .sh-plan-item {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 8px 12px;
    border-radius: 8px;
    background: rgba(0, 0, 0, 0.02);
  }

  .dark .sh-plan-item {
    background: rgba(255, 255, 255, 0.03);
  }

  .sh-plan-num {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: rgba(245, 158, 11, 0.1);
    color: #f59e0b;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: 600;
    flex-shrink: 0;
  }

  .dark .sh-plan-num {
    background: rgba(245, 158, 11, 0.15);
  }

  .sh-plan-content { flex: 1; }

  .sh-plan-label {
    font-size: 13px;
    color: var(--text);
    font-weight: 500;
  }

  .sh-plan-tool {
    font-size: 11px;
    color: var(--text-3);
    font-family: var(--mono);
    margin-top: 2px;
  }

  .sh-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 12px 20px 16px;
  }

  .sh-btn {
    padding: 7px 18px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    font-family: var(--font);
    cursor: pointer;
    transition: all 0.15s;
    border: 1px solid var(--border);
  }

  .sh-btn-reject {
    background: transparent;
    color: var(--text-2);
  }

  .sh-btn-reject:hover {
    background: rgba(239, 68, 68, 0.06);
    color: #ef4444;
    border-color: rgba(239, 68, 68, 0.2);
  }

  .sh-btn-approve {
    background: #22c55e;
    color: white;
    border-color: #22c55e;
  }

  .sh-btn-approve:hover {
    background: #16a34a;
  }

  /* ─── DevOps theme ─── */
  .do-header {
    padding: 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .do-title {
    font-size: 15px;
    font-weight: 600;
    color: var(--text);
  }

  .do-step {
    font-size: 12px;
    color: var(--text-3);
    font-variant-numeric: tabular-nums;
  }

  .do-progress-track {
    height: 3px;
    background: rgba(0, 0, 0, 0.06);
    margin: 0 20px;
    border-radius: 2px;
    overflow: hidden;
  }

  .dark .do-progress-track {
    background: rgba(255, 255, 255, 0.06);
  }

  .do-progress-fill {
    width: 66%;
    height: 100%;
    background: #22c55e;
    border-radius: 2px;
    transition: width 0.5s ease;
  }

  .do-feed {
    padding: 12px 20px 20px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .do-entry {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    border-radius: 8px;
  }

  .do-entry-done { opacity: 0.7; }

  .do-entry-active {
    background: rgba(34, 197, 94, 0.05);
  }

  .dark .do-entry-active {
    background: rgba(34, 197, 94, 0.08);
  }

  .do-entry-icon {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    flex-shrink: 0;
  }

  .do-check {
    background: rgba(34, 197, 94, 0.1);
    color: #22c55e;
    font-weight: 700;
  }

  .dark .do-check {
    background: rgba(34, 197, 94, 0.15);
  }

  .do-spinner {
    border: 2px solid var(--border);
    border-top-color: #22c55e;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .do-entry-content {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .do-entry-label {
    font-size: 13px;
    color: var(--text);
    font-weight: 500;
  }

  .do-entry-time {
    font-size: 11px;
    color: var(--text-3);
  }

  /* ─── Shop theme ─── */
  .shop-input-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border);
    color: var(--text);
  }

  .shop-search-icon {
    color: var(--text-3);
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }

  .shop-input-text {
    font-size: 16px;
    color: var(--text);
    font-family: var(--font);
  }

  .shop-divider {
    height: 1px;
    background: var(--border);
  }

  .shop-hint {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 20px;
    background: rgba(124, 58, 237, 0.04);
    border-bottom: 1px solid var(--border);
    gap: 12px;
  }

  .dark .shop-hint {
    background: rgba(124, 58, 237, 0.08);
  }

  .shop-hint-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .shop-hint-sparkle {
    color: #7c3aed;
    display: flex;
    align-items: center;
  }

  .shop-hint-label {
    font-size: 14px;
    font-weight: 600;
    color: #7c3aed;
  }

  .shop-hint-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .shop-hint-query {
    font-size: 12px;
    color: var(--text-3);
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .shop-hint-kbd {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 20px;
    height: 20px;
    padding: 0 5px;
    border-radius: 4px;
    border: 1px solid var(--border);
    background: var(--bg);
    font-size: 11px;
    font-family: var(--font);
    color: var(--text-3);
  }

  .shop-results {
    padding: 8px 20px 16px;
  }

  .shop-result-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    border-radius: 8px;
    font-size: 14px;
    color: var(--text);
    transition: background 0.1s;
  }

  .shop-result-item:hover {
    background: rgba(0, 0, 0, 0.03);
  }

  .dark .shop-result-item:hover {
    background: rgba(255, 255, 255, 0.04);
  }

  .shop-result-name {
    font-weight: 500;
  }

  .shop-result-price {
    color: var(--text-3);
    font-size: 13px;
    font-variant-numeric: tabular-nums;
  }

  .shop-empty {
    padding: 48px 32px;
    text-align: center;
  }

  .shop-empty-text {
    font-size: 14px;
    color: var(--text-3);
  }

  /* ─── Theme switcher ─── */
  .theme-switcher {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    margin-top: 52px;
    position: relative;
  }

  .theme-tab {
    position: relative;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 16px;
    height: 32px;
    border-radius: 9999px;
    font-size: 14px;
    color: var(--gray11);
    cursor: pointer;
    background: none;
    border: none;
    font-family: var(--font);
    transition: color 150ms ease, transform 150ms ease;
    z-index: 1;
    user-select: none;
    text-transform: capitalize;
  }

  .theme-tab:hover { color: var(--gray12); }
  .theme-tab[data-active] { color: var(--gray12); }

  .theme-tab-icon {
    display: flex;
    align-items: center;
    line-height: 1;
  }

  .theme-tab-icon svg {
    width: 14px;
    height: 14px;
  }

  .theme-tab-label {
    position: relative;
    z-index: 1;
  }

  .demo-hint {
    position: absolute;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    cursor: pointer;
    transition: opacity 0.15s ease;
  }

  .demo-hint:hover .demo-hint-text {
    color: var(--gray12);
  }

  .demo-hint:hover .demo-hint-arrow {
    color: var(--gray11);
  }

  .demo-hint-arrow {
    color: var(--gray8);
    margin-bottom: -4px;
    overflow: visible;
    transition: color 0.15s ease;
  }

  .demo-hint-text {
    font-family: 'Caveat', 'Segoe Print', 'Comic Sans MS', cursive;
    font-size: 17px;
    color: var(--gray9);
    max-width: 200px;
    line-height: 1.3;
    transition: color 0.15s ease;
    white-space: nowrap;
  }

  @media (max-width: 1100px) {
    .demo-hint { display: none; }
  }

  .theme-tab-bg {
    position: absolute;
    inset: 0;
    background: var(--grayA5);
    border-radius: 9999px;
    z-index: 0;
  }

  .theme-tab[data-active]:hover .theme-tab-bg {
    background: var(--grayA6);
  }

  .theme-arrow {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    background: none;
    color: var(--gray11);
    font-size: 16px;
    cursor: pointer;
    transition: color 150ms ease, opacity 300ms ease;
    font-family: var(--font);
    user-select: none;
    opacity: 1;
  }
  .theme-arrow:hover { color: var(--gray12); }
  .theme-arrow[data-disabled] {
    opacity: 0;
    pointer-events: none;
  }

  .tab-demo-link {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    margin-top: 16px;
    font-size: 13px;
    color: var(--gray9);
    text-decoration: none;
    transition: color 150ms ease;
  }
  .tab-demo-link:hover {
    color: var(--gray12);
  }
  .tab-demo-link:hover svg {
    transform: translateX(2px);
  }
  .tab-demo-link svg {
    transition: transform 150ms ease;
  }

  /* ─── Code block — matches cmdk styling ─── */
  .code-area {
    margin: 56px auto 0;
    width: 100%;
    max-width: 640px;
    position: relative;
  }

  .code-block {
    padding: 16px;
    background: var(--gray1);
    backdrop-filter: blur(10px);
    border: 1px solid var(--gray6);
    border-radius: 12px;
    font-family: Menlo, monospace;
    font-size: 12px;
    line-height: 16px;
    color: var(--gray12);
    overflow-x: auto;
    white-space: pre-wrap;
    tab-size: 2;
    box-shadow: rgb(0 0 0 / 10%) 0px 5px 30px -5px;
    position: relative;
    margin: 0;
  }

  .dark .code-block {
    background: var(--grayA3);
  }

  /* Syntax highlighting — subtle warm tones */
  .hl-kw { color: #8b5cf6; }
  .hl-tag { color: #3b82f6; }
  .hl-str { color: #10b981; }
  .hl-attr { color: #f59e0b; }
  .hl-comment { color: var(--gray9); font-style: italic; }

  .dark .hl-kw { color: #a78bfa; }
  .dark .hl-tag { color: #60a5fa; }
  .dark .hl-str { color: #34d399; }
  .dark .hl-attr { color: #fbbf24; }
  .dark .hl-comment { color: var(--gray9); }

  .code-copy-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: var(--grayA3);
    border-radius: 8px;
    position: absolute;
    top: 12px;
    right: 12px;
    color: var(--gray11);
    cursor: copy;
    border: none;
    transition: color 150ms ease, background 150ms ease, transform 150ms ease;
  }
  .code-copy-btn:hover {
    background: var(--grayA4);
    color: var(--gray12);
  }
  .code-copy-btn:active {
    background: var(--grayA5);
    color: var(--gray12);
    transform: scale(0.96);
  }
  .code-copy-btn svg {
    width: 16px;
    height: 16px;
  }
  .code-copy-btn[data-copied] {
    color: #22c55e;
  }

  .arrow-hint {
    font-size: 12px;
    color: var(--text-3);
    padding: 4px 10px;
    border-radius: 6px;
    background: var(--card-bg);
    border: 1px solid var(--card-border);
    letter-spacing: 0.1em;
    font-weight: 500;
    white-space: nowrap;
  }

  /* ─── Footer ─── */
  .page-footer {
    text-align: center;
    padding: 48px 0 32px;
    font-size: 13px;
    color: var(--gray11);
    margin-top: auto;
  }

  .page-footer a {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--gray12);
    font-weight: 500;
    border-radius: 9999px;
    padding: 4px;
    margin: 0 -2px;
    text-decoration: none;
    transition: background 150ms ease, color 150ms ease;
    position: relative;
  }

  .page-footer a::after {
    content: '';
    position: absolute;
    bottom: 2px;
    left: 4px;
    right: 4px;
    height: 1px;
    background: currentColor;
    opacity: 0;
    transform: scaleX(0.6);
    transition: opacity 200ms ease, transform 200ms ease;
  }

  .page-footer a:hover {
    background: var(--grayA4);
  }

  .page-footer a:hover::after {
    opacity: 0.3;
    transform: scaleX(1);
  }

  /* ─── Responsive ─── */
  @media (max-width: 640px) {
    .header {
      padding: 48px 0 32px;
      flex-direction: column;
      gap: 16px;
    }

    .header-right {
      padding-top: 0;
    }

    .page-title {
      font-size: 32px;
    }

    .theme-switcher {
      flex-wrap: wrap;
      gap: 2px;
    }

    .theme-tab {
      padding: 6px 10px;
      font-size: 12px;
    }

    .theme-tab-icon {
      font-size: 12px;
    }

    .palette-container {
      border-radius: 12px;
    }

    .install-btn {
      font-size: 12px;
      height: 34px;
      padding: 0 6px 0 12px;
      gap: 10px;
    }

    .github-link {
      font-size: 12px;
      height: 34px;
      padding: 0 10px;
    }
  }
`
