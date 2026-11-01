---
name: linear-todos
description: Use when Kyle wants to add, list, review, finish or snooze a todo or reminder in his Linear TODO team from Claude Duet ("remind me to call mom by eod !high", "what's on my plate", "mark TODO-12 done", "push that to next Monday"), and when a routine asks for his morning digest or evening review. Works only through the Linear connector; no API key, CLI or cron.
---

# Linear todos in Duet

Kyle keeps his personal todos in the **TODO** team of his Linear workspace. This
skill is the Duet version of his `linear-todos` CLI: same date rules, same
priority marker, same review buckets, but every read and write goes through the
**Linear connector** (`list_issues`, `get_issue`, `save_issue`,
`list_issue_statuses`). Never ask for a Linear API key and never run the Python
CLI from Duet.

## The team

- Team: `TODO`. Look up its statuses with `list_issue_statuses` if one of the
  names below fails; don't guess IDs.
- Open statuses: `Backlog`, `Todo`, `In Progress`. Closed: `Done`, `Canceled`,
  `Stale`, `Duplicate`.
- The team is shared with family. Many open issues belong to other people
  (often labeled with their name, like `chloe` or `elise`). **"Kyle's todos"
  means issues assigned to him (`assignee: "me"`) or labeled `kyle`.** Show the
  whole team only when he asks for everything or names someone else.
- **Ignored issues are invisible to this skill.** An issue is ignored when it
  is labeled `claude-ignore`, or when its project carries the `claude-ignore`
  project label (so Kyle can hide a whole project without tagging each issue).
  Leave ignored issues out of lists, the digest, the review, counts and
  suggestions, and don't pick one when matching an issue by its words for done
  or snooze. Only touch one when Kyle names it by identifier (for example "mark
  TODO-69 done").
- **How to drop them.** `list_issues` can't exclude a label, so filter
  yourself:
  1. Call `list_projects` with `label: "claude-ignore"` and fields `uuid` and
     `name` (no team filter). These are the ignored projects. An empty result
     is normal: it means no project is ignored right now.
  2. Ask `list_issues` for the `labels` and `projectId` fields, and drop every
     issue labeled `claude-ignore` or whose `projectId` matches one of those
     project `uuid`s. Issues with no project are only dropped by their own
     label.
- Kyle's time zone is `America/New_York`. Every "today", "end of day" and
  "this week" is his Eastern date, not UTC.

## Adding a todo

Create with `save_issue`: `team: "TODO"`, `state: "Todo"`, `assignee: "me"`,
the parsed `title`, and `dueDate` / `priority` when the text sets them. Add a
`description` only when he gives one. Reply with the identifier, title, due
date and priority you set, in one line.

Parse his text the way the CLI's `remind` command does, in this order:

1. **Strip a leading prefix**: "remind me to ", "remind me about ",
   "remind me ", "remind to ", "remind ".
2. **Trailing priority marker** `!<word>` sets priority and is removed from the
   title before dates are read:
   `!urgent` or `!important` → 1 (Urgent), `!high` → 2, `!medium` → 3,
   `!low` → 4, `!none` → 0. No marker means no priority.
3. **Due date** at the end of the text, removed from the title:
   - "by end of day" / "by eod" → today
   - "by end of week" / "by eow" → this Friday (today if it's Friday; next
     Friday if today is Saturday or Sunday)
   - "by end of month" / "by eom" → last day of this month
   - "on <date>" or "by <date>" → that date (rules below)
   - otherwise a bare date as the last words ("call mom tomorrow")
4. **Title**: what's left, trimmed, first letter capitalized.

Date words (from `dates.py`, the source of truth):

| Text | Date |
|------|------|
| today / tomorrow | today / +1 day |
| in N days, in N weeks | +N days, +7N days |
| Monday … Sunday, "this Monday" | the next one after today, never today |
| "next Monday" | the one after that: always 8 to 14 days out |
| "in 2 weeks on Monday" | +14 days, then forward to the next Monday |
| 2026-04-15 | that date |
| anything else ("Dec 3", "the 15th") | the nearest future date it names |

Explicit "when" words: "day" → today, "week" → +7 days, "month" → +28 days.

Pass `dueDate` as a plain `YYYY-MM-DD` (Linear due dates have no time). If the
date words are ambiguous ("next weekend"), pick the reading above, say which
date you used, and he can correct it.

Examples, if today is Wednesday:
- "remind me to call mom by eod !high" → "Call mom", due today, High.
- "pay rent on the 1st" → "Pay rent", due the next 1st of a month.
- "dentist next Monday" → "Dentist", due Monday 12 days out.
- "fertilize the garden by eow !urgent" → "Fertilize the garden", due Friday,
  Urgent.

## Listing

"What's on my plate" / "list my todos": `list_issues` with `team: "TODO"`,
`assignee: "me"`, then again with `label: "kyle"`; merge, drop duplicates and
anything in a closed status. Ask for fields `title`, `status`, `dueDate`,
`priority`, `url`, `labels`, `projectId`, and drop ignored issues as above.
Group them like the review below. Link each item on its identifier using the
`url` Linear returns.

## Done and snooze

- **Done**: `save_issue` with `id: "TODO-123"`, `state: "Done"`. If he names
  it by words instead of an identifier, find it with `list_issues` and
  `query`; if more than one open issue matches, ask which.
- **Snooze**: `save_issue` with `id` and a new `dueDate` from the date rules.
  No date given means tomorrow.
- Reply in one line: "Done: TODO-123 Call mom" / "Moved TODO-123 to Mon Nov 9".

## Morning digest and evening review: fixed formats

Both use the exact format the old CLI's `digest` and `review` commands printed
(`src/linear_todos/cli.py`). Copy the templates below character for character.
Add no other text: no intro, no summary, no closing line, no extra sections,
headings, counts or commentary. The only parts that change are the greeting
picked from the list and the item lines.

**Which items.** Kyle's open items: TODO-team issues in Backlog, Todo or In
Progress that are assigned to him (`assignee: "me"`) or labeled `kyle`, minus
ignored issues (labeled `claude-ignore`, or in a project with the
`claude-ignore` project label). Fetch the ignored projects with `list_projects`
and `label: "claude-ignore"`, fetch both issue lists with the `labels`,
`projectId` and `dueDate` fields, merge, drop duplicates, then drop ignored
issues.
Items labeled `optional` are treated like any other item.

**Dates.** Compare due dates to today's date in America/New_York.

**Item line.** Every item is exactly this line, two spaces before the bullet:

```
  • [TODO-12](https://linear.app/avegancafe/issue/TODO-12): Title as written in Linear
```

Within a section, order items by due date (oldest first), then by identifier.

### Morning digest (routine, 8am)

Items: overdue or due today.

If there are any, pick one greeting from this list exactly as written:

- 🌅 Rise and grind!
- ☕ Morning! Coffee's brewing, here's what's cooking:
- 🌞 Good morning — let's knock these out:
- ✨ Today's the day to tackle:
- 🚀 Morning! Here's your hit list:
- 🎯 Locked and loaded for today:
- 🌤️ Rise and shine, here's what's due:

and post:

```
<greeting>

  • [TODO-12](https://linear.app/avegancafe/issue/TODO-12): Title
  • [TODO-15](https://linear.app/avegancafe/issue/TODO-15): Title
```

If there are none, post only one line picked from this list exactly as written:

- 🌅 Morning! Nothing urgent today — you're free.
- ☕ Coffee time, no fires to put out today.
- 🌞 Good morning! Clear skies, zero TODOs.
- ✨ Morning! Looks like a chill day ahead.

### Evening review (routine, 5pm)

Groups: **Do Today** is overdue or due today; **By End of Week** is due 1 to 7
days from today; **By End of Month** is due 8 to 28 days from today; **No Due
Date** is items with no due date. Items due more than 28 days out are left out.
Post exactly:

```
**🚨 Do Today:**
<item lines, or "  • nothing to see here">

**📊 Board Overview:**

**By End of Week:**
<item lines, or "  • nothing to see here">

**By End of Month:**
<item lines, or "  • nothing to see here">

**No Due Date:**
<item lines>
```

Leave out the blank line and the whole **No Due Date:** block when no item lacks
a due date. Never leave out the other three headings.

## Things not to do

- Don't create issues in another team, or assign them to someone else, unless
  he says so.
- Don't close, cancel or move issues that aren't his without asking.
- Don't change statuses, labels or projects in bulk.
