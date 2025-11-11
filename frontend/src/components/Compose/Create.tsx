import './css/create.css';
import React, {useState, useCallback, useRef} from 'react';

interface CreateProps {
  onCreate?: (data: {dims: {r: number; c: number}; pattern: number[][]}) => void;
}

/**
 * Component for creating a crossword grid pattern.
 * Allows users to adjust grid dimensions and paint black/white cells.
 *
 * @example
 * ```tsx
 * <Create onCreate={(data) => console.log(data.dims, data.pattern)} />
 * ```
 */
const Create: React.FC<CreateProps> = ({onCreate}) => {
  const [dims, setDims] = useState({r: 5, c: 5});
  const [pattern, setPattern] = useState<number[][]>([
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
  ]);
  const paintColorRef = useRef<number | undefined>(undefined);
  const paintedRef = useRef<Record<string, boolean>>({});

  const resizePattern = useCallback(
    (newDims: {r: number; c: number}) => {
      const newPattern: number[][] = [];
      for (let i = 0; i < newDims.r; i += 1) {
        newPattern[i] = [];
        for (let j = 0; j < newDims.c; j += 1) {
          newPattern[i][j] = (pattern[i] || [])[j] || 0;
        }
      }
      setPattern(newPattern);
    },
    [pattern]
  );

  const flipPattern = useCallback((r: number, c: number) => {
    setPattern((prevPattern) => {
      const newPattern = JSON.parse(JSON.stringify(prevPattern));
      newPattern[r][c] = 1 - newPattern[r][c];
      return newPattern;
    });
  }, []);

  const paint = useCallback(
    (r: number, c: number, val: number) => {
      if (pattern[r][c] === val) return;
      paintedRef.current[`${r}_${c}`] = true;
      flipPattern(r, c);
    },
    [pattern, flipPattern]
  );

  const resetPaint = useCallback(() => {
    paintColorRef.current = undefined;
    paintedRef.current = {};
  }, []);

  const updateDims = useCallback(
    (r: number, c: number) => {
      const newDims = {
        r: Math.min(Math.max(1, r), 25),
        c: Math.min(Math.max(1, c), 25),
      };
      setDims(newDims);
      resizePattern(newDims);
    },
    [resizePattern]
  );

  const updateDimsDelta = useCallback(
    (dr: number, dc: number) => {
      updateDims(dims.r + dr, dims.c + dc);
    },
    [dims, updateDims]
  );

  const handleClick = useCallback(() => {
    if (onCreate) {
      onCreate({
        dims,
        pattern,
      });
    }
  }, [onCreate, dims, pattern]);

  const size = 180 / Math.max(dims.r, dims.c);

  return (
    <div className="create">
      <div className="create--options">
        <div className="create--options--height">
          <button onClick={() => updateDimsDelta(-1, 0)}> - </button>
          <div className="create--options--label">Height:</div>
          <input value={dims.r} onChange={(e) => updateDims(Number(e.target.value) || dims.r, dims.c)} />
          <button onClick={() => updateDimsDelta(+1, 0)}> + </button>
        </div>
        <div className="create--options--width">
          <button onClick={() => updateDimsDelta(0, -1)}> - </button>
          <div className="create--options--label">Width:</div>
          <input value={dims.c} onChange={(e) => updateDims(dims.r, Number(e.target.value) || dims.c)} />
          <button onClick={() => updateDimsDelta(0, +1)}> + </button>
        </div>
      </div>

      <div className="create--pattern">
        <table className="create--pattern--grid">
          <tbody>
            {pattern.map((row, r) => (
              <tr key={r}>
                {row.map((cell, c) => (
                  <td
                    key={`${r}_${c}`}
                    className="create--pattern--grid--cell--wrapper"
                    style={{
                      width: size,
                      height: size,
                    }}
                  >
                    <div
                      onMouseMove={(e) => {
                        if (e.buttons === 1) {
                          if (paintColorRef.current === undefined) {
                            paintColorRef.current = 1 - pattern[r][c];
                          }
                          paint(r, c, paintColorRef.current);
                        }
                      }}
                      onMouseDown={() => {
                        resetPaint();
                      }}
                      onClick={() => {
                        if (!paintedRef.current[`${r}_${c}`]) {
                          flipPattern(r, c);
                        }
                        resetPaint();
                      }}
                      onDrag={(e) => e.preventDefault()}
                      className={`${cell === 0 ? 'white ' : 'black '}create--pattern--grid--cell`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button className="create--btn" onClick={handleClick}>
        Create
      </button>
    </div>
  );
};

export default Create;
