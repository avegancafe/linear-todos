/**
 * Persisted setup: which team and workflow states to use. Stored in
 * LocalStorage (synced by Raycast), with auto-resolution that mirrors the
 * CLI's setup wizard (single team; first unstarted state for new todos; first
 * completed state for done).
 */
import { LocalStorage } from '@raycast/api'
import { getTeamStates, getTeams } from './linear'

const STORAGE_KEY = 'linear-todos-settings'

export interface Settings {
  teamId: string
  teamName?: string
  stateId: string
  stateName?: string
  doneStateId: string
  doneStateName?: string
}

export async function loadSettings(): Promise<Settings | null> {
  const raw = await LocalStorage.getItem<string>(STORAGE_KEY)
  if (!raw) {
    return null
  }
  try {
    const parsed = JSON.parse(raw) as Partial<Settings>
    if (parsed.teamId && parsed.stateId && parsed.doneStateId) {
      return parsed as Settings
    }
    return null
  } catch {
    return null
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  await LocalStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

export async function clearSettings(): Promise<void> {
  await LocalStorage.removeItem(STORAGE_KEY)
}

/** Raised when configuration can't be auto-resolved and setup is required. */
export class SetupRequiredError extends Error {
  constructor(message = 'Setup required. Run the Setup command first.') {
    super(message)
    this.name = 'SetupRequiredError'
  }
}

/**
 * Return usable settings: stored ones if present, otherwise attempt to
 * auto-resolve. Auto-resolution only succeeds when the workspace has exactly
 * one team and the needed state types exist; otherwise SetupRequiredError is
 * thrown so the command can point the user at the Setup command.
 */
export async function resolveSettings(): Promise<Settings> {
  const stored = await loadSettings()
  if (stored) {
    return stored
  }

  const teams = await getTeams()
  if (teams.length !== 1) {
    throw new SetupRequiredError(
      teams.length === 0
        ? 'No Linear teams found for your account.'
        : 'Multiple teams found. Run the Setup command to pick one.'
    )
  }

  const team = teams[0]
  const states = await getTeamStates(team.id)
  const newState = states.find((s) => s.type === 'unstarted') ?? states[0]
  const doneState = states.find((s) => s.type === 'completed')

  if (!newState || !doneState) {
    throw new SetupRequiredError(
      'Could not auto-detect workflow states. Run the Setup command.'
    )
  }

  const resolved: Settings = {
    teamId: team.id,
    teamName: team.name,
    stateId: newState.id,
    stateName: newState.name,
    doneStateId: doneState.id,
    doneStateName: doneState.name,
  }

  // Cache so we don't re-resolve every run.
  await saveSettings(resolved)
  return resolved
}
