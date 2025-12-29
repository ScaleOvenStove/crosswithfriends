/**
 * KeyboardButton Component
 * Individual button for the virtual keyboard
 */

import { triggerHapticFeedback } from '@utils/deviceDetection';

interface KeyboardButtonProps {
  value: string;
  label?: string;
  onClick: (value: string) => void;
  variant?: 'primary' | 'secondary' | 'special';
  disabled?: boolean;
  className?: string;
}

const KeyboardButton = ({
  value,
  label,
  onClick,
  variant = 'primary',
  disabled = false,
  className = '',
}: KeyboardButtonProps) => {
  const handleClick = () => {
    if (disabled) return;

    // Trigger haptic feedback
    triggerHapticFeedback(10);

    // Call the onClick handler
    onClick(value);
  };

  return (
    <button
      type="button"
      className={`keyboard-btn keyboard-btn-${variant} ${className}`}
      onClick={handleClick}
      disabled={disabled}
      aria-label={label || value}
    >
      {label || value}
    </button>
  );
};

export default KeyboardButton;
