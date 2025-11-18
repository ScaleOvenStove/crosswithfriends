import './css/hints.css';
import type {GridData} from '@crosswithfriends/shared/types';
import React, {useState, useEffect, useRef, useMemo, useCallback} from 'react';

import {evaluate, findMatches, getPatterns, precompute} from './lib/hintUtils';

interface HintsProps {
  grid: GridData;
  direction: 'across' | 'down';
  num: number;
}

const Hints: React.FC<HintsProps> = ({grid, direction, num}) => {
  const [list, setList] = useState<string[]>([]);
  const [hidden, setHidden] = useState(true);
  const [scores, setScores] = useState<Record<string, number>>({});
  const scoresRef = useRef<Record<string, number>>({});
  const computingRef = useRef(false);
  const computing2Ref = useRef(false);

  const pattern = useMemo(() => {
    return getPatterns(grid)[direction][num];
  }, [grid, direction, num]);

  useEffect(() => {
    precompute(3);
    precompute(4);
    precompute(5);
  }, []);

  const startComputing2 = useCallback(() => {
    if (computing2Ref.current) return;
    computing2Ref.current = true;
    const limit = 100; // don't work too hard
    const doWork = (done_cbk: () => void, more_cbk: () => void) => {
      // call cbk if there's more work to be done
      let cnt = 0;
      const currentList = [...list];
      const newScores: Record<string, number> = {};
      for (const word of currentList) {
        if (word in scoresRef.current) {
          newScores[word] = scoresRef.current[word];
          continue;
        }
        const score = evaluate(grid, direction, num, word);
        scoresRef.current[word] = score;
        newScores[word] = score;
        cnt += 1;
        if (cnt >= limit) {
          break;
        }
      }
      // Update state with new scores
      setScores((prev) => ({...prev, ...newScores}));
      currentList.sort((a, b) => -((scoresRef.current[a] || -10000) - (scoresRef.current[b] || -10000)));
      setList(currentList);
      if (cnt >= limit) {
        more_cbk(); // not done
      } else {
        done_cbk();
      }
    };

    const loop = (cbk: () => void) => {
      requestIdleCallback(() => {
        doWork(cbk, () => {
          loop(cbk);
        });
      });
    };

    loop(() => {
      computing2Ref.current = false;
    });
  }, [list, grid, direction, num]);

  const startComputing = useCallback(() => {
    if (computingRef.current) {
      return;
    }
    computingRef.current = true;
    requestIdleCallback(() => {
      findMatches(pattern, (matches: string[]) => {
        setList(matches);
        scoresRef.current = {}; // reset
        setScores({}); // reset state
        computingRef.current = false;
        startComputing2();
      });
    });
  }, [pattern, startComputing2]);

  useEffect(() => {
    if (!hidden) {
      startComputing();
    }
  }, [hidden, startComputing]);

  // Move useMemo outside conditional to follow rules of hooks
  // Use scores state instead of ref to avoid accessing refs during render
  const matchesList = useMemo(() => {
    if (!list || list.length === 0) {
      return null;
    }
    return list.slice(0, 100).map((word, i) => {
      const score = scores[word];
      const scoreText = score ? score.toFixed(2) : '';
      return (
        <div key={`${word}-${i}`} className="hints--matches--entry">
          <div className="hints--matches--entry--word">{word}</div>
          <div className="hints--matches--entry--score">{scoreText}</div>
        </div>
      );
    });
  }, [list, scores]);

  const handlePatternClick = useCallback(() => {
    setHidden((prev) => !prev);
  }, []);

  return (
    <div className="hints">
      <div
        className="hints--pattern"
        onClick={handlePatternClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handlePatternClick();
          }
        }}
        role="button"
        tabIndex={0}
        aria-label="Toggle hints"
      >
        <span style={{float: 'left'}}>
          Pattern:
          {pattern}
        </span>
        <span style={{float: 'right'}}>
          Matches:
          {list.length}
        </span>
      </div>
      {!hidden ? (
        <div className="hints--matches">
          {matchesList ? (
            <div className="hints--matches--entries">{matchesList}</div>
          ) : (
            'No matches'
          )}
        </div>
      ) : null}
    </div>
  );
};

export default React.memo(Hints, (prevProps, nextProps) => {
  return prevProps.num === nextProps.num && prevProps.direction === nextProps.direction;
});
