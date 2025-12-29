/**
 * Game Grid Component
 * Implements REQ-1.2: Grid Interaction
 */

import type { Cell } from '@types/index';

interface GameGridProps {
  cells: Cell[][];
  selectedCell: { row: number; col: number } | null;
  onCellClick: (row: number, col: number) => void;
  onCellChange: (row: number, col: number, value: string) => void;
}

const GameGrid = ({ cells, selectedCell, onCellClick, onCellChange }: GameGridProps) => {
  if (!cells || cells.length === 0) {
    return (
      <div className="game-grid-empty">
        <p>Loading grid...</p>
      </div>
    );
  }

  return (
    <div className="game-grid">
      {cells.map((row, rowIndex) => (
        <div key={rowIndex} className="grid-row">
          {row.map((cell, colIndex) => {
            const isSelected = selectedCell?.row === rowIndex && selectedCell?.col === colIndex;

            return (
              <div
                key={`${rowIndex}-${colIndex}`}
                className={`grid-cell ${cell.isBlack ? 'black' : ''} ${isSelected ? 'selected' : ''} ${cell.isPencil ? 'pencil' : ''}`}
                onClick={() => !cell.isBlack && onCellClick(rowIndex, colIndex)}
              >
                {!cell.isBlack && (
                  <>
                    {cell.number && <span className="cell-number">{cell.number}</span>}
                    <input
                      type="text"
                      maxLength={1}
                      value={cell.value}
                      onChange={(e) => onCellChange(rowIndex, colIndex, e.target.value)}
                      className="cell-input"
                      disabled={cell.isBlack}
                    />
                    {cell.hasCircle && <div className="cell-circle" />}
                  </>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};

export default GameGrid;
