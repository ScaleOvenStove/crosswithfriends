import './css/hints.css';
import React, {useState, useEffect, useRef, useMemo, useCallback} from 'react';

import {evaluate, findMatches, getPatterns, precompute} from './lib/hintUtils';

interface HintsProps {
  grid: any;
  direction: 'across' | 'down';
  num: number;
}

const Hints: React.FC<HintsProps> = ({grid, direction, num}) => {
  const [list, setList] = useState<string[]>([]);
  const [hidden, setHidden] = useState(true);
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
      for (const word of currentList) {
        // eslint-disable-next-line no-continue
        if (word in scoresRef.current) continue;
        scoresRef.current[word] = evaluate(grid, direction, num, word);
        cnt += 1;
        if (cnt >= limit) {
          break;
        }
      }
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

  const getScore = useCallback((word: string) => {
    return scoresRef.current[word] && scoresRef.current[word].toFixed(2);
  }, []);

  return (
    <div className="hints">
      <div
        className="hints--pattern"
        onClick={() => {
          setHidden((prev) => !prev);
        }}
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
          {list && list.length > 0 ? (
            <div className="hints--matches--entries">
              {list.slice(0, 100).map((word, i) => (
                <div key={i} className="hints--matches--entry">
                  <div className="hints--matches--entry--word">{word}</div>
                  <div className="hints--matches--entry--score">{getScore(word) || ''}</div>
                </div>
              ))}
            </div>
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
