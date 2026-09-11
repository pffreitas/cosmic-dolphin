
# ContinueReadingItem

A bookmark the reader is part-way through, for Home\'s Continue reading rail.

## Properties

Name | Type
------------ | -------------
`bookmark` | [Bookmark](Bookmark.md)
`progress` | [ReadingProgress](ReadingProgress.md)

## Example

```typescript
import type { ContinueReadingItem } from '@cosmic-dolphin/api-client'

// TODO: Update the object below with actual values
const example = {
  "bookmark": null,
  "progress": null,
} satisfies ContinueReadingItem

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ContinueReadingItem
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


