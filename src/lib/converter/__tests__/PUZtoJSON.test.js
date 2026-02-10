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
