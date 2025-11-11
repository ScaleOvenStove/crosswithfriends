import React from 'react';
import {useToggle} from 'react-use';
import {CirclePicker} from 'react-color';
import {Box} from '@mui/material';

interface ColorPickerProps {
  color: string;
  onUpdateColor: (color: string) => void;
}
const ColorPicker: React.FC<ColorPickerProps> = (props) => {
  const [isActive, toggleIsActive] = useToggle(false);
  return (
    <>
      <Box component="span" onClick={toggleIsActive} sx={{color: props.color, cursor: 'pointer'}}>
        {' '}
        {'\u25CF '}
      </Box>
      {isActive ? (
        <>
          <CirclePicker
            color={props.color}
            onChangeComplete={(color) => {
              const colorHSL = `hsl(${Math.floor(color.hsl.h)},${Math.floor(color.hsl.s * 100)}%,${Math.floor(
                color.hsl.l * 100
              )}%)`;
              if (colorHSL !== props.color) {
                props.onUpdateColor(colorHSL);
              }
              toggleIsActive(false);
            }}
          />
          <br />
        </>
      ) : null}
    </>
  );
};
export default ColorPicker;
