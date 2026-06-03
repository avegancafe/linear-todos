import {
  LaunchProps,
  Toast,
  showToast,
  updateCommandMetadata,
} from '@raycast/api'
import { remind } from './lib/cli'
import { showCliError } from './lib/errors'

export default async function Remind(
  props: LaunchProps<{ arguments: { text: string } }>
) {
  const text = props.arguments.text?.trim()
  if (!text) {
    await showToast({
      style: Toast.Style.Failure,
      title: 'Reminder text is required',
    })
    return
  }

  const toast = await showToast({
    style: Toast.Style.Animated,
    title: 'Creating reminder…',
  })

  try {
    const out = await remind(text)
    // The CLI prints a "✓ Created: ID - Title" line we can surface.
    const created = out.split('\n').find((line) => line.includes('Created:'))
    toast.style = Toast.Style.Success
    toast.title = 'Reminder created'
    if (created) {
      toast.message = created.replace(/^.*Created:\s*/, '').trim()
    }
    await updateCommandMetadata({ subtitle: `Last: ${text}` })
  } catch (err) {
    await showCliError(err, 'Failed to create reminder')
  }
}
