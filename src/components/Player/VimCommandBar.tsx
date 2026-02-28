import React from 'react';
import {MdHelpOutline} from 'react-icons/md';
import InfoDialog from '../common/InfoDialog';

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
  const [helpOpen, setHelpOpen] = React.useState(false);
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

  const handleHelpClick = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setHelpOpen(true);
  }, []);

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
      {!isVimInsertMode && !isVimCommandMode && <span>-- NORMAL --</span>}
      <button
        type="button"
        className="player--main--vim-bar--help"
        onClick={handleHelpClick}
        title="Vim keybindings"
      >
        <MdHelpOutline />
      </button>
      <InfoDialog open={helpOpen} onOpenChange={setHelpOpen} title="Vim Mode Keybindings" icon={null}>
        <h4>Normal Mode</h4>
        <table>
          <tbody>
            <tr>
              <th>Key</th>
              <th>Action</th>
            </tr>
            <tr>
              <td>
                <code>h</code> <code>j</code> <code>k</code> <code>l</code>
              </td>
              <td>Move left / down / up / right</td>
            </tr>
            <tr>
              <td>
                <code>w</code>
              </td>
              <td>Next clue</td>
            </tr>
            <tr>
              <td>
                <code>b</code>
              </td>
              <td>Previous clue</td>
            </tr>
            <tr>
              <td>
                <code>^</code>
              </td>
              <td>Start of clue</td>
            </tr>
            <tr>
              <td>
                <code>$</code>
              </td>
              <td>End of clue</td>
            </tr>
            <tr>
              <td>
                <code>i</code>
              </td>
              <td>Enter insert mode</td>
            </tr>
            <tr>
              <td>
                <code>s</code>
              </td>
              <td>Delete cell and enter insert mode</td>
            </tr>
            <tr>
              <td>
                <code>x</code>
              </td>
              <td>Delete cell</td>
            </tr>
            <tr>
              <td>
                <code>:</code>
              </td>
              <td>Enter command mode</td>
            </tr>
          </tbody>
        </table>
        <h4>Insert Mode</h4>
        <table>
          <tbody>
            <tr>
              <th>Key</th>
              <th>Action</th>
            </tr>
            <tr>
              <td>Letters</td>
              <td>Fill in cell</td>
            </tr>
            <tr>
              <td>
                <code>Escape</code>
              </td>
              <td>Return to normal mode</td>
            </tr>
          </tbody>
        </table>
        <h4>Command Mode</h4>
        <table>
          <tbody>
            <tr>
              <th>Key</th>
              <th>Action</th>
            </tr>
            <tr>
              <td>
                <code>:42a</code>
              </td>
              <td>Jump to 42 across</td>
            </tr>
            <tr>
              <td>
                <code>:7d</code>
              </td>
              <td>Jump to 7 down</td>
            </tr>
            <tr>
              <td>
                <code>Enter</code>
              </td>
              <td>Execute command</td>
            </tr>
            <tr>
              <td>
                <code>Escape</code>
              </td>
              <td>Cancel</td>
            </tr>
          </tbody>
        </table>
      </InfoDialog>
    </div>
  );
};
