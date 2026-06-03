# Linear Todos Changelog

## [Native rewrite] - {PR_MERGE_DATE}

- Rewritten as a native TypeScript extension using `@linear/sdk` and Raycast
  OAuth — no external CLI, Python, or `uv` dependency.
- Connect with one click; tokens are managed and synced by Raycast.
- Commands: List Todos, Create Todo, Remind, Daily Review, Morning Digest, Setup.
- Smart natural-language date parsing (today, tomorrow, next Monday, in 3 days,
  by eod/eow/eom, and more).
- Setup command to pick your todo team and workflow states by name.
