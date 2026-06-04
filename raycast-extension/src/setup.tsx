import {
  Action,
  ActionPanel,
  Detail,
  Icon,
  List,
  Toast,
  popToRoot,
  showToast,
  useNavigation,
} from '@raycast/api'
import { useEffect } from 'react'
import { usePromise } from '@raycast/utils'
import { StateOption, TeamOption, getTeamStates, getTeams } from './lib/linear'
import { ErrorDetail } from './lib/errors'
import { Settings, loadSettings, saveSettings } from './lib/settings'
import { withLinearAuth } from './lib/oauth'

function stateAccessory(type: string): string {
  switch (type) {
    case 'unstarted':
      return 'New'
    case 'started':
      return 'In Progress'
    case 'completed':
      return 'Done'
    case 'canceled':
      return 'Canceled'
    case 'backlog':
      return 'Backlog'
    default:
      return type
  }
}

function StatePicker(props: {
  teamId: string
  title: string
  description: string
  preferType: string
  onPick: (state: StateOption) => void
}) {
  const { isLoading, data, error } = usePromise(getTeamStates, [props.teamId])

  if (error) {
    return <ErrorDetail error={error} />
  }

  return (
    <List isLoading={isLoading} navigationTitle={props.title}>
      <List.Section title={props.description}>
        {(data ?? []).map((state) => (
          <List.Item
            key={state.id}
            title={state.name}
            icon={state.type === props.preferType ? Icon.Star : Icon.Circle}
            accessories={[{ text: stateAccessory(state.type) }]}
            actions={
              <ActionPanel>
                <Action title="Select" onAction={() => props.onPick(state)} />
              </ActionPanel>
            }
          />
        ))}
      </List.Section>
    </List>
  )
}

/** Terminal screen: persists the settings, then confirms with a clear summary. */
function SetupComplete(props: { settings: Settings }) {
  const { settings } = props

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      await saveSettings(settings)
      if (!cancelled) {
        await showToast({
          style: Toast.Style.Success,
          title: 'Setup complete',
        })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [settings])

  const markdown = [
    '# ✅ Setup complete!',
    '',
    'Your Linear Todos are configured:',
    '',
    `- **Team:** ${settings.teamName ?? settings.teamId}`,
    `- **New-todo state:** ${settings.stateName ?? settings.stateId}`,
    `- **Done state:** ${settings.doneStateName ?? settings.doneStateId}`,
    '',
    'You can re-run **Setup** anytime to change these.',
  ].join('\n')

  return (
    <Detail
      navigationTitle="Setup Complete"
      markdown={markdown}
      actions={
        <ActionPanel>
          <Action title="Done" icon={Icon.Check} onAction={() => popToRoot()} />
        </ActionPanel>
      }
    />
  )
}

function SetupFlow() {
  const { push } = useNavigation()
  const { isLoading, data: teams, error } = usePromise(getTeams)
  const { data: existing } = usePromise(loadSettings)

  if (error) {
    return <ErrorDetail error={error} />
  }

  function pickTeam(team: TeamOption) {
    push(
      <StatePicker
        teamId={team.id}
        title="New-Todo State"
        description="Select the state for NEW todos (usually Todo or Backlog)"
        preferType="unstarted"
        onPick={(newState) =>
          push(
            <StatePicker
              teamId={team.id}
              title="Done State"
              description="Select the state for COMPLETED todos (usually Done)"
              preferType="completed"
              onPick={(doneState) =>
                push(
                  <SetupComplete
                    settings={{
                      teamId: team.id,
                      teamName: team.name,
                      stateId: newState.id,
                      stateName: newState.name,
                      doneStateId: doneState.id,
                      doneStateName: doneState.name,
                    }}
                  />
                )
              }
            />
          )
        }
      />
    )
  }

  return (
    <List
      isLoading={isLoading}
      navigationTitle="Setup — Pick Team"
      searchBarPlaceholder="Filter teams…"
    >
      <List.Section
        title="Teams"
        subtitle={
          existing
            ? `Current: ${existing.teamName ?? existing.teamId}`
            : undefined
        }
      >
        {(teams ?? []).map((team) => (
          <List.Item
            key={team.id}
            title={team.name}
            subtitle={team.key}
            icon={Icon.TwoPeople}
            accessories={
              existing?.teamId === team.id ? [{ tag: 'Current' }] : undefined
            }
            actions={
              <ActionPanel>
                <Action title="Select Team" onAction={() => pickTeam(team)} />
              </ActionPanel>
            }
          />
        ))}
      </List.Section>
    </List>
  )
}

export default withLinearAuth(SetupFlow)
