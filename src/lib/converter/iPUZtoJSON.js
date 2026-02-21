function convertCluesArray(initialCluesArray) {
  const finalCluesArray = [];

  for (let i = 0; i < initialCluesArray.length; i++) {
    const item = initialCluesArray[i];
    let number;
    let stringClue;
    if (Array.isArray(item)) {
      number = parseInt(item[0], 10);
      stringClue = item[1];
    } else {
      number = parseInt(item.number, 10);
      stringClue = item.clue;
    }
    finalCluesArray[parseInt(number, 10)] = stringClue;
  }

  return finalCluesArray;
}

export default function iPUZtoJSON(readerResult) {
  const jsonFromReader = JSON.parse(new TextDecoder().decode(readerResult));
  const hasSolution = !!jsonFromReader.solution;
  const gridSource = jsonFromReader.solution || jsonFromReader.puzzle;
  const grid = gridSource.map((row) =>
    row.map((cell) => {
      if (cell === null || cell === '#') return '.';
      if (!hasSolution) return ''; // no solution — white cells are empty
      return cell;
    })
  );
  const info = {
    type: grid.length > 10 ? 'Daily Puzzle' : 'Mini Puzzle',
    title: jsonFromReader.title || '',
    author: jsonFromReader.author || '',
    description: jsonFromReader.notes || '',
  };
  const circles = [];
  const shades = [];

  jsonFromReader.puzzle.forEach((row, rowIndex) => {
    row.forEach((cell, cellIndex) => {
      if (typeof cell === 'object' && cell?.style?.shapebg && cell.style.shapebg === 'circle') {
        circles.push(rowIndex * row.length + cellIndex);
      }
    });
  });

  let across = [];
  let down = [];

  Object.entries(jsonFromReader.clues).forEach(([direction, clues]) => {
    if (direction === 'Across') {
      across = convertCluesArray(clues);
    } else if (direction === 'Down') {
      down = convertCluesArray(clues);
    }
  });

  return {
    grid,
    info,
    circles,
    shades,
    across,
    down,
  };
}
