import {
  Action,
  ActionPanel,
  Form,
  Icon,
  Toast,
  popToRoot,
  showToast,
} from '@raycast/api'
import { useState } from 'react'
import { createTodo } from './lib/cli'
import { showCliError } from './lib/errors'

interface FormValues {
  title: string
  priority: string
  when: string
  date: string
  description: string
}

export default function CreateTodo() {
  const [titleError, setTitleError] = useState<string | undefined>()

  async function handleSubmit(values: FormValues) {
    if (!values.title || values.title.trim().length === 0) {
      setTitleError('Title is required')
      return
    }

    const toast = await showToast({
      style: Toast.Style.Animated,
      title: 'Creating todo…',
    })

    try {
      await createTodo({
        title: values.title.trim(),
        priority: values.priority,
        when: values.when || undefined,
        date: values.date,
        description: values.description,
      })
      toast.style = Toast.Style.Success
      toast.title = 'Todo created'
      await popToRoot()
    } catch (err) {
      await showCliError(err, 'Failed to create todo')
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
