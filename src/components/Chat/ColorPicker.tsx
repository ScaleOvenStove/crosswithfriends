import React, {useCallback} from 'react';
import {useToggle} from 'react-use';

const SWATCH_COLORS = [
  'hsl(4,90%,58%)',
  'hsl(340,82%,52%)',
  'hsl(291,47%,51%)',
  'hsl(262,52%,47%)',
  'hsl(231,48%,48%)',
  'hsl(207,90%,54%)',
  'hsl(199,98%,48%)',
  'hsl(187,100%,42%)',
  'hsl(174,100%,29%)',
  'hsl(122,39%,49%)',
  'hsl(88,50%,53%)',
  'hsl(66,70%,54%)',
  'hsl(54,100%,62%)',
  'hsl(45,100%,51%)',
  'hsl(36,100%,50%)',
  'hsl(14,100%,57%)',
  'hsl(16,25%,38%)',
  'hsl(200,18%,46%)',
];

interface ColorPickerProps {
  color: string;
  onUpdateColor: (color: string) => void;
}
const ColorPicker: React.FC<ColorPickerProps> = (props) => {
  const [isActive, toggleIsActive] = useToggle(false);
  const handleToggle = useCallback(() => {
    toggleIsActive();
  }, [toggleIsActive]);
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        toggleIsActive();
      }
    },
    [toggleIsActive]
  );
  const handleSwatchClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const color = e.currentTarget.dataset.color!;
      if (color !== props.color) {
        props.onUpdateColor(color);
      }
      toggleIsActive(false);
    },
    [props, toggleIsActive]
  );
  return (
    <>
      <span
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        style={{color: props.color, cursor: 'pointer'}}
      >
        {' '}
        {'\u25CF '}
      </span>
      {isActive ? (
        <>
          <div style={{display: 'flex', flexWrap: 'wrap', gap: 6, padding: '8px 0'}}>
            {SWATCH_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Select color ${c}`}
                data-color={c}
                onClick={handleSwatchClick}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  backgroundColor: c,
                  border: c === props.color ? '2px solid #fff' : 'none',
                  boxShadow: c === props.color ? '0 0 0 2px #333' : 'none',
                  cursor: 'pointer',
                  padding: 0,
                }}
              />
            ))}
          </div>
          <br />
        </>
      ) : null}
    </>
  );
};
export default ColorPicker;
