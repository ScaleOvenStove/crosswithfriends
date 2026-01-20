/* eslint no-plusplus: "off", no-bitwise: "off" */
function getExtension(bytes, code) {
  // struct byte format is 4S H H
  let i = 0;
  let j = 0;
  for (i = 0; i < bytes.length; i += 1) {
    if (j === code.length) break;
    if (bytes[i] === code.charCodeAt(j)) {
      j += 1;
    } else {
      j = 0;
    }
  }
  if (j === code.length) {
    // we found the code
    const length = bytes[i] * 256 + bytes[i + 1];
    i += 4; // skip the H H
    return Array.from(bytes).slice(i, i + length);
  }
  return null; // could not find
}

function getRebus(bytes) {
  const grbs = 'GRBS';
  const rtbl = 'RTBL';

  const table = getExtension(bytes, grbs);
  if (!table) {
    return; // no rebus
  }
  const solbytes = getExtension(bytes, rtbl);
  const enc = new TextDecoder('ISO-8859-1');
  const solstring = enc.decode(new Uint8Array(solbytes));
  if (!solstring) {
    return;
  }
  const sols = {};
  solstring.split(';').forEach((s) => {
    const tokens = s.split(':');
    if (tokens.length === 2) {
      const [key, val] = tokens;
      sols[Number(key.trim())] = val;
    }
  });
  // dict string format is k1:v1;k2:v2;...;kn:vn;

  return { table, sols };
}

function getCircles(bytes) {
  const circles = [];
  const gext = 'GEXT';
  const markups = getExtension(bytes, gext);
  if (markups) {
    markups.forEach((byte, i) => {
      if (byte & 128) {
        circles.push(i);
      }
    });
  }
  return circles;
}

function getShades(bytes) {
  const shades = [];
  const gext = 'GEXT';
  const markups = getExtension(bytes, gext);
  if (markups) {
    markups.forEach((byte, i) => {
      if (byte & 8) {
        shades.push(i);
      }
    });
  }
  return shades;
}

function addRebusToSolution(solution, rebus, ncol, nrow) {
  return solution.map((row, i) =>
    row.map((cell, j) => {
      const idx = i * ncol + j;
      if (rebus.table[idx]) {
        return rebus.sols[rebus.table[idx] - 1];
      }
      return cell;
    })
  );
}

/**
 * Converts a .puz file buffer to ipuz JSON format
 * @param {ArrayBuffer} buffer - The .puz file as an ArrayBuffer
 * @returns {Object} ipuz format JSON object
 */
export default function PUZtoIPUZ(buffer) {
  const bytes = new Uint8Array(buffer);
  const ncol = bytes[44];
  const nrow = bytes[45];

  if (!(bytes[50] === 0 && bytes[51] === 0)) {
    throw new Error('Scrambled PUZ file');
  }

  // Read solution grid
  const solution = [];
  for (let i = 0; i < nrow; i++) {
    solution[i] = [];
    for (let j = 0; j < ncol; j++) {
      const letter = String.fromCharCode(bytes[52 + i * ncol + j]);
      solution[i][j] = letter === '.' ? null : letter;
    }
  }

  // Handle rebus if present
  const rebus = getRebus(bytes);
  const finalSolution = rebus ? addRebusToSolution(solution, rebus, ncol, nrow) : solution;

  // Find clue numbers first
  function isBlack(i, j) {
    return i < 0 || j < 0 || i >= nrow || j >= ncol || finalSolution[i][j] === null;
  }

  const isAcross = [];
  const isDown = [];
  const clueNumbers = []; // Map from cell index to clue number
  let n = 0;
  for (let i = 0; i < nrow; i++) {
    for (let j = 0; j < ncol; j++) {
      if (finalSolution[i][j] !== null) {
        const isAcrossStart = isBlack(i, j - 1) && !isBlack(i, j + 1);
        const isDownStart = isBlack(i - 1, j) && !isBlack(i + 1, j);

        if (isAcrossStart || isDownStart) {
          n += 1;
          isAcross[n] = isAcrossStart;
          isDown[n] = isDownStart;
          const idx = i * ncol + j;
          clueNumbers[idx] = n;
        }
      }
    }
  }

  // Build puzzle grid (playable grid with clue numbers and cell objects)
  // Per ipuz spec: puzzle grid contains clue numbers, "#" for black squares, null for empty
  // Cells with styles use objects like {cell: number, style: {...}}
  const puzzle = [];
  const circles = getCircles(bytes);
  const shades = getShades(bytes);
  const circleSet = new Set(circles);
  const shadeSet = new Set(shades);

  for (let i = 0; i < nrow; i++) {
    puzzle[i] = [];
    for (let j = 0; j < ncol; j++) {
      const idx = i * ncol + j;
      const isBlackSquare = finalSolution[i][j] === null;

      if (isBlackSquare) {
        puzzle[i][j] = '#';
      } else {
        const clueNum = clueNumbers[idx];
        const hasCircle = circleSet.has(idx);
        const hasShade = shadeSet.has(idx);

        if (hasCircle || hasShade) {
          // Cell with style - use object format
          const cellObj = { cell: clueNum || 0 };
          if (hasCircle || hasShade) {
            cellObj.style = {};
            if (hasCircle) {
              cellObj.style.shapebg = 'circle';
            }
            if (hasShade) {
              cellObj.style.fillbg = '#000000';
            }
          }
          puzzle[i][j] = cellObj;
        } else if (clueNum) {
          // Just a clue number, no style
          puzzle[i][j] = clueNum;
        } else {
          // Regular cell, no clue number
          puzzle[i][j] = null;
        }
      }
    }
  }

  // Read strings from file
  let ibyte = 52 + ncol * nrow * 2;
  function readString() {
    let result = '';
    let b = bytes[ibyte++];
    while (ibyte < bytes.length && b !== 0) {
      result += String.fromCharCode(b);
      b = bytes[ibyte++];
    }
    return result;
  }

  const title = readString();
  const author = readString();
  const copyright = readString();

  // Read clues
  const acrossClues = [];
  const downClues = [];

  for (let i = 1; i <= n; i++) {
    if (isAcross[i]) {
      acrossClues.push({ number: i.toString(), clue: readString() });
    }
    if (isDown[i]) {
      downClues.push({ number: i.toString(), clue: readString() });
    }
  }

  const notes = readString();

  // Build ipuz format per specification at https://www.puzzazz.com/ipuz/v1
  const ipuz = {
    version: 'http://ipuz.org/v1',
    kind: ['http://ipuz.org/crossword#1'],
    dimensions: {
      width: ncol,
      height: nrow,
    },
    title: title || '',
    author: author || '',
    copyright: copyright || '',
    notes: notes || '',
    solution: finalSolution,
    puzzle: puzzle,
    clues: {
      Across: acrossClues,
      Down: downClues,
    },
  };

  return ipuz;
}
