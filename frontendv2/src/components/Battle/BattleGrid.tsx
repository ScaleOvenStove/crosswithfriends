/**
 * BattleGrid Component
 * Crossword grid with competitive features for Battle/Fencing modes
 */

import { useState } from 'react';

interface BattleGridProps {
  grid: string[][];
  cellOwnership: { [key: string]: string };
  players: { id: string; color: string; displayName: string }[];
  currentPlayerId: string;
  mode: 'battle' | 'fencing';
  onCellFill: (row: number, col: number, value: string) => void;
}

const BattleGrid = ({
  grid,
  cellOwnership,
  players,
  currentPlayerId,
  mode,
  onCellFill,
}: BattleGridProps) => {
  const [focusedCell, setFocusedCell] = useState<{ row: number; col: number } | null>(null);
  const [cellValues, setCellValues] = useState<{ [key: string]: string }>({});

  const getPlayerColor = (playerId: string): string => {
    const player = players.find((p) => p.id === playerId);
    return player?.color || '#gray';
  };

  const handleCellClick = (row: number, col: number) => {
    if (grid[row][col] === '#') return; // Skip black cells

    setFocusedCell({ row, col });
  };

  const handleCellInput = (row: number, col: number, value: string) => {
    if (!value || grid[row][col] === '#') return;

    const upperValue = value.toUpperCase();
    const cellKey = `${row}-${col}`;

    setCellValues((prev) => ({ ...prev, [cellKey]: upperValue }));
    onCellFill(row, col, upperValue);

    // Move to next cell
    const nextCol = col + 1;
    if (nextCol < grid[row].length && grid[row][nextCol] !== '#') {
      setFocusedCell({ row, col: nextCol });
    } else if (row + 1 < grid.length) {
      setFocusedCell({ row: row + 1, col: 0 });
    }
  };

  return (
    <div className="battle-grid-container">
      <div
        className="battle-grid"
        style={{
          gridTemplateColumns: `repeat(${grid[0]?.length || 0}, 1fr)`,
          gridTemplateRows: `repeat(${grid.length}, 1fr)`,
        }}
      >
        {grid.map((row, rowIndex) =>
          row.map((cell, colIndex) => {
            const cellKey = `${rowIndex}-${colIndex}`;
            const ownerId = cellOwnership[cellKey];
            const cellValue = cellValues[cellKey] || '';
            const isFocused = focusedCell?.row === rowIndex && focusedCell?.col === colIndex;
            const isBlack = cell === '#';

            return (
              <div
                key={cellKey}
                className={`battle-cell ${isBlack ? 'black' : ''} ${
                  isFocused ? 'focused' : ''
                } ${ownerId ? 'owned' : ''}`}
                style={{
                  backgroundColor: isBlack
                    ? '#000'
                    : ownerId
                      ? `${getPlayerColor(ownerId)}33`
                      : '#fff',
                  borderColor: ownerId ? getPlayerColor(ownerId) : '#ccc',
                }}
                onClick={() => handleCellClick(rowIndex, colIndex)}
              >
                {!isBlack && (
                  <>
                    <input
                      type="text"
                      value={cellValue}
                      onChange={(e) => handleCellInput(rowIndex, colIndex, e.target.value)}
                      maxLength={1}
                      className="cell-input"
                      autoFocus={isFocused}
                    />
                    {mode === 'fencing' && ownerId && (
                      <div
                        className="cell-owner-indicator"
                        style={{ backgroundColor: getPlayerColor(ownerId) }}
                        title={players.find((p) => p.id === ownerId)?.displayName}
                      />
                    )}
                  </>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default BattleGrid;
