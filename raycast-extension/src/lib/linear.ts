/**
 * Linear data layer built on @linear/sdk — the native replacement for the
 * Python CLI's api.py. Provides typed todos and the create/update/list
 * operations the commands need.
 */
import type { Issue, LinearClient, WorkflowState } from '@linear/sdk'
import { getLinearClient } from './oauth'

type IssueCreateInput = Parameters<LinearClient['createIssue']>[0]
type IssueUpdateInput = Parameters<LinearClient['updateIssue']>[1]

/** Flat, serializable todo shape used across the UI. */
export interface Todo {
  id: string
  identifier: string
  title: string
  description?: string | null
  priority: number
  dueDate?: string | null
  url: string
  stateName?: string | null
  stateType?: string | null
  assigneeName?: string | null
}

export interface TeamOption {
  id: string
  key: string
  name: string
}

export interface StateOption {
  id: string
  name: string
  type: string
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

const PRIORITY_TO_NUMBER: Record<string, number> = {
  urgent: 1,
  high: 2,
  normal: 3,
  low: 4,
  none: 0,
}

export function priorityToNumber(priority: string): number | undefined {
  return PRIORITY_TO_NUMBER[priority.toLowerCase()]
}

export function priorityToLabel(priority: number): string {
  return PRIORITY_LABELS[priority] ?? 'None'
}

/** Resolve an Issue (with its async state/assignee) into a flat Todo. */
async function toTodo(issue: Issue): Promise<Todo> {
  const [state, assignee] = await Promise.all([
    issue.state as Promise<WorkflowState | undefined>,
    issue.assignee,
  ])
  return {
    id: issue.id,
    identifier: issue.identifier,
    title: issue.title,
    description: issue.description ?? null,
    priority: issue.priority ?? 0,
    dueDate: issue.dueDate ?? null,
    url: issue.url,
    stateName: state?.name ?? null,
    stateType: state?.type ?? null,
    assigneeName: assignee?.name ?? null,
  }
}

/**
 * List todos for a team. Completed/canceled issues are filtered out client-side
 * unless includeCompleted is set — matching the CLI's get_team_issues behavior.
 */
export async function listTodos(
  teamId: string,
  includeCompleted = false
): Promise<Todo[]> {
  const client = getLinearClient()
  const team = await client.team(teamId)
  const connection = await team.issues({ first: 100 })
  const todos = await Promise.all(
    connection.nodes.map((issue) => toTodo(issue))
  )

  const visible = todos.filter((t) => {
    if (includeCompleted) {
      return true
    }
    return t.stateType !== 'completed' && t.stateType !== 'canceled'
  })

  return visible
}

export interface CreateTodoInput {
  teamId: string
  title: string
  description?: string
  stateId?: string
  priority?: number
  dueDate?: string | null
}

export async function createTodo(input: CreateTodoInput): Promise<Todo> {
  const client = getLinearClient()
  const payload: IssueCreateInput = {
    teamId: input.teamId,
    title: input.title,
  }
  if (input.description) {
    payload.description = input.description
  }
  if (input.stateId) {
    payload.stateId = input.stateId
  }
  if (input.priority !== undefined) {
    payload.priority = input.priority
  }
  if (input.dueDate) {
    // Linear's dueDate is a TimelessDate (YYYY-MM-DD).
    payload.dueDate = input.dueDate.split('T')[0]
  }

  const result = await client.createIssue(payload)
  const issue = await result.issue
  if (!result.success || !issue) {
    throw new Error('Failed to create issue.')
  }
  return toTodo(issue)
}

export async function updateTodo(
  id: string,
  input: IssueUpdateInput
): Promise<Todo> {
  const client = getLinearClient()
  const result = await client.updateIssue(id, input)
  const issue = await result.issue
  if (!result.success || !issue) {
    throw new Error('Failed to update issue.')
  }
  return toTodo(issue)
}

export async function markDone(id: string, doneStateId: string): Promise<Todo> {
  return updateTodo(id, { stateId: doneStateId })
}

export async function snoozeTodo(id: string, dueDate: string): Promise<Todo> {
  return updateTodo(id, { dueDate: dueDate.split('T')[0] })
}

// --- Setup helpers -------------------------------------------------------

export async function getTeams(): Promise<TeamOption[]> {
  const client = getLinearClient()
  const connection = await client.teams({ first: 100 })
  return connection.nodes
    .map((t) => ({ id: t.id, key: t.key, name: t.name }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function getTeamStates(teamId: string): Promise<StateOption[]> {
  const client = getLinearClient()
  const team = await client.team(teamId)
  const connection = await team.states({ first: 100 })
  return connection.nodes.map((s) => ({
    id: s.id,
    name: s.name,
    type: s.type,
  }))
}

export async function getViewerName(): Promise<string> {
  const client = getLinearClient()
  const viewer = await client.viewer
  return viewer.name
}
