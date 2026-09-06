import PUZtoJSON from '../PUZtoJSON';

// Build one extension section: 4-byte code, little-endian length, checksum,
// then `length` data bytes and a trailing null. The checksum bytes are
// deliberately non-zero (as they are in any real file) so that a parser
// overrunning the declared length trips over invalid UTF-8.
function buildExtension({code, data}) {
  return [
    ...code.split('').map((c) => c.charCodeAt(0)),
    data.length & 0xff,
    (data.length >> 8) & 0xff,
    0xb4,
    0x9e,
    ...data,
    0,
  ];
}

// Build a minimal valid .puz binary buffer
function buildPuzBuffer({nrow, ncol, solution, clues, title, author, copyright, description, extensions}) {
  const gridSize = nrow * ncol;
  // Header: 52 bytes, then solution grid, then player state grid, then strings
  const solutionBytes = [];
  for (let i = 0; i < nrow; i += 1) {
    for (let j = 0; j < ncol; j += 1) {
      solutionBytes.push(solution[i][j].charCodeAt(0));
    }
  }

  // Player state (all dashes for unsolved)
  const stateBytes = new Array(gridSize).fill('-'.charCodeAt(0));

  // Encode strings as null-terminated
  const encodeString = (s) => [...s].map((ch) => ch.charCodeAt(0)).concat([0]);

  const titleBytes = encodeString(title || '');
  const authorBytes = encodeString(author || '');
  const copyrightBytes = encodeString(copyright || '');

  // Determine clue numbering
  const isBlack = (i, j) => i < 0 || j < 0 || i >= nrow || j >= ncol || solution[i][j] === '.';

  const clueStrings = [];
  for (let i = 0; i < nrow; i += 1) {
    for (let j = 0; j < ncol; j += 1) {
      if (solution[i][j] !== '.') {
        const isAcrossStart = isBlack(i, j - 1) && !isBlack(i, j + 1);
        const isDownStart = isBlack(i - 1, j) && !isBlack(i + 1, j);
        if (isAcrossStart) {
          clueStrings.push(clues.shift() || '');
        }
        if (isDownStart) {
          clueStrings.push(clues.shift() || '');
        }
      }
    }
  }

  const clueBytes = clueStrings.flatMap(encodeString);
  const descBytes = encodeString(description || '');

  // Build header (52 bytes)
  const header = new Array(52).fill(0);
  // Magic at offset 2: "ACROSS&DOWN\0"
  const magic = 'ACROSS&DOWN\0';
  for (let i = 0; i < magic.length; i += 1) {
    header[2 + i] = magic.charCodeAt(i);
  }
  header[44] = ncol;
  header[45] = nrow;
  // bytes 50-51 = 0 (not scrambled) — already zero

  const allBytes = [
    ...header,
    ...solutionBytes,
    ...stateBytes,
    ...titleBytes,
    ...authorBytes,
    ...copyrightBytes,
    ...clueBytes,
    ...descBytes,
    ...(extensions || []).flatMap(buildExtension),
  ];

  return new Uint8Array(allBytes).buffer;
}

describe('PUZtoJSON', () => {
  it('parses a minimal 3x3 puzzle', () => {
    const solution = [
      ['C', 'A', 'T'],
      ['A', 'R', 'E'],
      ['B', '.', 'N'],
    ];
    const buffer = buildPuzBuffer({
      nrow: 3,
      ncol: 3,
      solution,
      clues: ['Feline', 'Exist', 'Taxi', 'Writing tool', 'Time periods'],
      title: 'Test Puzzle',
      author: 'Tester',
      copyright: '2024',
      description: 'A test',
    });

    const result = PUZtoJSON(buffer);
    expect(result.grid).toBeDefined();
    expect(result.info).toBeDefined();
    expect(result.across).toBeDefined();
    expect(result.down).toBeDefined();
  });

  it('extracts grid dimensions correctly', () => {
    const solution = [
      ['A', 'B'],
      ['C', '.'],
    ];
    const buffer = buildPuzBuffer({
      nrow: 2,
      ncol: 2,
      solution,
      clues: ['Across 1', 'Down 1'],
      title: '',
    });

    const result = PUZtoJSON(buffer);
    expect(result.grid).toHaveLength(2);
    expect(result.grid[0]).toHaveLength(2);
  });

  it('identifies black and white squares', () => {
    const solution = [
      ['A', 'B'],
      ['C', '.'],
    ];
    const buffer = buildPuzBuffer({
      nrow: 2,
      ncol: 2,
      solution,
      clues: ['Across 1', 'Down 1'],
    });

    const result = PUZtoJSON(buffer);
    expect(result.grid[0][0].type).toBe('white');
    expect(result.grid[0][0].solution).toBe('A');
    expect(result.grid[1][1].type).toBe('black');
  });

  it('extracts title and author', () => {
    const solution = [
      ['A', 'B'],
      ['C', '.'],
    ];
    const buffer = buildPuzBuffer({
      nrow: 2,
      ncol: 2,
      solution,
      clues: ['Clue 1', 'Clue 2'],
      title: 'My Title',
      author: 'My Author',
      copyright: '2024',
    });

    const result = PUZtoJSON(buffer);
    expect(result.info.title).toBe('My Title');
    expect(result.info.author).toBe('My Author');
    expect(result.info.copyright).toBe('2024');
  });

  it('extracts clues in order', () => {
    const solution = [
      ['A', 'B'],
      ['C', '.'],
    ];
    const buffer = buildPuzBuffer({
      nrow: 2,
      ncol: 2,
      solution,
      clues: ['First clue', 'Second clue'],
    });

    const result = PUZtoJSON(buffer);
    // Should have clues indexed by number
    const acrossClues = result.across.filter(Boolean);
    const downClues = result.down.filter(Boolean);
    expect(acrossClues.length + downClues.length).toBeGreaterThan(0);
  });

  it('handles scrambled puzzle as contest', () => {
    const solution = [
      ['A', 'B'],
      ['C', 'D'],
    ];
    const buffer = buildPuzBuffer({
      nrow: 2,
      ncol: 2,
      solution,
      clues: ['c1', 'c2', 'c3', 'c4'],
    });

    // Manually set scramble flag bytes 50-51 to non-zero
    const bytes = new Uint8Array(buffer);
    bytes[50] = 1;

    const result = PUZtoJSON(bytes.buffer);
    expect(result.contest).toBe(true);
    // White cells should have empty solutions
    expect(result.grid[0][0].type).toBe('white');
    expect(result.grid[0][0].solution).toBe('');
    expect(result.grid[0][1].solution).toBe('');
    // Clues should still be extracted
    expect(result.info).toBeDefined();
  });

  it('decodes Windows-1252 special characters in clues', () => {
    // Build a buffer with raw Windows-1252 bytes for special chars:
    // 0x93 = left double quote, 0x94 = right double quote, 0x97 = em dash
    const solution = [
      ['A', 'B'],
      ['C', '.'],
    ];
    const buffer = buildPuzBuffer({
      nrow: 2,
      ncol: 2,
      solution,
      clues: ['placeholder', 'placeholder'],
    });

    // Patch the first clue bytes in the buffer to contain Windows-1252 chars.
    // The clue area starts after header(52) + solution(4) + state(4) + title(\0) + author(\0) + copyright(\0)
    const bytes = new Uint8Array(buffer);
    // Find "placeholder" in the bytes after the grid area
    const gridEnd = 52 + 2 * 2 * 2; // header + solution + state
    // Skip 3 null-terminated empty strings (title, author, copyright)
    const clueStart = gridEnd + 3; // 3 null bytes for empty title/author/copyright

    // Write: 0x93 A 0x94 0x97 B 0x00 (clue with smart quotes and em dash)
    bytes[clueStart] = 0x93; // left double quote
    bytes[clueStart + 1] = 0x41; // A
    bytes[clueStart + 2] = 0x94; // right double quote
    bytes[clueStart + 3] = 0x97; // em dash
    bytes[clueStart + 4] = 0x42; // B
    bytes[clueStart + 5] = 0x00; // null terminator

    const result = PUZtoJSON(bytes.buffer);
    const acrossClues = result.across.filter(Boolean);
    expect(acrossClues[0]).toBe('\u201CA\u201D\u2014B'); // "A"—B
  });

  it('decodes UTF-8 encoded special characters in clues', () => {
    // Some modern .puz files use UTF-8 for clue text containing Unicode chars
    // like box-drawing symbols (□ = U+25A1 = UTF-8 bytes E2 96 A1)
    const solution = [
      ['A', 'B'],
      ['C', '.'],
    ];
    const buffer = buildPuzBuffer({
      nrow: 2,
      ncol: 2,
      solution,
      clues: ['placeholder', 'placeholder'],
    });

    const bytes = new Uint8Array(buffer);
    const gridEnd = 52 + 2 * 2 * 2;
    const clueStart = gridEnd + 3;

    // Write UTF-8 bytes for "A□B" where □ is U+25A1 (E2 96 A1)
    bytes[clueStart] = 0x41; // A
    bytes[clueStart + 1] = 0xe2; // □ byte 1
    bytes[clueStart + 2] = 0x96; // □ byte 2
    bytes[clueStart + 3] = 0xa1; // □ byte 3
    bytes[clueStart + 4] = 0x42; // B
    bytes[clueStart + 5] = 0x00; // null terminator

    const result = PUZtoJSON(bytes.buffer);
    const acrossClues = result.across.filter(Boolean);
    expect(acrossClues[0]).toBe('A\u25A1B'); // A□B
  });

  it('returns empty circles and shades when no extensions', () => {
    const solution = [
      ['A', 'B'],
      ['C', '.'],
    ];
    const buffer = buildPuzBuffer({
      nrow: 2,
      ncol: 2,
      solution,
      clues: ['c1', 'c2'],
    });

    const result = PUZtoJSON(buffer);
    expect(result.circles).toEqual([]);
    expect(result.shades).toEqual([]);
  });

  it('marks normal puzzle as not contest', () => {
    const solution = [
      ['A', 'B'],
      ['C', '.'],
    ];
    const buffer = buildPuzBuffer({
      nrow: 2,
      ncol: 2,
      solution,
      clues: ['c1', 'c2'],
    });

    const result = PUZtoJSON(buffer);
    expect(result.contest).toBe(false);
  });

  describe('contest puzzle detection (all-X solution)', () => {
    it('detects all-X solution as contest', () => {
      const solution = [
        ['X', 'X'],
        ['X', '.'],
      ];
      const buffer = buildPuzBuffer({
        nrow: 2,
        ncol: 2,
        solution,
        clues: ['c1', 'c2'],
      });

      const result = PUZtoJSON(buffer);
      expect(result.contest).toBe(true);
    });

    it('clears solution values for contest puzzles', () => {
      const solution = [
        ['X', 'X'],
        ['X', '.'],
      ];
      const buffer = buildPuzBuffer({
        nrow: 2,
        ncol: 2,
        solution,
        clues: ['c1', 'c2'],
      });

      const result = PUZtoJSON(buffer);
      expect(result.grid[0][0].solution).toBe('');
      expect(result.grid[0][1].solution).toBe('');
      expect(result.grid[1][0].solution).toBe('');
      expect(result.grid[1][1].type).toBe('black');
    });

    it('detects any uniform single-letter solution as contest', () => {
      const solution = [
        ['A', 'A'],
        ['A', '.'],
      ];
      const buffer = buildPuzBuffer({
        nrow: 2,
        ncol: 2,
        solution,
        clues: ['c1', 'c2'],
      });

      const result = PUZtoJSON(buffer);
      expect(result.contest).toBe(true);
    });

    it('does not flag varied solution as contest', () => {
      const solution = [
        ['A', 'B'],
        ['C', '.'],
      ];
      const buffer = buildPuzBuffer({
        nrow: 2,
        ncol: 2,
        solution,
        clues: ['c1', 'c2'],
      });

      const result = PUZtoJSON(buffer);
      expect(result.contest).toBe(false);
    });
  });

  describe('extension sections (GRBS / RTBL / GEXT)', () => {
    const utf8 = (str) => Array.from(new TextEncoder().encode(str));

    // 3x3 with a rebus in the top-left cell, so grid[0][0] is the first
    // letter of both 1-Across and 1-Down.
    const buildRebusPuzzle = (rtbl) => {
      const solution = [
        ['C', 'A', 'T'],
        ['A', 'R', 'E'],
        ['B', '.', 'N'],
      ];
      const grbs = new Array(9).fill(0);
      grbs[0] = 1; // cell 0 -> rebus table key 0
      const gext = new Array(9).fill(0);
      gext[4] = 128; // circle in the middle cell
      return buildPuzBuffer({
        nrow: 3,
        ncol: 3,
        solution,
        clues: ['c1', 'c2', 'c3', 'c4', 'c5'],
        extensions: [
          {code: 'GRBS', data: grbs},
          {code: 'RTBL', data: utf8(rtbl)},
          {code: 'LTIM', data: utf8('0,1')},
          {code: 'GEXT', data: gext},
          // RUSR (user-entered rebus) trails GEXT in real files; its header
          // bytes are what a length-overrunning GEXT read would pick up.
          {code: 'RUSR', data: new Array(9).fill(0)},
        ],
      });
    };

    it('reads a multi-letter rebus answer into the grid', () => {
      const result = PUZtoJSON(buildRebusPuzzle(' 0:CAT;'));
      expect(result.grid[0][0].solution).toBe('CAT');
    });

    it('reads a non-ASCII rebus answer without mojibake', () => {
      // The RTBL length is declared in the header; reading past it drags in
      // the next section's binary checksum, which fails the strict UTF-8
      // decode and silently falls back to Windows-1252 (\u7a0b -> 'ç¨‹').
      const result = PUZtoJSON(buildRebusPuzzle(' 0:\u7a0b;'));
      expect(result.grid[0][0].solution).toBe('\u7a0b');
    });

    it('reads circles only from the declared GEXT length', () => {
      // Reading past the declared length walks into the following section,
      // whose header bytes have the high bit set and read as extra circles.
      const result = PUZtoJSON(buildRebusPuzzle(' 0:CAT;'));
      expect(result.circles).toEqual([4]);
    });
  });
});
