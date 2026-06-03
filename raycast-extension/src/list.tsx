import {
  Action,
  ActionPanel,
  Color,
  Icon,
  List,
  Toast,
  confirmAlert,
  showToast,
} from '@raycast/api'
import { useState } from 'react'
import { usePromise } from '@raycast/utils'
import {
  PRIORITY_LABELS,
  Todo,
  issueUrl,
  listTodos,
  markDone,
  snoozeTodo,
} from './lib/cli'
import {
  BUCKET_ORDER,
  BUCKET_TITLES,
  formatDueDate,
  groupByBucket,
} from './lib/dates'
import { ErrorDetail, showCliError } from './lib/errors'

const PRIORITY_COLORS: Record<number, Color> = {
  0: Color.SecondaryText,
  1: Color.Red,
  2: Color.Orange,
  3: Color.Blue,
  4: Color.SecondaryText,
}

const SNOOZE_PRESETS: { title: string; when: string }[] = [
  { title: 'Tomorrow', when: 'tomorrow' },
  { title: 'In 3 Days', when: 'in 3 days' },
  { title: 'Next Week', when: 'next week' },
  { title: 'Next Monday', when: 'next Monday' },
]

export default function ListTodos() {
  const [showAll, setShowAll] = useState(false)
  const { isLoading, data, error, revalidate } = usePromise(
    (all: boolean) => listTodos(all),
    [showAll]
  )

  if (error) {
    return <ErrorDetail error={error} />
  }

  const todos = data ?? []
  const grouped = groupByBucket(todos)

  async function onDone(todo: Todo) {
    const toast = await showToast({
      style: Toast.Style.Animated,
      title: `Completing ${todo.identifier}…`,
    })
    try {
      await markDone(todo.identifier)
      toast.style = Toast.Style.Success
      toast.title = `Completed ${todo.identifier}`
      await revalidate()
    } catch (err) {
      await showCliError(err, `Failed to complete ${todo.identifier}`)
    }
  }

  async function onSnooze(todo: Todo, when: string) {
    const toast = await showToast({
      style: Toast.Style.Animated,
      title: `Snoozing ${todo.identifier}…`,
    })
    try {
      await snoozeTodo(todo.identifier, when)
      toast.style = Toast.Style.Success
      toast.title = `Snoozed ${todo.identifier} to ${when}`
      await revalidate()
    } catch (err) {
      await showCliError(err, `Failed to snooze ${todo.identifier}`)
    }
  }

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder="Filter todos…"
      navigationTitle="Linear Todos"
    >
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
            {items.map((todo) => {
              const priority = todo.priority ?? 0
              const due = formatDueDate(todo.dueDate)
              return (
                <List.Item
                  key={todo.id}
                  title={todo.title}
                  subtitle={todo.identifier}
                  keywords={[todo.identifier]}
                  accessories={[
                    ...(due ? [{ text: due, icon: Icon.Calendar }] : []),
                    {
                      tag: {
                        value: PRIORITY_LABELS[priority] ?? 'None',
                        color: PRIORITY_COLORS[priority] ?? Color.SecondaryText,
                      },
                    },
                    ...(todo.state?.name ? [{ text: todo.state.name }] : []),
                  ]}
                  actions={
                    <ActionPanel>
                      <ActionPanel.Section>
                        <Action
                          title="Mark Done"
                          icon={Icon.CheckCircle}
                          onAction={async () => {
                            if (
                              await confirmAlert({
                                title: `Complete ${todo.identifier}?`,
                                message: todo.title,
                              })
                            ) {
                              await onDone(todo)
                            }
                          }}
                        />
                        <ActionPanel.Submenu
                          title="Snooze"
                          icon={Icon.Clock}
                          shortcut={{ modifiers: ['cmd'], key: 's' }}
                        >
                          {SNOOZE_PRESETS.map((preset) => (
                            <Action
                              key={preset.when}
                              title={preset.title}
                              onAction={() => onSnooze(todo, preset.when)}
                            />
                          ))}
                        </ActionPanel.Submenu>
                      </ActionPanel.Section>
                      <ActionPanel.Section>
                        <Action.OpenInBrowser
                          title="Open in Linear"
                          url={issueUrl(todo.identifier)}
                          shortcut={{ modifiers: ['cmd'], key: 'o' }}
                        />
                        <Action.CopyToClipboard
                          title="Copy Identifier"
                          content={todo.identifier}
                          shortcut={{ modifiers: ['cmd'], key: '.' }}
                        />
                      </ActionPanel.Section>
                      <ActionPanel.Section>
                        <Action
                          title={showAll ? 'Hide Completed' : 'Show Completed'}
                          icon={Icon.Eye}
                          shortcut={{ modifiers: ['cmd', 'shift'], key: 'a' }}
                          onAction={() => setShowAll((v) => !v)}
                        />
                        <Action
                          title="Refresh"
                          icon={Icon.ArrowClockwise}
                          shortcut={{ modifiers: ['cmd'], key: 'r' }}
                          onAction={() => revalidate()}
                        />
                      </ActionPanel.Section>
                    </ActionPanel>
                  }
                />
              )
            })}
          </List.Section>
        )
      })}
      <List.EmptyView
        title={isLoading ? 'Loading todos…' : 'No todos'}
        description={
          isLoading ? undefined : 'Create one with the Create Todo command.'
        }
        icon={Icon.Tray}
      />
    </List>
  )
}
