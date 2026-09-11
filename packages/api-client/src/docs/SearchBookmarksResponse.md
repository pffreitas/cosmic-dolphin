
# SearchBookmarksResponse


## Properties

Name | Type
------------ | -------------
`bookmarks` | [Array&lt;Bookmark&gt;](Bookmark.md)
`total` | number

## Example

```typescript
import type { SearchBookmarksResponse } from '@cosmic-dolphin/api-client'

// TODO: Update the object below with actual values
const example = {
  "bookmarks": null,
  "total": null,
} satisfies SearchBookmarksResponse

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as SearchBookmarksResponse
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


