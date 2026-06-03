import { Action, ActionPanel, Icon, List } from '@raycast/api'
import { usePromise } from '@raycast/utils'
import { PRIORITY_ICONS, listTodos } from './lib/linear'
import {
  BUCKET_ORDER,
  BUCKET_TITLES,
  formatDueDate,
  groupByBucket,
} from './lib/dates'
import { ErrorDetail } from './lib/errors'
import { resolveSettings } from './lib/settings'
import { withLinearAuth } from './lib/oauth'

function Review() {
  const { isLoading, data, error, revalidate } = usePromise(async () => {
    const settings = await resolveSettings()
    return listTodos(settings.teamId, false)
  })

  if (error) {
    return <ErrorDetail error={error} />
  }

  const grouped = groupByBucket(data ?? [])

  return (
    <List isLoading={isLoading} navigationTitle="Daily Review">
      {BUCKET_ORDER.map((bucket) => {
        const items = grouped.get(bucket) ?? []
        if (items.length === 0) {
          return null
        }
        return (
          <List.Section
            key={bucket}
            title={BUCKET_TITLES[bucket]}
            subtitle={`${items.length}`}
          >
            {items.map((todo) => (
              <List.Item
                key={todo.id}
                title={todo.title}
                subtitle={todo.identifier}
                icon={PRIORITY_ICONS[todo.priority ?? 0]}
                accessories={[{ text: formatDueDate(todo.dueDate) || '—' }]}
                actions={
                  <ActionPanel>
                    <Action.OpenInBrowser
                      title="Open in Linear"
                      url={todo.url}
                    />
                    <Action
                      title="Refresh"
                      icon={Icon.ArrowClockwise}
                      shortcut={{ modifiers: ['cmd'], key: 'r' }}
                      onAction={() => revalidate()}
                    />
                  </ActionPanel>
                }
              />
            ))}
          </List.Section>
        )
      })}
      <List.EmptyView
        title={isLoading ? 'Loading…' : 'Nothing to review'}
        icon={Icon.Checkmark}
      />
    </List>
  )
}

export default withLinearAuth(Review)
