import {
  Action,
  ActionPanel,
  Detail,
  openExtensionPreferences,
  Toast,
  showToast,
} from '@raycast/api'
import { CliError } from './cli'

/** Show a failure toast, with a shortcut to preferences for config issues. */
export async function showCliError(
  error: unknown,
  title: string
): Promise<void> {
  const message = error instanceof Error ? error.message : String(error)
  const isConfig = error instanceof CliError && error.isConfigIssue
  await showToast({
    style: Toast.Style.Failure,
    title,
    message,
    primaryAction: isConfig
      ? {
          title: 'Open Preferences',
          onAction: () => openExtensionPreferences(),
        }
      : undefined,
  })
}

/** A Detail view that explains an error and offers to open preferences. */
export function ErrorDetail({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : String(error)
  const isConfig = error instanceof CliError && error.isConfigIssue
  const details = error instanceof CliError ? error.stderr : ''
  const markdown = [
    `# Something went wrong`,
    '',
    '```',
    message,
    '```',
    '',
    isConfig
      ? 'This looks like a configuration issue. Make sure the repo path is correct, and that credentials are set either in extension preferences or via `uv run python main.py setup`.'
      : 'Check that `uv`, Python, and the linear-todos CLI are working from the configured repo path.',
    ...(details && details !== message
      ? ['', '**Full output:**', '', '```', details, '```']
      : []),
  ].join('\n')

  return (
    <Detail
      markdown={markdown}
      actions={
        <ActionPanel>
          <Action
            title="Open Extension Preferences"
            onAction={openExtensionPreferences}
          />
        </ActionPanel>
      }
    />
  )
}
