import {useCallback} from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import './css/confirmDialog.css';

export default function InfoDialog({open, onOpenChange, title, icon, children}) {
  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="confirm-dialog--overlay" />
        <Dialog.Content className={`confirm-dialog--panel${icon ? ' confirm-dialog--centered' : ''}`}>
          {icon && <div className="confirm-dialog--icon">{icon}</div>}
          {title && (
            <Dialog.Title className={`confirm-dialog--title${icon ? ' confirm-dialog--title-centered' : ''}`}>
              {title}
            </Dialog.Title>
          )}
          <div className="confirm-dialog--body">{children}</div>
          <div className="confirm-dialog--actions">
            <button type="button" className="btn btn--contained btn--primary" onClick={handleClose}>
              OK
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
