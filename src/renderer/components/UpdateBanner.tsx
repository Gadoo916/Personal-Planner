import type { UpdateState } from '../hooks/useUpdates'
import { Button, IconButton, IconClose } from './ui'

/**
 * The update notice for the Home view. It renders only when the main process
 * has reported an update, so the normal launch draws nothing at all.
 *
 * The install control is a labelled `Button` and not a fourth icon, and it only
 * appears once the download has finished: the check happens in the main process,
 * so the banner never reports progress it does not have.
 */
export function UpdateBanner({
  state,
  onInstall,
  onDismiss,
}: {
  state: UpdateState
  onInstall: () => void
  onDismiss: () => void
}) {
  const ready = state.status === 'downloaded'

  return (
    <div className="update-banner" role="status">
      <div className="update-banner__body">
        <p className="update-banner__title">{ready ? 'Update ready' : 'Update available'}</p>
        <p className="update-banner__note">
          {ready
            ? `Version ${state.version} is ready. Restart to install it.`
            : `Version ${state.version} is downloading.`}
        </p>
      </div>

      <div className="update-banner__actions">
        {ready ? <Button onClick={onInstall}>Install and restart</Button> : null}
        <IconButton label="Dismiss the update notice" onClick={onDismiss}>
          <IconClose />
        </IconButton>
      </div>
    </div>
  )
}
