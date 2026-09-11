
# GetReadingProgressResponse

Where the reader left off, or nothing if they never started.  `null` and a `percent` of 0 are different answers: the first says the bookmark has never been opened, the second that it was opened and not scrolled. The reader restores a scroll position for the second and not for the first.

## Properties

Name | Type
------------ | -------------
`progress` | [ReadingProgress](ReadingProgress.md)

## Example

```typescript
import type { GetReadingProgressResponse } from '@cosmic-dolphin/api-client'

// TODO: Update the object below with actual values
const example = {
  "progress": null,
} satisfies GetReadingProgressResponse

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as GetReadingProgressResponse
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


