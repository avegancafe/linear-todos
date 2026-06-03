import {
  Action,
  ActionPanel,
  Detail,
  Icon,
  Toast,
  launchCommand,
  LaunchType,
  showToast,
} from '@raycast/api'
import { SetupRequiredError } from './settings'

/** Show a failure toast. For setup issues, offers to open the Setup command. */
export async function showActionError(
  error: unknown,
  title: string
): Promise<void> {
  const message = error instanceof Error ? error.message : String(error)
  const isSetup = error instanceof SetupRequiredError
  await showToast({
    style: Toast.Style.Failure,
    title,
    message,
    primaryAction: isSetup
      ? {
          title: 'Open Setup',
          onAction: () =>
            launchCommand({ name: 'setup', type: LaunchType.UserInitiated }),
        }
      : undefined,
  })
}

/** A Detail view explaining an error, with a shortcut to Setup when relevant. */
export function ErrorDetail({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : String(error)
  const isSetup = error instanceof SetupRequiredError
  const markdown = [
    isSetup ? '# Setup required' : '# Something went wrong',
    '',
    '```',
    message,
    '```',
    '',
    isSetup
      ? 'Run the **Setup** command to pick your todo team and workflow states.'
      : 'If this persists, try re-connecting your Linear account or running Setup again.',
  ].join('\n')

  return (
    <Detail
      markdown={markdown}
      actions={
        <ActionPanel>
          <Action
            title="Open Setup"
            icon={Icon.Gear}
            onAction={() =>
              launchCommand({ name: 'setup', type: LaunchType.UserInitiated })
            }
          />
        </ActionPanel>
      }
    />
  )
}
