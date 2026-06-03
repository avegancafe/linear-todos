import { Action, ActionPanel, Detail, Icon } from '@raycast/api'
import { randomInt } from 'node:crypto'
import { usePromise } from '@raycast/utils'
import { listTodos } from './lib/linear'
import { bucketFor } from './lib/dates'
import { ErrorDetail } from './lib/errors'
import { resolveSettings } from './lib/settings'
import { withLinearAuth } from './lib/oauth'

const MORNING_GREETINGS = [
  '🌅 Rise and grind!',
  "☕ Morning! Coffee's brewing, here's what's cooking:",
  "🌞 Good morning — let's knock these out:",
  "✨ Today's the day to tackle:",
  "🚀 Morning! Here's your hit list:",
  '🎯 Locked and loaded for today:',
  "🌤️ Rise and shine, here's what's due:",
]

const NO_TASK_GREETINGS = [
  "🌅 Morning! Nothing urgent today — you're free.",
  '☕ Coffee time, no fires to put out today.',
  '🌞 Good morning! Clear skies, zero TODOs.',
  '✨ Morning! Looks like a chill day ahead.',
]

function pick(list: string[]): string {
  return list[randomInt(list.length)]
}

function Digest() {
  const { isLoading, data, error, revalidate } = usePromise(async () => {
    const settings = await resolveSettings()
    const todos = await listTodos(settings.teamId, false)
    // Overdue + due today.
    return todos.filter((t) => {
      const bucket = bucketFor(t)
      return bucket === 'overdue' || bucket === 'today'
    })
  })

  if (error) {
    return <ErrorDetail error={error} />
  }

  const dueToday = data ?? []
  let markdown: string
  if (isLoading) {
    markdown = 'Loading…'
  } else if (dueToday.length > 0) {
    const lines = dueToday
      .map((t) => `- [${t.identifier}](${t.url}): ${t.title}`)
      .join('\n')
    markdown = `${pick(MORNING_GREETINGS)}\n\n${lines}`
  } else {
    markdown = pick(NO_TASK_GREETINGS)
  }

  return (
    <Detail
      isLoading={isLoading}
      navigationTitle="Morning Digest"
      markdown={markdown}
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

export default withLinearAuth(Digest)
