/**
 * Grid Component - Main crossword grid container
 * Implements REQ-1.2: Grid Interaction
 *
 * Responsibilities:
 * - Renders the crossword grid
 * - Manages cell selection and word highlighting
 * - Coordinates keyboard navigation
 * - Displays player cursors
 */

import { useMemo, useCallback } from 'react';
import { styled } from '@mui/material/styles';
import { Paper } from '@mui/material';
import { GridCell } from './GridCell';
import { useKeyboardNavigation } from '@hooks/ui/useKeyboardNavigation';
import type { Cell, User, Cursor } from '../../types';

interface GridProps {
  cells: Cell[][];
  selectedCell: { row: number; col: number } | null;
  selectedDirection: 'across' | 'down';
  currentUser: User | null;
  users: User[];
  cursors: Cursor[];
  onCellClick: (row: number, col: number) => void;
  onCellChange: (row: number, col: number, value: string) => void;
  onDirectionToggle: () => void;
}

const GridContainer = styled(Paper)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'center',
  padding: theme.spacing(1),
  backgroundColor: theme.palette.background.paper,
  boxShadow: theme.shadows[3],
  width: '100%',
  overflow: 'auto',
  [theme.breakpoints.up('sm')]: {
    padding: theme.spacing(1.5),
    display: 'inline-block',
    width: 'auto',
  },
  [theme.breakpoints.up('md')]: {
    padding: theme.spacing(2),
  },
}));

const GridTable = styled('div')(({ theme }) => ({
  display: 'grid',
  gap: 0,
  border: `2px solid ${theme.palette.divider}`,
  backgroundColor: theme.palette.divider,
  position: 'relative',
  width: 'fit-content',
  height: 'fit-content',
}));

/**
 * Calculate which cells should be highlighted based on current selection
 */
const useHighlightedCells = (
  cells: Cell[][],
  selectedCell: { row: number; col: number } | null,
  selectedDirection: 'across' | 'down'
): Set<string> => {
  return useMemo(() => {
    const highlighted = new Set<string>();

    if (!selectedCell || !cells[selectedCell.row] || !cells[selectedCell.row]?.[selectedCell.col]) {
      return highlighted;
    }

    const { row, col } = selectedCell;
    const currentRow = cells[row];
    if (!currentRow) return highlighted;

    if (selectedDirection === 'across') {
      // Find start of word
      let startCol = col;
      const prevCell = currentRow[startCol - 1];
      while (startCol > 0 && prevCell && !prevCell.isBlack) {
        startCol--;
        if (startCol > 0) {
          const nextPrevCell = currentRow[startCol - 1];
          if (!nextPrevCell) break;
        }
      }

      // Highlight entire word
      let currentCol = startCol;
      while (currentCol < currentRow.length) {
        const cell = currentRow[currentCol];
        if (!cell || cell.isBlack) break;
        highlighted.add(`${row}-${currentCol}`);
        currentCol++;
      }
    } else {
      // Down direction
      // Find start of word
      let startRow = row;
      while (startRow > 0) {
        const prevRow = cells[startRow - 1];
        const prevCell = prevRow?.[col];
        if (!prevCell || prevCell.isBlack) break;
        startRow--;
      }

      // Highlight entire word
      let currentRowIdx = startRow;
      while (currentRowIdx < cells.length) {
        const rowData = cells[currentRowIdx];
        const cell = rowData?.[col];
        if (!cell || cell.isBlack) break;
        highlighted.add(`${currentRowIdx}-${col}`);
        currentRowIdx++;
      }
    }

    return highlighted;
  }, [cells, selectedCell, selectedDirection]);
};

/**
 * Main Grid component
 */
export const Grid = ({
  cells,
  selectedCell,
  selectedDirection,
  currentUser,
  users,
  cursors,
  onCellClick,
  onCellChange,
  onDirectionToggle,
}: GridProps) => {
  // Calculate grid dimensions
  const rows = cells.length;
  const cols = cells[0]?.length || 0;

  // Get highlighted cells (current word)
  const highlightedCells = useHighlightedCells(cells, selectedCell, selectedDirection);

  // Index cursors by cell for faster lookup
  const cursorsByCell = useMemo(() => {
    const map = new Map<string, Cursor[]>();
    const now = Date.now();
    const CURSOR_TIMEOUT = 5000; // 5 seconds
    
    cursors
      .filter((cursor) => {
        // Filter out current user's cursor and expired cursors
        return cursor.id !== currentUser?.id && now - cursor.timestamp < CURSOR_TIMEOUT;
      })
      .forEach((cursor) => {
        const key = `${cursor.row}-${cursor.col}`;
        if (!map.has(key)) {
          map.set(key, []);
        }
        map.get(key)!.push(cursor);
      });
    return map;
  }, [cursors, currentUser?.id]);

  // Setup keyboard navigation
  const { handleKeyDown } = useKeyboardNavigation({
    cells,
    selectedCell,
    selectedDirection,
    onCellSelect: onCellClick,
    onCellUpdate: onCellChange,
    onDirectionToggle,
  });

  // Determine if a cell is selected, highlighted, or in current word
  const getCellState = useCallback(
    (rowIndex: number, colIndex: number) => {
      const cellKey = `${rowIndex}-${colIndex}`;
      const isSelected = selectedCell?.row === rowIndex && selectedCell?.col === colIndex;
      const isInCurrentWord = highlightedCells.has(cellKey);
      const isHighlighted = isInCurrentWord && !isSelected;

      return { isSelected, isHighlighted, isInCurrentWord };
    },
    [selectedCell, highlightedCells]
  );

  if (!cells || cells.length === 0 || !cells[0]) {
    return (
      <GridContainer>
        <div>No puzzle loaded</div>
      </GridContainer>
    );
  }

  return (
    <GridContainer elevation={3}>
      <GridTable
        style={{
          gridTemplateColumns: `repeat(${cols}, auto)`,
          gridTemplateRows: `repeat(${rows}, auto)`,
        }}
        role="grid"
        aria-label="Crossword puzzle grid"
      >
        {cells.flatMap((row, rowIndex) =>
          row.map((cell, colIndex) => {
            const { isSelected, isHighlighted, isInCurrentWord } = getCellState(rowIndex, colIndex);

            // Get cursor color if cell is selected by current user
            const cursorColor = isSelected ? currentUser?.color : undefined;

            // Get other users' cursors on this cell
            const cellKey = `${rowIndex}-${colIndex}`;
            const otherCursors = cursorsByCell.get(cellKey) || [];

            return (
              <GridCell
                key={`${rowIndex}-${colIndex}`}
                cell={cell}
                row={rowIndex}
                col={colIndex}
                isSelected={isSelected}
                isHighlighted={isHighlighted}
                isInCurrentWord={isInCurrentWord}
                onCellClick={onCellClick}
                onCellChange={onCellChange}
                onKeyDown={handleKeyDown}
                cursorColor={cursorColor}
                otherCursors={otherCursors}
                users={users}
              />
            );
          })
        )}
      </GridTable>
    </GridContainer>
  );
};

export default Grid;
