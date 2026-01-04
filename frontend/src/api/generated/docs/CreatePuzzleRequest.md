# CreatePuzzleRequest

## Properties

| Name       | Type                                                      |
| ---------- | --------------------------------------------------------- |
| `puzzle`   | [CreatePuzzleRequestPuzzle](CreatePuzzleRequestPuzzle.md) |
| `pid`      | string                                                    |
| `isPublic` | boolean                                                   |

## Example

```typescript
import type { CreatePuzzleRequest } from '';

// TODO: Update the object below with actual values
const example = {
  puzzle: null,
  pid: null,
  isPublic: null,
} satisfies CreatePuzzleRequest;

console.log(example);

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example);
console.log(exampleJSON);

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as CreatePuzzleRequest;
console.log(exampleParsed);
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)
