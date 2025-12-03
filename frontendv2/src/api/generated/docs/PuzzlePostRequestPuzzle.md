# PuzzlePostRequestPuzzle

## Properties

| Name         | Type                                                                      |
| ------------ | ------------------------------------------------------------------------- |
| `version`    | string                                                                    |
| `kind`       | Array&lt;string&gt;                                                       |
| `dimensions` | [PuzzlePostRequestPuzzleDimensions](PuzzlePostRequestPuzzleDimensions.md) |
| `title`      | string                                                                    |
| `author`     | string                                                                    |
| `copyright`  | string                                                                    |
| `notes`      | string                                                                    |
| `solution`   | Array&lt;Array&lt;PuzzlePostRequestPuzzleSolutionInnerInner&gt;&gt;       |
| `puzzle`     | Array&lt;Array&lt;PuzzlePostRequestPuzzlePuzzleInnerInner&gt;&gt;         |
| `clues`      | [PuzzlePostRequestPuzzleClues](PuzzlePostRequestPuzzleClues.md)           |

## Example

```typescript
import type { PuzzlePostRequestPuzzle } from ''

// TODO: Update the object below with actual values
const example = {
  "version": http://ipuz.org/v1,
  "kind": ["http://ipuz.org/crossword#1"],
  "dimensions": null,
  "title": null,
  "author": null,
  "copyright": null,
  "notes": null,
  "solution": null,
  "puzzle": null,
  "clues": null,
} satisfies PuzzlePostRequestPuzzle

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as PuzzlePostRequestPuzzle
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)
