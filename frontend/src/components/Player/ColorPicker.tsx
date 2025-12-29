/**
 * ColorPicker Component - User color selection
 * Implements REQ-2.1.4: Color customization
 *
 * Features:
 * - Predefined color palette
 * - Visual color selection
 * - Current color indicator
 */

import { Box, Button, Popover, styled } from '@mui/material';
import { useState } from 'react';
import { Palette as PaletteIcon } from '@mui/icons-material';

interface ColorPickerProps {
  currentColor: string;
  onColorChange: (color: string) => void;
  colors?: string[];
}

const ColorGrid = styled(Box)(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'repeat(5, 1fr)',
  gap: theme.spacing(1),
  padding: theme.spacing(2),
  minWidth: 200,
}));

const ColorButton = styled(Button)<{ color: string; selected?: boolean }>(
  ({ theme, color, selected }) => ({
    width: 32,
    height: 32,
    minWidth: 32,
    padding: 0,
    backgroundColor: color,
    border: selected
      ? `3px solid ${theme.palette.primary.main}`
      : `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    '&:hover': {
      backgroundColor: color,
      opacity: 0.8,
      transform: 'scale(1.1)',
    },
    transition: 'all 0.2s',
  })
);

// Default color palette
const DEFAULT_COLORS = [
  '#1976d2', // Blue
  '#d32f2f', // Red
  '#388e3c', // Green
  '#f57c00', // Orange
  '#7b1fa2', // Purple
  '#0288d1', // Light Blue
  '#c2185b', // Pink
  '#00796b', // Teal
  '#fbc02d', // Yellow
  '#5d4037', // Brown
  '#455a64', // Blue Grey
  '#e64a19', // Deep Orange
  '#303f9f', // Indigo
  '#00897b', // Teal Dark
  '#8e24aa', // Purple Dark
];

/**
 * ColorPicker component
 */
export const ColorPicker = ({
  currentColor,
  onColorChange,
  colors = DEFAULT_COLORS,
}: ColorPickerProps) => {
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleColorSelect = (color: string) => {
    onColorChange(color);
    handleClose();
  };

  const open = Boolean(anchorEl);

  return (
    <>
      <Button
        variant="outlined"
        onClick={handleClick}
        startIcon={<PaletteIcon />}
        sx={{
          borderColor: currentColor,
          color: currentColor,
          '&:hover': {
            borderColor: currentColor,
            backgroundColor: `${currentColor}20`,
          },
        }}
      >
        Change Color
      </Button>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
      >
        <ColorGrid>
          {colors.map((color) => (
            <ColorButton
              key={color}
              color={color}
              selected={color === currentColor}
              onClick={() => handleColorSelect(color)}
              aria-label={`Select color ${color}`}
            />
          ))}
        </ColorGrid>
      </Popover>
    </>
  );
};
