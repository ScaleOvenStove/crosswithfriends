# GetGameById200Response

## Properties

| Name       | Type   |
| ---------- | ------ |
| `gid`      | string |
| `pid`      | string |
| `title`    | string |
| `author`   | string |
| `duration` | number |
| `size`     | string |

## Example

```typescript
import type { GetGameById200Response } from '';

// TODO: Update the object below with actual values
const example = {
  gid: null,
  pid: null,
  title: null,
  author: null,
  duration: null,
  size: Mini,
} satisfies GetGameById200Response;

console.log(example);

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example);
console.log(exampleJSON);

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as GetGameById200Response;
console.log(exampleParsed);
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)
