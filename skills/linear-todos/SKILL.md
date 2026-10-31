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
`priority`, `url`, `labels`. Group them like the review below. Link each item
on its identifier using the `url` Linear returns.

## Done and snooze

- **Done**: `save_issue` with `id: "TODO-123"`, `state: "Done"`. If he names
  it by words instead of an identifier, find it with `list_issues` and
  `query`; if more than one open issue matches, ask which.
- **Snooze**: `save_issue` with `id` and a new `dueDate` from the date rules.
  No date given means tomorrow.
- Reply in one line: "Done: TODO-123 Call mom" / "Moved TODO-123 to Mon Nov 9".

## Morning digest (routine, 8am)

Kyle's items are open TODO-team issues (Backlog, Todo or In Progress) assigned
to him or labeled `kyle`. Many of them have no due date, so a digest of only
dated items is often empty; the Up next section is what keeps it useful.

Post, skipping any empty section:

1. One short friendly opening line, not the same one every day.
2. **Overdue and due today**: due on or before today (Eastern), oldest first,
   with "overdue since <date>" when late.
3. **In progress**.
4. **Up next**: his Todo items with no due date, Urgent and High first, at most
   5, each with its priority.
5. One closing line counting the rest: "Also N in backlog (M optional)."

Items labeled `optional` stay out of sections 2 to 4; they're only counted. One
line per item: linked identifier, title, and the priority when it's Urgent or
High. If sections 2 to 4 are all empty, say "Nothing on your plate today" and
give the backlog count.

## Evening review (routine, 5pm)

All of Kyle's open items (same definition as the digest), grouped by due date
in Eastern time:

- **Do today**: overdue or due today
- **This week**: due in the next 7 days
- **This month**: due in 8 to 28 days
- **No date**, split into **Todo** (Urgent and High first) and **Backlog**

Leave out items due more than 28 days out. Write "nothing here" under an empty
dated group. Put items labeled `optional` in one closing line that counts them
and gives their identifiers. End with at most one line naming anything overdue
by more than a week, so he can finish, snooze or drop it. One line per item:
linked identifier, title, and the priority when it's Urgent or High.

## Things not to do

- Don't create issues in another team, or assign them to someone else, unless
  he says so.
- Don't close, cancel or move issues that aren't his without asking.
- Don't change statuses, labels or projects in bulk.
