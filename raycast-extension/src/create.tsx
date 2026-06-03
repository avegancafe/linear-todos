import {
  Action,
  ActionPanel,
  Form,
  Icon,
  Toast,
  getPreferenceValues,
  popToRoot,
  showToast,
} from '@raycast/api'
import { useState } from 'react'
import { createTodo, priorityToNumber } from './lib/linear'
import {
  effectiveTimeZone,
  getRelativeDate,
  parseDate,
  toIsoDateTime,
} from './lib/dates'
import { showActionError } from './lib/errors'
import { resolveSettings } from './lib/settings'
import { withLinearAuth } from './lib/oauth'

interface Preferences {
  timezone?: string
}

interface FormValues {
  title: string
  priority: string
  when: string
  date: string
  description: string
}

function CreateTodo() {
  const [titleError, setTitleError] = useState<string | undefined>()
  const { timezone } = getPreferenceValues<Preferences>()
  const tz = effectiveTimeZone(timezone)

  async function handleSubmit(values: FormValues) {
    if (!values.title || values.title.trim().length === 0) {
      setTitleError('Title is required')
      return
    }

    // Resolve due date: relative window wins over a specific date.
    let dueDate: string | null = null
    if (values.when) {
      dueDate = getRelativeDate(values.when as 'day' | 'week' | 'month', tz)
    } else if (values.date && values.date.trim().length > 0) {
      const parsed = parseDate(values.date.trim(), tz)
      if (!parsed) {
        await showActionError(
          new Error(`Could not parse date: ${values.date}`),
          'Invalid date'
        )
        return
      }
      dueDate = toIsoDateTime(parsed, true, tz)
    }

    const toast = await showToast({
      style: Toast.Style.Animated,
      title: 'Creating todo…',
    })

    try {
      const settings = await resolveSettings()
      const priority =
        values.priority && values.priority !== 'unset'
          ? priorityToNumber(values.priority)
          : undefined

      const todo = await createTodo({
        teamId: settings.teamId,
        title: values.title.trim(),
        description: values.description?.trim() || undefined,
        stateId: settings.stateId,
        priority,
        dueDate,
      })
      toast.style = Toast.Style.Success
      toast.title = 'Todo created'
      toast.message = `${todo.identifier} — ${todo.title}`
      await popToRoot()
    } catch (err) {
      await showActionError(err, 'Failed to create todo')
    }
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Create Todo"
            icon={Icon.Plus}
            onSubmit={handleSubmit}
          />
        </ActionPanel>
      }
    >
      <Form.TextField
        id="title"
        title="Title"
        placeholder="Call mom"
        error={titleError}
        onChange={() => setTitleError(undefined)}
        onBlur={(e) => {
          if (!e.target.value || e.target.value.trim().length === 0) {
            setTitleError('Title is required')
          }
        }}
      />
      <Form.Dropdown id="priority" title="Priority" defaultValue="unset">
        <Form.Dropdown.Item value="unset" title="— Unset —" />
        <Form.Dropdown.Item value="urgent" title="🔥 Urgent" />
        <Form.Dropdown.Item value="high" title="⚡ High" />
        <Form.Dropdown.Item value="normal" title="📌 Normal" />
        <Form.Dropdown.Item value="low" title="💤 Low" />
        <Form.Dropdown.Item value="none" title="📋 None" />
      </Form.Dropdown>
      <Form.Separator />
      <Form.Description text="Set a due date with EITHER a relative window OR a specific/natural-language date. If both are set, the relative window wins." />
      <Form.Dropdown id="when" title="Relative Due" defaultValue="">
        <Form.Dropdown.Item value="" title="— None —" />
        <Form.Dropdown.Item value="day" title="End of Today" />
        <Form.Dropdown.Item value="week" title="In 7 Days" />
        <Form.Dropdown.Item value="month" title="In 28 Days" />
      </Form.Dropdown>
      <Form.TextField
        id="date"
        title="Specific Date"
        placeholder="tomorrow, next Monday, 2025-04-15"
      />
      <Form.Separator />
      <Form.TextArea
        id="description"
        title="Description"
        placeholder="Optional details…"
      />
    </Form>
  )
}

export default withLinearAuth(CreateTodo)
