/**
 * VirtualKeyboard Component
 * On-screen keyboard for mobile devices
 */

import { useState } from 'react';
import KeyboardButton from './KeyboardButton';

interface VirtualKeyboardProps {
  onKeyPress: (key: string) => void;
  onBackspace: () => void;
  onArrowKey: (direction: 'up' | 'down' | 'left' | 'right') => void;
  isVisible?: boolean;
  onToggle?: () => void;
}

const LETTERS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
];

const VirtualKeyboard = ({
  onKeyPress,
  onBackspace,
  onArrowKey,
  isVisible = true,
  onToggle,
}: VirtualKeyboardProps) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleToggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
    onToggle?.();
  };

  if (!isVisible) return null;

  return (
    <div className={`virtual-keyboard ${isCollapsed ? 'collapsed' : ''}`}>
      {/* Collapse/Expand Button */}
      <div className="keyboard-header">
        <button
          type="button"
          className="keyboard-toggle-btn"
          onClick={handleToggleCollapse}
          aria-label={isCollapsed ? 'Expand keyboard' : 'Collapse keyboard'}
        >
          {isCollapsed ? '⌃' : '⌄'}
        </button>
      </div>

      {!isCollapsed && (
        <div className="keyboard-content">
          {/* Letter Rows */}
          <div className="keyboard-letters">
            {LETTERS.map((row, rowIndex) => (
              <div key={rowIndex} className="keyboard-row">
                {row.map((letter) => (
                  <KeyboardButton
                    key={letter}
                    value={letter}
                    onClick={onKeyPress}
                    variant="primary"
                  />
                ))}
              </div>
            ))}
          </div>

          {/* Special Keys Row */}
          <div className="keyboard-row keyboard-special-row">
            {/* Arrow Keys */}
            <div className="keyboard-arrows">
              <div className="arrow-row">
                <KeyboardButton
                  value="UP"
                  label="↑"
                  onClick={() => onArrowKey('up')}
                  variant="secondary"
                />
              </div>
              <div className="arrow-row">
                <KeyboardButton
                  value="LEFT"
                  label="←"
                  onClick={() => onArrowKey('left')}
                  variant="secondary"
                />
                <KeyboardButton
                  value="DOWN"
                  label="↓"
                  onClick={() => onArrowKey('down')}
                  variant="secondary"
                />
                <KeyboardButton
                  value="RIGHT"
                  label="→"
                  onClick={() => onArrowKey('right')}
                  variant="secondary"
                />
              </div>
            </div>

            {/* Backspace */}
            <KeyboardButton
              value="BACKSPACE"
              label="⌫"
              onClick={onBackspace}
              variant="special"
              className="backspace-btn"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default VirtualKeyboard;
