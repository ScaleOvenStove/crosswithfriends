import './css/clues.css';
import React, {useState, useCallback} from 'react';

import ClueText from './ClueText';

interface CluesProps {
  clues: {across: string[]; down: string[]};
  clueLengths: {across: number[]; down: number[]};
  isClueSelected: (dir: 'across' | 'down', i: number) => boolean;
  isClueHalfSelected: (dir: 'across' | 'down', i: number) => boolean;
  isClueFilled: (dir: 'across' | 'down', i: number) => boolean;
  scrollToClue: (dir: 'across' | 'down', i: number, el: HTMLElement | null) => void;
  selectClue: (dir: 'across' | 'down', i: number) => void;
}

const Clues: React.FC<CluesProps> = ({
  clues,
  clueLengths,
  isClueSelected,
  isClueHalfSelected,
  isClueFilled,
  scrollToClue,
  selectClue,
}) => {
  const [showClueLengths, setShowClueLengths] = useState(false);

  const toggleShowClueLengths = useCallback(() => {
    setShowClueLengths((prev) => !prev);
  }, []);

  const handleToggleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleShowClueLengths();
    }
  }, [toggleShowClueLengths]);

  return (
    <div className="clues">
      <div
        className="clues--secret"
        onClick={toggleShowClueLengths}
        onKeyDown={handleToggleKeyDown}
        role="button"
        tabIndex={0}
        title={showClueLengths ? '' : 'Show lengths'}
      />
      {
        // Clues component
        ['across', 'down'].map((dir, i) => (
          <div key={i} className="clues--list">
            <div className="clues--list--title">{dir.toUpperCase()}</div>

            <div className={`clues--list--scroll ${dir}`}>
              {clues[dir as 'across' | 'down'].map(
                (clue, idx) =>
                  clue && (
                    <div
                      key={idx}
                      className={`${
                        (isClueSelected(dir as 'across' | 'down', idx) ? 'selected ' : ' ') +
                        (isClueHalfSelected(dir as 'across' | 'down', idx) ? 'half-selected ' : ' ') +
                        (isClueFilled(dir as 'across' | 'down', idx) ? 'complete ' : ' ')
                      }clues--list--scroll--clue`}
                      ref={
                        isClueSelected(dir as 'across' | 'down', idx) ||
                        isClueHalfSelected(dir as 'across' | 'down', idx)
                          ? (el) => scrollToClue(dir as 'across' | 'down', idx, el)
                          : null
                      }
                      onClick={(e) => {
                        e.preventDefault();
                        selectClue(dir as 'across' | 'down', idx);
                      }}
                      onPointerDown={(e) => {
                        // Handle pointer events for touch devices
                        if (e.pointerType === 'touch' || e.pointerType === 'pen') {
                          e.preventDefault();
                          selectClue(dir as 'across' | 'down', idx);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="clues--list--scroll--clue--number">{idx}</div>
                      <div className="clues--list--scroll--clue--text">
                        <ClueText text={clue} />
                        {showClueLengths ? (
                          <span className="clues--list--scroll--clue--hint">
                            {'  '}({clueLengths[dir as 'across' | 'down'][idx]})
                          </span>
                        ) : null}
                      </div>
                    </div>
                  )
              )}
            </div>
          </div>
        ))
      }
    </div>
  );
};

export default Clues;
