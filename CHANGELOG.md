# Changelog

Notable changes per published release. Versions link to the tag; anything not
listed here is site or docs work that doesn't change the package.

The jump from 0.4.1 to 0.6.2 is real — 0.5.x was never cut. Published versions
are 0.3.0, 0.3.1, 0.4.0, 0.4.1 and 0.6.2.

## [0.6.2] — 2026-08-30

Everything here came out of building a live WebMCP app against Chrome 151 and
the ChatGPT desktop in-app browser, where the gaps showed up as real failures
rather than theory.

**Tool registration**

- Forward `annotations`, `title` and `isError` to `registerTool`, so a page can
  mark a tool read-only and return a failure the model can act on.
- Defer surface changes while calls are in flight (+30 ms). Chrome <153 aborts
  an in-flight `executeTool` when its tool is unregistered, which surfaces as an
  opaque `UnknownError: transient` — a page with a changing tool list hit this
  constantly.
- Prefer `document.modelContext` over `navigator.modelContext`: ChatGPT exposes
  only the former.
- Send object input to `executeTool`, falling back to a JSON string only when
  the error asks for one. Chrome accepts either; ChatGPT rejects strings.

**Multi-step agent runs**

- `maxSteps` feeds each tool result back to the provider until it answers with
  text, so an agent can look, then act, then report. Defaults to 1, so an
  existing scripted `providerFn` cannot suddenly loop.
- Tool errors go back to the model instead of ending the run, letting it recover
  ("no ticket" → buy one → retry).
- `autoApproveReadOnly` runs read-only plans without a prompt, but still stops
  for anything that changes state.
- `AgentKStepRecord` and `buildFollowUpPrompt` keep the transcript
  provider-agnostic.

**Also**

- The approval panel renders parameters as `name=value` with truncation, instead
  of running bare values together into "Take Tourlight".
- Provider defaults point at current model IDs; the retired ones were 404ing on
  the live demos.

## [0.4.1] — 2026-07-09

- `useWebMCPRegistration`: resilient tool registration across `document` and
  `navigator`, tolerating a late-arriving API. Wired into the devops, shop,
  linear and smart-home demos.
- Serve the WebMCP origin-trial token as an HTTP header — the meta tag alone
  does not activate the trial.

## [0.4.0] — 2026-07-08

- Streaming progress via `onProgress`, and `Approval renderPlanning`.
- Surface text-only agent replies instead of dropping them.
- `max_tokens` is configurable; the Anthropic default is raised from 1024.
- `dangerouslyAllowBrowserKey` suppresses the client-side key warning.
- Planning and provider errors are surfaced instead of a blank dialog.
- Palette search matches display labels, not raw tool names.

## [0.3.0] — 2026-05-26

First public release under `@stevysmith/agentk`: the command palette, agent
mode, and the WebMCP primitives, published with public access.

[0.6.2]: https://github.com/stevysmith/agentk/releases/tag/v0.6.2
[0.4.1]: https://github.com/stevysmith/agentk/releases/tag/v0.4.1
[0.4.0]: https://github.com/stevysmith/agentk/releases/tag/v0.4.0
[0.3.0]: https://github.com/stevysmith/agentk/releases/tag/v0.3.0
