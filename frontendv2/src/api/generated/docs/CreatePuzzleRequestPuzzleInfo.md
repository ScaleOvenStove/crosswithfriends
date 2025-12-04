
# CreatePuzzleRequestPuzzleInfo

Legacy format: Puzzle metadata

## Properties

Name | Type
------------ | -------------
`type` | string
`title` | string
`author` | string
`description` | string

## Example

```typescript
import type { CreatePuzzleRequestPuzzleInfo } from ''

// TODO: Update the object below with actual values
const example = {
  "type": null,
  "title": null,
  "author": null,
  "description": null,
} satisfies CreatePuzzleRequestPuzzleInfo

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as CreatePuzzleRequestPuzzleInfo
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


