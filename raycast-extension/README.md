# Linear Todos — Raycast Extension

A Raycast extension that drives the [`linear-todos`](../) Python CLI to manage
Linear todos with smart date parsing — list, create, remind, review, and digest,
all from Raycast.

This extension does **not** talk to Linear directly. It shells out to the
existing CLI (`uv run python main.py …`) in the repo. Credentials come from
either your existing `~/.config/linear-todos/config.json` (or `LINEAR_*` env
vars), **or** optional Raycast preferences — see
[Where credentials come from](#where-credentials-come-from). If you set the API
key in Raycast, it is stored encrypted in the system keychain.

## Commands

| Command | What it does |
|---------|--------------|
| **List Todos** | Browse todos grouped by urgency. Mark done, snooze, open in Linear, copy ID. |
| **Create Todo** | Form for title, priority, due date (relative or natural language), description. |
| **Remind** | One natural-language argument, e.g. `call mom by eod`. |
| **Daily Review** | Renders the CLI `review` output (by urgency). |
| **Morning Digest** | Renders the CLI `digest` output (today + overdue). |

## Prerequisites

1. **The linear-todos CLI**, set up and working:
   ```bash
   cd .. && uv run python main.py setup
   ```
   (or set `LINEAR_API_KEY` / `LINEAR_TEAM_ID` etc. in your environment)
2. **[uv](https://docs.astral.sh/uv/)** installed.
3. **Python ≥ 3.11** (managed by uv).
4. **Node.js** (for Raycast extension development).

## Install (local development)

```bash
cd raycast-extension
npm install
npx ray develop
```

Raycast will load the extension in place from this folder. The commands appear
in Raycast immediately.

## Configuration (Raycast preferences)

| Preference | Default | Purpose |
|------------|---------|---------|
| **Linear Todos Repo Path** | `/Users/kyle/workspace/linear-todos` | Absolute path to the repo (where `main.py` lives). |
| **uv Executable Path** | _(blank → auto-detect)_ | Set this if `uv` isn't found. Common: `/opt/homebrew/bin/uv`. |
| **Linear API Key** | _(blank)_ | Optional. Stored encrypted by Raycast. Overrides config.json. |
| **Default Team ID** | _(blank)_ | Optional. Overrides config.json. |
| **Default State ID** | _(blank)_ | Optional. State for new todos. Overrides config.json. |
| **Done State ID** | _(blank)_ | Optional. State used when completing todos. Overrides config.json. |
| **Timezone** | _(blank)_ | Optional, e.g. `America/New_York`. Overrides config.json. |

### Where credentials come from

The extension supports **two sources**, and you can mix them:

1. **Raycast preferences** (above) — any field you fill in is passed to the CLI
   as a `LINEAR_*` environment variable for that run.
2. **The CLI's own config** — `~/.config/linear-todos/config.json` and any
   `LINEAR_*` vars already in your environment.

**Precedence:** a non-empty Raycast preference *overrides* the matching value in
`config.json` (it's injected as an env var, and the CLI already lets env vars win
over the config file). Leave a preference blank to fall back to `config.json`.

This means you can run the extension with **zero Raycast credentials** (relying
entirely on `config.json`), or set everything in Raycast and skip
`config.json` — or anything in between.

> Raycast extensions run with a minimal `PATH`, so `uv` is resolved from a few
> known install locations (`/opt/homebrew/bin`, `/usr/local/bin`,
> `~/.local/bin`, `~/.cargo/bin`). If yours lives elsewhere, set the **uv
> Executable Path** preference.

## Notes

- This is a **local/dev extension**, not a Raycast Store submission — it depends
  on a local Python repo and `uv`. A store-ready version would reimplement the
  Linear API in TypeScript.
- All Linear network access still flows through the audited
  `src/linear_todos/api.py`. The extension adds no new network surface.
