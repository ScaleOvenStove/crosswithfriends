/**
 * CluesEditor Component - Edit puzzle clues
 * Allows editing across and down clues for puzzle composition
 */

import { useState } from 'react';
import type { Clue } from '@types/index';

interface CluesEditorProps {
  across: Clue[];
  down: Clue[];
  onUpdateClue: (_direction: 'across' | 'down', _number: number, _clueText: string) => void;
}

const CluesEditor = ({ across, down, onUpdateClue }: CluesEditorProps) => {
  const [activeDirection, setActiveDirection] = useState<'across' | 'down'>('across');

  const activeClues = activeDirection === 'across' ? across : down;

  const handleClueChange = (number: number, value: string) => {
    onUpdateClue(activeDirection, number, value);
  };

  return (
    <div className="clues-editor">
      <div className="clues-editor-header">
        <h2>Clues Editor</h2>
        <div className="clues-direction-toggle">
          <button
            type="button"
            onClick={() => setActiveDirection('across')}
            className={`btn-toggle ${activeDirection === 'across' ? 'active' : ''}`}
          >
            Across ({across.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveDirection('down')}
            className={`btn-toggle ${activeDirection === 'down' ? 'active' : ''}`}
          >
            Down ({down.length})
          </button>
        </div>
      </div>

      <div className="clues-list">
        {activeClues.length === 0 ? (
          <div className="empty-state">
            <p>No {activeDirection} clues yet.</p>
            <p className="text-muted">
              Clues are auto-generated based on your grid. Fill in the grid first!
            </p>
          </div>
        ) : (
          activeClues.map((clue) => (
            <div key={`${activeDirection}-${clue.number}`} className="clue-item">
              <div className="clue-header">
                <span className="clue-number">{clue.number}</span>
                <span className="clue-answer">{clue.answer || '(empty)'}</span>
              </div>
              <div className="clue-input-wrapper">
                <label
                  htmlFor={`clue-${activeDirection}-${clue.number}`}
                  className="visually-hidden"
                >
                  Clue for {clue.number} {activeDirection}
                </label>
                <textarea
                  id={`clue-${activeDirection}-${clue.number}`}
                  className="clue-input"
                  value={clue.clue}
                  onChange={(e) => handleClueChange(clue.number, e.target.value)}
                  placeholder={`Enter clue for ${clue.number} ${activeDirection}...`}
                  rows={2}
                />
              </div>
            </div>
          ))
        )}
      </div>

      <style>{`
        .clues-editor {
          padding: 1rem;
          max-width: 800px;
          margin: 0 auto;
        }

        .clues-editor-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
        }

        .clues-editor-header h2 {
          margin: 0;
          font-size: 1.5rem;
        }

        .clues-direction-toggle {
          display: flex;
          gap: 0.5rem;
        }

        .btn-toggle {
          padding: 0.5rem 1rem;
          border: 1px solid #ddd;
          background: white;
          cursor: pointer;
          border-radius: 4px;
          transition: all 0.2s;
        }

        .btn-toggle:hover {
          background: #f5f5f5;
        }

        .btn-toggle.active {
          background: #007bff;
          color: white;
          border-color: #007bff;
        }

        .clues-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .clue-item {
          border: 1px solid #ddd;
          border-radius: 8px;
          padding: 1rem;
          background: white;
        }

        .clue-header {
          display: flex;
          gap: 1rem;
          margin-bottom: 0.5rem;
          align-items: center;
        }

        .clue-number {
          font-weight: bold;
          color: #007bff;
          min-width: 2rem;
        }

        .clue-answer {
          font-family: monospace;
          background: #f5f5f5;
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          font-weight: 500;
        }

        .clue-input-wrapper {
          width: 100%;
        }

        .clue-input {
          width: 100%;
          padding: 0.5rem;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-family: inherit;
          font-size: 1rem;
          resize: vertical;
          min-height: 60px;
        }

        .clue-input:focus {
          outline: none;
          border-color: #007bff;
          box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
        }

        .empty-state {
          text-align: center;
          padding: 3rem 1rem;
          color: #666;
        }

        .empty-state p {
          margin: 0.5rem 0;
        }

        .text-muted {
          color: #999;
          font-size: 0.9rem;
        }

        .visually-hidden {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border-width: 0;
        }
      `}</style>
    </div>
  );
};

export default CluesEditor;
