import {useCallback} from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import './css/confirmDialog.css';

export default function ConfirmDialog({
  open,
  onOpenChange,
  title,
  icon,
  children,
  onConfirm,
  confirmLabel,
  danger,
}) {
  const handleConfirm = useCallback(() => {
    onConfirm();
    onOpenChange(false);
  }, [onConfirm, onOpenChange]);

  const handleCancel = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="confirm-dialog--overlay" />
        <Dialog.Content className={`confirm-dialog--panel${icon ? ' confirm-dialog--centered' : ''}`}>
          {icon && (
            <div className={`confirm-dialog--icon${danger ? ' confirm-dialog--icon-warning' : ''}`}>
              {icon}
            </div>
          )}
          {title && (
            <Dialog.Title className={`confirm-dialog--title${icon ? ' confirm-dialog--title-centered' : ''}`}>
              {title}
            </Dialog.Title>
          )}
          <div className="confirm-dialog--body">{children}</div>
          <div className="confirm-dialog--actions">
            <button type="button" className="btn btn--outlined" onClick={handleCancel}>
              Cancel
            </button>
            <button
              type="button"
              className={`btn btn--contained ${danger ? 'btn--danger' : 'btn--primary'}`}
              onClick={handleConfirm}
            >
              {confirmLabel || 'OK'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
