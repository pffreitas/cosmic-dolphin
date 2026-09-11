
# UpdateBookmarkRequest

Partial update of a bookmark. Every field is optional and an absent field is left alone.  Where the bookmark is filed is deliberately not here: moving a bookmark is `PATCH /bookmarks/{id}/collection`, which writes `filing_source` in the same statement as the move.

## Properties

Name | Type
------------ | -------------
`title` | string
`isArchived` | boolean
`tags` | Array&lt;string&gt;
`cosmicSummary` | string

## Example

```typescript
import type { UpdateBookmarkRequest } from '@cosmic-dolphin/api-client'

// TODO: Update the object below with actual values
const example = {
  "title": null,
  "isArchived": null,
  "tags": null,
  "cosmicSummary": null,
} satisfies UpdateBookmarkRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as UpdateBookmarkRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


