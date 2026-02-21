import PUZtoJSON from '../PUZtoJSON';

// Build a minimal valid .puz binary buffer
function buildPuzBuffer({nrow, ncol, solution, clues, title, author, copyright, description}) {
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

  it('throws on scrambled puzzle', () => {
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

    expect(() => PUZtoJSON(bytes.buffer)).toThrow('Scrambled');
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
});
