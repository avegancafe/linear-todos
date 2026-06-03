import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { promisify } from 'node:util'
import { getPreferenceValues } from '@raycast/api'

const execFileAsync = promisify(execFile)

interface Preferences {
  repoPath?: string
  uvPath?: string
  apiKey?: string
  teamId?: string
  stateId?: string
  doneStateId?: string
  timezone?: string
}

/** Raw issue node shape emitted by `main.py list --json`. */
export interface Todo {
  id: string
  identifier: string
  title: string
  description?: string | null
  priority: number
  dueDate?: string | null
  archivedAt?: string | null
  state?: { id: string; name: string; type: string } | null
  assignee?: { id: string; name: string } | null
}

/** Error type that carries enough context for the UI to guide the user. */
export class CliError extends Error {
  readonly stderr: string
  readonly isConfigIssue: boolean
  constructor(message: string, stderr = '', isConfigIssue = false) {
    super(message)
    this.name = 'CliError'
    this.stderr = stderr
    this.isConfigIssue = isConfigIssue
  }
}

const COMMON_UV_PATHS = [
  '/opt/homebrew/bin/uv',
  '/usr/local/bin/uv',
  `${process.env.HOME ?? ''}/.local/bin/uv`,
  `${process.env.HOME ?? ''}/.cargo/bin/uv`,
]

/**
 * Resolve the `uv` binary. Raycast extensions inherit a minimal PATH, so we
 * cannot rely on `uv` being discoverable by name. Preference wins, then known
 * install locations, then a bare "uv" as a last resort.
 */
function resolveUv(): string {
  const { uvPath } = getPreferenceValues<Preferences>()
  if (uvPath && uvPath.trim().length > 0) {
    const trimmed = uvPath.trim()
    if (!existsSync(trimmed)) {
      throw new CliError(
        `Configured uv path does not exist: ${trimmed}`,
        '',
        true
      )
    }
    return trimmed
  }
  for (const candidate of COMMON_UV_PATHS) {
    if (candidate && existsSync(candidate)) {
      return candidate
    }
  }
  // Fall back to PATH lookup; will surface a clear error if missing.
  return 'uv'
}

function resolveRepoPath(): string {
  const { repoPath } = getPreferenceValues<Preferences>()
  const resolved = repoPath?.trim()
  if (!resolved || resolved.length === 0) {
    throw new CliError(
      'Linear Todos repo path is not set. Open extension preferences and set it.',
      '',
      true
    )
  }
  if (!existsSync(resolved)) {
    throw new CliError(
      `Linear Todos repo path does not exist: ${resolved}`,
      '',
      true
    )
  }
  if (!existsSync(`${resolved}/main.py`)) {
    throw new CliError(
      `No main.py found at ${resolved}. Check the repo path in preferences.`,
      '',
      true
    )
  }
  return resolved
}

/**
 * Build the environment for the CLI. Any credential preference that is set in
 * Raycast is injected as the corresponding LINEAR_* env var, which the CLI's
 * Config loader applies on top of (overriding) ~/.config/linear-todos/config.json.
 * Empty preferences are omitted, so the CLI falls back to its existing config.
 */
function buildEnv(): NodeJS.ProcessEnv {
  const prefs = getPreferenceValues<Preferences>()
  const env: NodeJS.ProcessEnv = { ...process.env }

  const mapping: [keyof Preferences, string][] = [
    ['apiKey', 'LINEAR_API_KEY'],
    ['teamId', 'LINEAR_TEAM_ID'],
    ['stateId', 'LINEAR_STATE_ID'],
    ['doneStateId', 'LINEAR_DONE_STATE_ID'],
    ['timezone', 'LINEAR_TIMEZONE'],
  ]

  for (const [prefKey, envVar] of mapping) {
    const value = prefs[prefKey]?.trim()
    if (value && value.length > 0) {
      env[envVar] = value
    }
  }

  return env
}

/**
 * Distill CLI output into a single human-readable line. The CLI emits clean
 * "Error: …" lines for handled cases, but unhandled exceptions (e.g. a bad API
 * key) produce a Python traceback. Prefer a friendly line over dumping it all.
 */
function extractMessage(
  stderr: string,
  stdout: string,
  fallback: string
): string {
  const lines = `${stderr}\n${stdout}`
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  // 1) The CLI's own "Error: …" messages.
  const errorLine = lines.find((l) => l.startsWith('Error:'))
  if (errorLine) {
    return errorLine.replace(/^Error:\s*/, '')
  }

  // 2) Common HTTP/auth failures from a raised exception.
  const httpLine = lines.find((l) => /HTTPError|Unauthorized|\b40\d\b/.test(l))
  if (httpLine) {
    if (/401|Unauthorized/.test(httpLine)) {
      return 'Linear rejected the request (401 Unauthorized). Check your API key.'
    }
    return httpLine.replace(/^[\w.]+Error:\s*/, '')
  }

  // 3) Last line of a traceback (often the exception summary).
  const exceptionLine = [...lines]
    .reverse()
    .find((l) => /Error|Exception/.test(l))
  if (exceptionLine) {
    return exceptionLine
  }

  return fallback
}

/** Heuristic: does the CLI error look like a setup/config problem? */
function looksLikeConfigIssue(text: string): boolean {
  const t = text.toLowerCase()
  return (
    t.includes('api key') ||
    t.includes('team id not configured') ||
    t.includes('not configured') ||
    t.includes("run 'uv run python main.py setup'")
  )
}

/**
 * Run the linear-todos CLI: `uv run python main.py <args...>` in the repo dir.
 * Arguments are passed as an argv array (no shell), so values are not subject
 * to shell interpretation/injection.
 */
export async function runCli(args: string[]): Promise<string> {
  const repoPath = resolveRepoPath()
  const uv = resolveUv()

  try {
    const { stdout } = await execFileAsync(
      uv,
      ['run', 'python', 'main.py', ...args],
      {
        cwd: repoPath,
        timeout: 60_000,
        maxBuffer: 10 * 1024 * 1024,
        env: buildEnv(),
      }
    )
    return stdout
  } catch (err) {
    const e = err as NodeJS.ErrnoException & {
      stderr?: string
      stdout?: string
    }
    if (e.code === 'ENOENT') {
      throw new CliError(
        'Could not find `uv`. Set the uv path in extension preferences.',
        '',
        true
      )
    }
    const stderr = (e.stderr ?? '').toString().trim()
    const stdout = (e.stdout ?? '').toString().trim()
    const message = extractMessage(stderr, stdout, e.message)
    // Preserve full output for the Detail view; classify on the full text.
    const fullOutput = [stderr, stdout].filter(Boolean).join('\n') || e.message
    throw new CliError(
      message,
      fullOutput,
      looksLikeConfigIssue(`${message}\n${fullOutput}`)
    )
  }
}

/** Fetch todos as structured data via `list --json`. */
export async function listTodos(includeCompleted = false): Promise<Todo[]> {
  const args = ['list', '--json']
  if (includeCompleted) {
    args.push('--all')
  }
  const out = await runCli(args)
  const trimmed = out.trim()
  if (!trimmed) {
    return []
  }
  try {
    const parsed = JSON.parse(trimmed) as Todo[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    throw new CliError(`Could not parse todo list output as JSON.`, trimmed)
  }
}

export async function markDone(identifier: string): Promise<string> {
  return runCli(['done', identifier])
}

export async function snoozeTodo(
  identifier: string,
  when: string
): Promise<string> {
  return runCli(['snooze', identifier, when])
}

export interface CreateOptions {
  title: string
  priority?: string
  when?: string
  date?: string
  description?: string
}

export async function createTodo(opts: CreateOptions): Promise<string> {
  const args = ['create', opts.title]
  if (opts.priority && opts.priority !== 'unset') {
    args.push('--priority', opts.priority)
  }
  if (opts.when) {
    args.push('--when', opts.when)
  } else if (opts.date && opts.date.trim().length > 0) {
    args.push('--date', opts.date.trim())
  }
  if (opts.description && opts.description.trim().length > 0) {
    args.push('--desc', opts.description.trim())
  }
  return runCli(args)
}

export async function remind(text: string): Promise<string> {
  return runCli(['remind', text])
}

/** Construct the Linear issue URL from an identifier. */
export function issueUrl(identifier: string): string {
  return `https://linear.app/issue/${identifier}`
}

export const PRIORITY_LABELS: Record<number, string> = {
  0: 'None',
  1: 'Urgent',
  2: 'High',
  3: 'Normal',
  4: 'Low',
}

export const PRIORITY_ICONS: Record<number, string> = {
  0: '📋',
  1: '🔥',
  2: '⚡',
  3: '📌',
  4: '💤',
}
