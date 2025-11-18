import React from 'react';
import {CirclePicker} from 'react-color';
import {useToggle} from 'react-use';

interface ColorPickerProps {
  color: string;
  onUpdateColor: (color: string) => void;
}
const ColorPicker: React.FC<ColorPickerProps> = (props) => {
  const {color, onUpdateColor} = props;
  const [isActive, toggleIsActive] = useToggle(false);

  const handleClick = React.useCallback(() => {
    toggleIsActive();
  }, [toggleIsActive]);

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleIsActive();
      }
    },
    [toggleIsActive]
  );

  const handleChangeComplete = React.useCallback(
    (colorObj: {hsl: {h: number; s: number; l: number}}) => {
      const colorHSL = `hsl(${Math.floor(colorObj.hsl.h)},${Math.floor(colorObj.hsl.s * 100)}%,${Math.floor(
        colorObj.hsl.l * 100
      )}%)`;
      if (colorHSL !== color) {
        onUpdateColor(colorHSL);
      }
      toggleIsActive(false);
    },
    [color, onUpdateColor, toggleIsActive]
  );

  return (
    <>
      <button
        onClick={handleClick}
        type="button"
        aria-label="Change color"
        aria-expanded={isActive}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          color: color,
          font: 'inherit',
          display: 'inline',
        }}
        onKeyDown={handleKeyDown}
      >
        {' '}
        {'\u25CF '}
      </button>
      {isActive ? (
        <>
          <CirclePicker color={color} onChangeComplete={handleChangeComplete} />
          <br />
        </>
      ) : null}
    </>
  );
};
export default ColorPicker;
