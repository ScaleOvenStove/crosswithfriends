import React from 'react';

interface VimCommandBarProps {
  isVimCommandMode: boolean;
  isVimInsertMode: boolean;
  onVimCommand: () => void;
  onEnter: (command: string) => void;
  onEscape: () => void;
}

export const VimCommandBar: React.FC<VimCommandBarProps> = ({
  isVimCommandMode,
  isVimInsertMode,
  onVimCommand,
  onEnter,
  onEscape,
}) => {
  const [command, setCommand] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const handleChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setCommand(e.target.value);
  }, []);

  const handleKeydown = React.useCallback<React.KeyboardEventHandler<HTMLInputElement>>(
    (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        setCommand('');
        onEnter(command);
      } else if (e.key === 'Escape') {
        setCommand('');
        onEscape();
      }
    },
    [command, onEnter, onEscape]
  );

  const handleBlur = React.useCallback<React.FocusEventHandler<HTMLElement>>(() => {
    setCommand('');
    if (isVimCommandMode) {
      onVimCommand();
    }
  }, [isVimCommandMode, onVimCommand]);

  React.useEffect(() => {
    if (isVimCommandMode) {
      inputRef.current?.focus();
    }
  }, [isVimCommandMode]);

  return (
    <div className="player--main--vim-bar">
      {isVimInsertMode && <>-- INSERT --</>}
      {isVimCommandMode && (
        <input
          className="player--main--vim-bar--input"
          ref={inputRef}
          type="text"
          value={command}
          onChange={handleChange}
          onBlur={handleBlur}
          disabled={!isVimCommandMode}
          onKeyDown={handleKeydown}
        />
      )}
    </div>
  );
};
