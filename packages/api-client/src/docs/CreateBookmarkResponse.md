
# CreateBookmarkResponse


## Properties

Name | Type
------------ | -------------
`bookmark` | [Bookmark](Bookmark.md)
`message` | string
`alreadySaved` | boolean

## Example

```typescript
import type { CreateBookmarkResponse } from '@cosmic-dolphin/api-client'

// TODO: Update the object below with actual values
const example = {
  "bookmark": null,
  "message": null,
  "alreadySaved": null,
} satisfies CreateBookmarkResponse

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as CreateBookmarkResponse
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


