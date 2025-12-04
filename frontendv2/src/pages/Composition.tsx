/**
 * Composition Page - Edit existing composition
 * Implements REQ-3.3: Puzzle Composition
 */

import { useParams } from 'react-router-dom';
import Nav from '@components/common/Nav';
import { useCompositionStore } from '@stores/compositionStore';
import GameGrid from '@components/Game/GameGrid';
import CluesEditor from '@components/Compose/CluesEditor';

const Composition = () => {
  const { cid } = useParams<{ cid: string }>();
  const {
    title,
    author,
    cells,
    selectedCell,
    mode,
    clues,
    setSelectedCell,
    updateCell,
    toggleBlackSquare,
    toggleCircle,
    setMode,
    updateClue,
    regenerateClues,
  } = useCompositionStore();

  const handleCellClick = (row: number, col: number) => {
    setSelectedCell(row, col);
  };

  const handleCellChange = (row: number, col: number, value: string) => {
    updateCell(row, col, { value });
  };

  const handleToggleBlack = () => {
    if (selectedCell) {
      toggleBlackSquare(selectedCell.row, selectedCell.col);
    }
  };

  const handleToggleCircle = () => {
    if (selectedCell) {
      toggleCircle(selectedCell.row, selectedCell.col);
    }
  };

  return (
    <div className="composition-page">
      <Nav />
      <div className="composition-container">
        <header className="composition-header">
          <h1>{title || 'Untitled Puzzle'}</h1>
          <p>by {author || 'Unknown'}</p>
        </header>

        <div className="composition-toolbar">
          <button
            onClick={() => setMode('grid')}
            className={`btn-mode ${mode === 'grid' ? 'active' : ''}`}
          >
            Grid
          </button>
          <button
            onClick={() => setMode('clues')}
            className={`btn-mode ${mode === 'clues' ? 'active' : ''}`}
          >
            Clues
          </button>

          <div className="toolbar-spacer" />

          {mode === 'grid' ? (
            <>
              <button onClick={handleToggleBlack} className="btn-tool">
                Toggle Black
              </button>
              <button onClick={handleToggleCircle} className="btn-tool">
                Toggle Circle
              </button>
            </>
          ) : (
            <button onClick={regenerateClues} className="btn-tool">
              🔄 Regenerate from Grid
            </button>
          )}

          <button className="btn-primary">Publish</button>
        </div>

        <main className="composition-main">
          {mode === 'grid' ? (
            <GameGrid
              cells={cells}
              selectedCell={selectedCell}
              onCellClick={handleCellClick}
              onCellChange={handleCellChange}
            />
          ) : (
            <CluesEditor
              across={clues.across}
              down={clues.down}
              onUpdateClue={updateClue}
            />
          )}
        </main>

        <aside className="composition-sidebar">
          <div className="composition-info">
            <h3>Composition Info</h3>
            <p>ID: {cid}</p>
            <p>
              Size: {cells[0]?.length || 0} x {cells.length || 0}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default Composition;
