
# ReadingProgress

How far into a bookmark the reader has got.  Separate from `Bookmark.readAt`, which stays the only record of *read*. Progress is evidence; read state is a decision. The reader may suggest marking read at 90%, and never sets it silently.

## Properties

Name | Type
------------ | -------------
`bookmarkId` | string
`percent` | number
`scrollOffset` | number
`updatedAt` | Date

## Example

```typescript
import type { ReadingProgress } from '@cosmic-dolphin/api-client'

// TODO: Update the object below with actual values
const example = {
  "bookmarkId": null,
  "percent": null,
  "scrollOffset": null,
  "updatedAt": null,
} satisfies ReadingProgress

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ReadingProgress
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


