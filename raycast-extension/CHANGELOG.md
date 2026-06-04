# Linear Todos Changelog

## [Remind improvements] - {PR_MERGE_DATE}

- Renamed the Remind command to **Remind me to**.
- Append a `!<priority>` marker to a reminder to set its priority: `!urgent`
  (or `!important`), `!high`, `!medium`, `!low`, `!none`.
- After creating a reminder, jump to the List Todos view instead of closing.
- Urgent todos are highlighted in List Todos with a red exclamation icon.

## [Streamline commands] - {PR_MERGE_DATE}

- Focused the extension on **List Todos**, **Remind**, and **Setup**.
- Removed the Create Todo, Daily Review, and Morning Digest commands (List
  Todos already groups by urgency; Remind covers quick-add).
- Remind now dismisses the Raycast window and clears the prompt after a
  successful quick-add.

## [Native rewrite] - {PR_MERGE_DATE}

- Rewritten as a native TypeScript extension using `@linear/sdk` and Raycast
  OAuth — no external CLI, Python, or `uv` dependency.
- Connect with one click; tokens are managed and synced by Raycast.
- Commands: List Todos, Create Todo, Remind, Daily Review, Morning Digest, Setup.
- Smart natural-language date parsing (today, tomorrow, next Monday, in 3 days,
  by eod/eow/eom, and more).
- Setup command to pick your todo team and workflow states by name.
