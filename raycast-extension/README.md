# Linear Todos

Manage your Linear todos from Raycast with smart natural-language date parsing.
Native TypeScript — connect with one click via Linear OAuth, no API keys or
external tools required.

## Commands

| Command | What it does |
|---------|--------------|
| **List Todos** | Browse todos grouped by urgency (overdue, today, this week, this month, later, no date). Mark done, snooze, open in Linear, copy ID. |
| **Remind Me to** | Quick-add a todo from one natural-language argument, e.g. `call mom by eod`. Add `!important` to mark it urgent. |
| **Setup** | Pick your todo team and workflow states by name. |

## Getting started

1. Run any command and connect your Linear account when prompted (OAuth).
2. Run **Setup** to choose your todo team, the state for new todos, and the
   "done" state. If your workspace has a single team, this is auto-detected on
   first use.
3. Start adding and reviewing todos.

## Natural-language dates

The **Remind** command understands:

- `today`, `tomorrow`
- `in 3 days`, `in 2 weeks`
- `next Monday`, `this Friday`, bare weekdays like `friday`
- `by end of day` / `eod`, `by end of week` / `eow`, `by end of month` / `eom`
- ISO dates like `2025-04-15`
- …and more, via natural-language parsing.

Add `!important` (or `!urgent`) at the end to set the todo to **Urgent**
priority; the marker is stripped from the title.

Reminder examples (via the **Remind Me to** command):

- `remind me to call mom by end of day`
- `review PR by eow`
- `meeting on Friday`
- `pay taxes by 2025-04-15`
- `fix the build by eod !important`

## Preferences

| Preference | Purpose |
|------------|---------|
| **Timezone** | Optional IANA timezone (e.g. `America/New_York`) for end-of-day calculations. Defaults to your system timezone. |

## Notes

- Team and state selection are stored locally (and synced by Raycast) — set them
  via the **Setup** command.
- This extension is a native port of the `linear-todos` CLI. The CLI still
  exists in the parent repository for standalone and cron usage; cron digests
  are CLI-only.

## Development

```bash
npm install
npm run dev      # ray develop
npm test         # vitest (date parsing)
npm run lint
npm run build
```
