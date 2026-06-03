import { Action, ActionPanel, Detail, Icon } from '@raycast/api'
import { usePromise } from '@raycast/utils'
import { runCli } from './cli'
import { ErrorDetail } from './errors'

/** Runs a CLI subcommand and renders its (markdown) stdout in a Detail. */
export function MarkdownCommand({
  command,
  title,
}: {
  command: string
  title: string
}) {
  const { isLoading, data, error, revalidate } = usePromise(
    (cmd: string) => runCli([cmd]),
    [command]
  )

  if (error) {
    return <ErrorDetail error={error} />
  }

  return (
    <Detail
      isLoading={isLoading}
      navigationTitle={title}
      markdown={data ?? ''}
      actions={
        <ActionPanel>
          <Action
            title="Refresh"
            icon={Icon.ArrowClockwise}
            shortcut={{ modifiers: ['cmd'], key: 'r' }}
            onAction={() => revalidate()}
          />
        </ActionPanel>
      }
    />
  )
}
