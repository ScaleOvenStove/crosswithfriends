/* eslint-disable react/jsx-no-bind */

export default function UploadModal({
  open,
  title,
  icon,
  onConfirm,
  onCancel,
  confirmText,
  cancelText,
  loading,
  children,
}) {
  if (!open) return null;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget && onCancel) {
      onCancel();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape' && onCancel) {
      onCancel();
    }
  };

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div className="upload-modal--overlay" onClick={handleOverlayClick} onKeyDown={handleKeyDown}>
      <div className="upload-modal">
        {icon && (
          <div className={`upload-modal--icon upload-modal--icon-${icon}`}>
            {icon === 'success' && <span>&#10003;</span>}
            {icon === 'error' && <span>&#10007;</span>}
            {icon === 'warning' && <span>!</span>}
            {icon === 'info' && <span>i</span>}
          </div>
        )}
        <div className="upload-modal--title">{title}</div>
        <div className="upload-modal--content">{children}</div>
        <div className="upload-modal--buttons">
          {onCancel && (
            <button
              type="button"
              className="upload-modal--button upload-modal--button-cancel"
              onClick={onCancel}
            >
              {cancelText || 'Cancel'}
            </button>
          )}
          {onConfirm && (
            <button
              type="button"
              className="upload-modal--button upload-modal--button-confirm"
              onClick={onConfirm}
              disabled={loading}
            >
              {loading ? 'Uploading...' : confirmText || 'OK'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
