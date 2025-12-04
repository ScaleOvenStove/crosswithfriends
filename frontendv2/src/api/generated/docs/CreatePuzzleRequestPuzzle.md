# CreatePuzzleRequestPuzzle

## Properties

| Name         | Type                                                                          |
| ------------ | ----------------------------------------------------------------------------- |
| `version`    | string                                                                        |
| `kind`       | Array&lt;string&gt;                                                           |
| `dimensions` | [CreatePuzzleRequestPuzzleDimensions](CreatePuzzleRequestPuzzleDimensions.md) |
| `title`      | string                                                                        |
| `author`     | string                                                                        |
| `copyright`  | string                                                                        |
| `notes`      | string                                                                        |
| `solution`   | Array&lt;Array&lt;CreatePuzzleRequestPuzzleSolutionInnerInner&gt;&gt;         |
| `puzzle`     | Array&lt;Array&lt;CreatePuzzleRequestPuzzlePuzzleInnerInner&gt;&gt;           |
| `clues`      | [CreatePuzzleRequestPuzzleClues](CreatePuzzleRequestPuzzleClues.md)           |
| `grid`       | Array&lt;Array&lt;CreatePuzzleRequestPuzzleSolutionInnerInner&gt;&gt;         |
| `info`       | [CreatePuzzleRequestPuzzleInfo](CreatePuzzleRequestPuzzleInfo.md)             |

## Example

```typescript
import type { CreatePuzzleRequestPuzzle } from '';

// TODO: Update the object below with actual values
const example = {
  version: null,
  kind: null,
  dimensions: null,
  title: null,
  author: null,
  copyright: null,
  notes: null,
  solution: null,
  puzzle: null,
  clues: null,
  grid: null,
  info: null,
} satisfies CreatePuzzleRequestPuzzle;

console.log(example);

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example);
console.log(exampleJSON);

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as CreatePuzzleRequestPuzzle;
console.log(exampleParsed);
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)
