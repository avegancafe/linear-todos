---
name: linear-todos
description: A CLI tool that executes Python source code to manage todos via Linear's API. Creates tasks with natural language dates, priorities, and scheduling. This is a source-execution skill - code in src/linear_todos/ runs when commands are invoked.
author: K
tags: [todos, linear, tasks, reminders, productivity]
metadata:
  openclaw:
    primaryEnv: LINEAR_API_KEY
    requires:
      env: [LINEAR_API_KEY]
      config: [~/.config/linear-todos/config.json]
    install:
      - kind: uv
        id: linear-todos
        label: Linear Todos CLI
---

# Linear Todos

> **⚠️  This is a SOURCE-EXECUTION skill.** The agent runs Python code from `src/linear_todos/` when you invoke CLI commands. This is **not** instruction-only. Review `src/linear_todos/api.py` before first use.
>
> **🔐 Security Note:** This skill stores your Linear API key in plaintext JSON at `~/.config/linear-todos/config.json` **only if you run the `setup` command**. Use a dedicated API key with minimal scope. The key is only used for Linear API calls and is never transmitted elsewhere. Prefer environment variables (`LINEAR_API_KEY`) to avoid persisted state.
>
> **Audit Info:** This skill makes HTTPS requests **only** to `api.linear.app` (Linear's official GraphQL API). No data is sent elsewhere. See `src/linear_todos/api.py` for the API client implementation.

## Credentials

| Variable | Required | Description |
|----------|----------|-------------|
| `LINEAR_API_KEY` | **Yes** | Your Linear API key from [linear.app/settings/api](https://linear.app/settings/api) |
| `LINEAR_TEAM_ID` | No | Default team ID for todos |
| `LINEAR_STATE_ID` | No | Default state for new todos |
| `LINEAR_DONE_STATE_ID` | No | State for completed todos |
| `LINEAR_TIMEZONE` | No | Your local timezone (e.g., `America/New_York`, `Europe/London`). Used for "end of day" calculations. Falls back to OpenClaw `USER.md` timezone if available. |

**Config Path:** `~/.config/linear-todos/config.json` (created by `setup`, permissions 0o600)

## Security & Auditing

### What This Skill Does

- **HTTP Requests:** Makes HTTPS requests **only** to `https://api.linear.app/graphql` (Linear's official API). No telemetry, no third-party services.
- **Data Storage:** Stores your API key and config in `~/.config/linear-todos/config.json` (plaintext, permissions 0o600) **only if you run the `setup` command**. Team/issue data is fetched fresh each run — nothing is cached locally except your config.
- **Runtime Behavior:** This skill runs from bundled Python source code (not preinstalled system tools). The agent executes `main.py` and code in `src/linear_todos/` when you run CLI commands.
- **Setup Behavior:** During interactive setup, the wizard temporarily sets `LINEAR_API_KEY` in the process environment to test the key. This is only during the setup session and is not persisted.
- **No Auto-Enable:** Does not request platform privileges (`always: false`). Will not auto-enable itself for all agents.
- **Code Locations:**
  - `src/linear_todos/api.py` — All HTTP requests to Linear
  - `src/linear_todos/config.py` — Config file handling
  - `src/linear_todos/setup_wizard.py` — Interactive setup
  - `src/linear_todos/cli.py` — CLI commands

### Recommended Security Practices

1. **Use a dedicated API key:** Create a separate Linear API token with minimal scope for this skill. Revoke it if you uninstall or stop using the skill.
2. **Prefer environment variables:** Set `LINEAR_API_KEY` in your shell instead of running `setup` — no plaintext file is created.
3. **Audit the code:** Review `src/linear_todos/api.py` to verify HTTP destinations before first use.
4. **Run initial setup in isolation:** If unsure, run the skill in a container/VM for the first setup to inspect behavior.

### Cron Jobs (Optional)

Linear Todos has built-in cron job management through the `cron` command group.

#### Quick Setup

```bash
# Interactive setup (runs during initial setup wizard, or run manually)
uv run python main.py cron setup

# Check status
uv run python main.py cron status

# Remove all jobs
uv run python main.py cron remove
```

The setup will:
- Detect your timezone (from config or USER.md)
- Create morning digest (default: 8 AM local time)
- Create evening review (default: 5 PM local time)
- Handle UTC conversion automatically

#### Manual Hermes Cron (Alternative)

If you prefer to use Hermes cron directly:

```bash
# Morning digest at 8am ET (13:00 UTC)
hermes cron create --name "linear-todos-morning" --schedule "0 13 * * *" \
  --prompt "Run linear-todos digest" --skill linear-todos

# Evening review at 5pm ET (22:00 UTC)  
hermes cron create --name "linear-todos-evening" --schedule "0 22 * * *" \
  --prompt "Run linear-todos review" --skill linear-todos
```

**Note:** Cron expressions require the `croniter` package in the Hermes environment.

#### System Crontab (Alternative)

If you prefer system cron, review the examples in `cron-jobs.txt` and add them to your crontab with `crontab -e`.

A powerful todo management system built on Linear with smart date parsing, priorities, and a complete CLI workflow.

## Quick Start

```bash
# Setup (run once)
uv run python main.py setup

# Create todos
uv run python main.py create "Call mom" --when day
uv run python main.py create "Pay taxes" --date 2025-04-15
uv run python main.py create "Review PR" --priority high --when week

# Natural language dates
uv run python main.py create "Meeting prep" --date "tomorrow"
uv run python main.py create "Weekly report" --date "next Monday"
uv run python main.py create "Dentist" --date "in 3 days"

# Manage todos
uv run python main.py list
uv run python main.py done ABC-123
uv run python main.py snooze ABC-123 "next week"

# Daily review
uv run python main.py review
```

## Hermes/NemoClaw Setup Guide

When using this skill in Hermes/NemoClaw:

### 1. Setup

The agent can run the setup wizard for you, but it needs your Linear API key first:

```bash
# Get your API key from https://linear.app/settings/api
# Then either:
export LINEAR_API_KEY="lin_api_..."
uv run python main.py setup
```

Or the agent can create the config file directly if you provide the key and preferred team.

### 2. Daily Digest Cron Jobs

The skill now has built-in cron management. The easiest way is during setup:

```bash
# Run setup (includes cron configuration)
uv run python main.py setup

# Or configure cron separately
uv run python main.py cron setup
```

This will:
- Detect your timezone from config or USER.md
- Create morning digest at 8 AM local time
- Create evening review at 5 PM local time
- Handle UTC conversion automatically

**Note:** The skill's `digest` command shows overdue/today's todos with fun greetings. The `review` command shows a full board overview organized by urgency.

**Check status:**
```bash
uv run python main.py cron status
```

### 3. Troubleshooting

- **"No Linear API key found"**: Set `LINEAR_API_KEY` env var or run setup
- **"Team ID not configured"**: Run setup wizard or set `LINEAR_TEAM_ID`
- **Cron jobs not appearing**: Make sure `hermes` CLI is available in PATH
- **Wrong cron times**: Check your timezone is set correctly (config or USER.md)

## Setup

### 1. Get API Key

Get your API key from [linear.app/settings/api](https://linear.app/settings/api). **Recommendation:** Create a dedicated API key with minimal scope for this skill.

### 2. Run Setup

```bash
uv run python main.py setup
```

This interactive wizard will:
- Verify your API key
- List your Linear teams
- Let you select your todo team
- Configure initial and done states
- Save settings to `~/.config/linear-todos/config.json` (plaintext JSON)

### 3. Manual Configuration (optional)

Instead of running setup, you can use environment variables:

```bash
export LINEAR_API_KEY="lin_api_..."
export LINEAR_TEAM_ID="your-team-id"
export LINEAR_STATE_ID="your-todo-state-id"
export LINEAR_DONE_STATE_ID="your-done-state-id"
```

Or create `~/.config/linear-todos/config.json`:

```json
{
  "apiKey": "lin_api_...",
  "teamId": "team-uuid",
  "stateId": "todo-state-uuid",
  "doneStateId": "done-state-uuid",
  "timezone": "America/New_York"
}
```

## Commands

### create

Create a new todo with optional timing, priority, and description.

```bash
uv run python main.py create "Title" [options]

Options:
  --when day|week|month     Relative due date
  --date DATE               Specific due date (supports natural language)
  --priority LEVEL          urgent, high, normal, low, none
  --desc "Description"      Add description
```

**Natural Date Examples:**

```bash
uv run python main.py create "Task" --date "tomorrow"
uv run python main.py create "Task" --date "Friday"
uv run python main.py create "Task" --date "next Monday"
uv run python main.py create "Task" --date "in 3 days"
uv run python main.py create "Task" --date "in 2 weeks"
uv run python main.py create "Task" --date "2025-04-15"
```

**Complete Examples:**

```bash
# Due by end of today
uv run python main.py create "Call mom" --when day

# Due in 7 days
uv run python main.py create "Submit report" --when week

# Specific date with high priority
uv run python main.py create "Launch feature" --date 2025-03-15 --priority high

# Natural language date with description
uv run python main.py create "Team meeting prep" --date "next Monday" --desc "Prepare slides"

# Urgent priority, due tomorrow
uv run python main.py create "Fix production bug" --priority urgent --date tomorrow
```

### remind

Create a todo from natural language reminder text. This is the easiest way to quickly add todos with due dates.

```bash
uv run python main.py remind "reminder text"
```

**Supported Patterns:**

| Pattern | Example | Due Date |
|---------|---------|----------|
| by end of day / eod | `"call mom by end of day"` | Today |
| by end of week / eow | `"review PR by eow"` | Friday of this week |
| by end of month / eom | `"submit report by eom"` | Last day of month |
| on [day] | `"meeting on Friday"` | Specific day |
| by [date] | `"pay taxes by April 15"` | Specific date |
| [bare date] | `"do something tomorrow"` | Tomorrow |

**Examples:**

```bash
# End of day patterns
uv run python main.py remind "call mom by end of day"
uv run python main.py remind "urgent bug fix by eod"

# End of week patterns  
uv run python main.py remind "review PRs by end of week"
uv run python main.py remind "submit report by eow"

# End of month patterns
uv run python main.py remind "finish documentation by eom"

# Specific days/dates
uv run python main.py remind "team meeting on next Monday"
uv run python main.py remind "pay taxes by 2025-04-15"

# With priority
uv run python main.py remind "urgent fix by eod" --priority urgent
```

**Natural prefixes supported:**
The command automatically strips these prefixes if present:
- `remind me to...`
- `remind me about...`
- `remind me...`
- `remind to...`
- `remind...`

### list

List all your todos.

```bash
uv run python main.py list [options]

Options:
  --all       Include completed todos
  --json      Output as JSON
```

### done

Mark a todo as completed.

```bash
uv run python main.py done ISSUE_ID

# Examples
uv run python main.py done TODO-123
uv run python main.py done ABC-456
```

### snooze

Reschedule a todo to a later date.

```bash
uv run python main.py snooze ISSUE_ID [when]

# Examples
uv run python main.py snooze TODO-123 "tomorrow"
uv run python main.py snooze TODO-123 "next Friday"
uv run python main.py snooze TODO-123 "in 1 week"
```

### review

Daily review command that organizes todos by urgency.

```bash
uv run python main.py review
```

Output sections:
- 🚨 **OVERDUE** - Past due date
- 📅 **Due Today** - Due today
- ⚡ **High Priority** - Urgent/high priority items
- 📊 **This Week** - Due within 7 days
- 📅 **This Month** - Due within 28 days
- 📝 **No Due Date** - Items without dates

### setup

Interactive setup wizard to configure your Linear integration.

```bash
uv run python main.py setup
```

This will guide you through:
- Verifying your API key
- Selecting your Linear team
- Configuring initial and done states
- Setting up daily cron digests (optional)
- Saving settings to `~/.config/linear-todos/config.json`

### cron

Manage scheduled cron jobs for daily digests.

```bash
# Setup cron jobs interactively
uv run python main.py cron setup

# Check cron job status
uv run python main.py cron status

# Remove all cron jobs
uv run python main.py cron remove
```

**Options for setup:**
- `--timezone`: Timezone (e.g., America/New_York, Europe/London)
- `--deliver`: Delivery target (origin, local, telegram)

The cron jobs will:
- Run morning digest at 8 AM local time
- Run evening review at 5 PM local time
- Automatically convert to UTC for scheduling
- Use your configured timezone or detect from USER.md

## For Agents

When the user asks for reminders or todos:

### 1. Use the `remind` Command (Recommended)

The `remind` command parses natural language automatically:

```bash
# "remind me to call mom by end of day"
uv run python main.py remind "call mom by end of day"

# "remind me to review the PR by end of week"
uv run python main.py remind "review PR by eow"

# "remind me about the meeting on Friday"
uv run python main.py remind "meeting on Friday"

# "remind me to pay taxes by April 15"
uv run python main.py remind "pay taxes by April 15"

# With priority
uv run python main.py remind "urgent bug fix by eod" --priority urgent
```

**Supported patterns:**
- `by end of day`, `by eod` - Due today
- `by end of week`, `by eow` - Due Friday
- `by end of month`, `by eom` - Due last day of month
- `on [day/date]` - Due specific day
- `by [date]` - Due specific date
- bare dates at end (e.g., "task tomorrow")

### 2. Determine Priority

Ask if not specified:
- **Urgent** (🔥) - Critical, do immediately
- **High** (⚡) - Important, do soon
- **Normal** (📌) - Standard priority (default)
- **Low** (💤) - Can wait

### 3. Daily Briefing

When asked "what do I have to do today", run:

```bash
uv run python main.py review
```

Present the output **exactly as formatted** - don't reformat or summarize.

### 4. Complete Todos

When user says they completed something, mark it done:

```bash
uv run python main.py done ISSUE-123
```

## Date Parsing Reference

| Input | Result |
|-------|--------|
| `today` | Today |
| `tomorrow` | Next day |
| `Friday` | Next occurrence of Friday |
| `next Monday` | Monday of next week |
| `this Friday` | Friday of current week (or next if passed) |
| `in 3 days` | 3 days from now |
| `in 2 weeks` | 14 days from now |
| `end of day`, `eod` | Today |
| `end of week`, `eow` | This Friday |
| `end of month`, `eom` | Last day of current month |
| `2025-04-15` | Specific date |

### Reminder Text Patterns

When using the `remind` command, these patterns are supported:

| Pattern | Example | Sets Due Date |
|---------|---------|---------------|
| `by end of day` / `by eod` | `"fix bug by eod"` | Today |
| `by end of week` / `by eow` | `"submit report by eow"` | This Friday |
| `by end of month` / `by eom` | `"finish docs by eom"` | Last day of month |
| `on [date]` | `"meeting on Friday"` | Specific day |
| `by [date]` | `"pay taxes by April 15"` | Specific date |
| bare date | `"task tomorrow"` | Tomorrow |

## Priority Levels

| Level | Number | Icon | Use For |
|-------|--------|------|---------|
| Urgent | 1 | 🔥 | Critical, blocking issues |
| High | 2 | ⚡ | Important, time-sensitive |
| Normal | 3 | 📌 | Standard tasks (default) |
| Low | 4 | 💤 | Nice-to-have, can wait |
| None | 0 | 📋 | No priority set |

## Timezone Support

By default, due dates are calculated in UTC (end of day = 23:59:59 UTC). To use your local timezone for "end of day" calculations:

```bash
# Set via environment variable
export LINEAR_TIMEZONE="America/New_York"

# Or add to config.json
{
  "timezone": "America/New_York"
}
```

**OpenClaw Integration:** If running inside an OpenClaw workspace, the skill will automatically detect your timezone from `USER.md` (e.g., `timezone: America/New_York`). No manual configuration needed!

When a timezone is configured:
- `--when day` sets due date to end of today in your timezone (converted to UTC for Linear)
- `--when week` sets due date to 7 days from now, end of day in your timezone
- `--date "tomorrow"` sets due date to end of tomorrow in your timezone

Common timezone values: `America/New_York`, `America/Los_Angeles`, `Europe/London`, `Europe/Paris`, `Asia/Tokyo`

## Configuration Precedence

Settings are loaded in this order (later overrides earlier):

1. Default values (none)
2. Config file: `~/.config/linear-todos/config.json`
3. Environment variables: `LINEAR_*`
4. Command-line flags: `--team`, `--state`

## Files

| File | Purpose |
|------|---------|
| `main.py` | Main entry point for the CLI |
| `src/linear_todos/cli.py` | CLI implementation with all commands |
| `src/linear_todos/api.py` | Linear API client |
| `src/linear_todos/config.py` | Configuration management |
| `src/linear_todos/dates.py` | Date parsing utilities |
| `src/linear_todos/setup_wizard.py` | Interactive setup wizard |
