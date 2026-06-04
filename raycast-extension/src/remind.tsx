import {
  LaunchProps,
  LaunchType,
  Toast,
  getPreferenceValues,
  launchCommand,
  showToast,
} from '@raycast/api'
import { withAccessToken } from '@raycast/utils'
import { createTodo } from './lib/linear'
import { effectiveTimeZone, parseReminderText } from './lib/dates'
import { showActionError } from './lib/errors'
import { resolveSettings } from './lib/settings'
import { linear } from './lib/oauth'

interface Preferences {
  timezone?: string
}

async function Remind(props: LaunchProps<{ arguments: { text: string } }>) {
  const text = props.arguments.text?.trim()
  if (!text) {
    await showToast({
      style: Toast.Style.Failure,
      title: 'Reminder text is required',
    })
    return
  }

  const { timezone } = getPreferenceValues<Preferences>()
  const tz = effectiveTimeZone(timezone)
  const { title, dueDate, priority } = parseReminderText(text, tz)

  if (!title) {
    await showToast({
      style: Toast.Style.Failure,
      title: 'Could not parse reminder',
      message: text,
    })
    return
  }

  const toast = await showToast({
    style: Toast.Style.Animated,
    title: 'Creating reminder…',
  })

  try {
    const settings = await resolveSettings()
    const todo = await createTodo({
      teamId: settings.teamId,
      title,
      stateId: settings.stateId,
      priority,
      dueDate,
    })
    toast.style = Toast.Style.Success
    toast.title = 'Reminder created'
    toast.message = `${todo.identifier} — ${todo.title}`
    // Jump to the List Todos view so the new reminder is visible in context.
    await launchCommand({ name: 'list', type: LaunchType.UserInitiated })
  } catch (err) {
    await showActionError(err, 'Failed to create reminder')
  }
}

export default withAccessToken(linear)(Remind)
