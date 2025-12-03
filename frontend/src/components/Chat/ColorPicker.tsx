import React, {useCallback, useMemo} from 'react';

import {useToggle} from '../../hooks/useToggle';

interface ColorPickerProps {
  color: string;
  onUpdateColor: (color: string) => void;
}

// Predefined color palette (similar to CirclePicker)
const COLOR_PALETTE = [
  '#f44336',
  '#e91e63',
  '#9c27b0',
  '#673ab7',
  '#3f51b5',
  '#2196f3',
  '#03a9f4',
  '#00bcd4',
  '#009688',
  '#4caf50',
  '#8bc34a',
  '#cddc39',
  '#ffeb3b',
  '#ffc107',
  '#ff9800',
  '#ff5722',
  '#795548',
  '#607d8b',
  '#000000',
  '#ffffff',
];

const ColorPicker: React.FC<ColorPickerProps> = (props) => {
  const {color, onUpdateColor} = props;
  const [isActive, toggleIsActive] = useToggle(false);

  const handleClick = useCallback(() => {
    toggleIsActive();
  }, [toggleIsActive]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleIsActive();
      }
    },
    [toggleIsActive]
  );

  const handleColorSelect = useCallback(
    (selectedColor: string) => {
      // Convert hex to HSL format to match expected format
      const hex = selectedColor.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16) / 255;
      const g = parseInt(hex.substring(2, 4), 16) / 255;
      const b = parseInt(hex.substring(4, 6), 16) / 255;

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      let h = 0;
      let s = 0;
      const l = (max + min) / 2;

      if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
          case r:
            h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
            break;
          case g:
            h = ((b - r) / d + 2) / 6;
            break;
          case b:
            h = ((r - g) / d + 4) / 6;
            break;
        }
      }

      const colorHSL = `hsl(${Math.floor(h * 360)},${Math.floor(s * 100)}%,${Math.floor(l * 100)}%)`;
      if (colorHSL !== color) {
        onUpdateColor(colorHSL);
      }
      toggleIsActive(false);
    },
    [color, onUpdateColor, toggleIsActive]
  );

  const colorPickerStyle = useMemo(
    () => ({
      display: 'flex',
      flexWrap: 'wrap' as const,
      gap: '8px',
      padding: '12px',
      backgroundColor: 'white',
      border: '1px solid #ccc',
      borderRadius: '4px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      maxWidth: '200px',
      position: 'absolute' as const,
      zIndex: 1000,
    }),
    []
  );

  const colorCircleStyle = useCallback(
    (paletteColor: string) => ({
      width: '24px',
      height: '24px',
      borderRadius: '50%',
      backgroundColor: paletteColor,
      border: paletteColor === '#ffffff' ? '1px solid #ccc' : 'none',
      cursor: 'pointer',
      transition: 'transform 0.1s',
    }),
    []
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
        <div style={colorPickerStyle}>
          {COLOR_PALETTE.map((paletteColor) => (
            <div
              key={paletteColor}
              style={colorCircleStyle(paletteColor)}
              onClick={() => handleColorSelect(paletteColor)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleColorSelect(paletteColor);
                }
              }}
              role="button"
              tabIndex={0}
              aria-label={`Select color ${paletteColor}`}
            />
          ))}
        </div>
      ) : null}
    </>
  );
};
export default ColorPicker;
