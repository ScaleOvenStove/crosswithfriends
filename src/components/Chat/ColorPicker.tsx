import React, {useCallback} from 'react';
import {useToggle} from 'react-use';
import {CirclePicker} from 'react-color';
import {makeStyles} from '@material-ui/core';

interface ColorPickerProps {
  color: string;
  onUpdateColor: (color: string) => void;
}
const useStyles = makeStyles<any, ColorPickerProps>({
  clickableDot: {
    color: (props) => props.color,
    cursor: 'pointer',
  },
});
const ColorPicker: React.FC<ColorPickerProps> = (props) => {
  const classes = useStyles(props);
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
  const handleChangeComplete = useCallback(
    (color: any) => {
      const colorHSL = `hsl(${Math.floor(color.hsl.h)},${Math.floor(color.hsl.s * 100)}%,${Math.floor(
        color.hsl.l * 100
      )}%)`;
      if (colorHSL !== props.color) {
        props.onUpdateColor(colorHSL);
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
        className={classes.clickableDot}
      >
        {' '}
        {'\u25CF '}
      </span>
      {isActive ? (
        <>
          <CirclePicker color={props.color} onChangeComplete={handleChangeComplete} />
          <br />
        </>
      ) : null}
    </>
  );
};
export default ColorPicker;
