
# CommentsResponse

A thread, chronological.  There is no ranking, no \"top comment\" and no score, and no field here in which to express one. Top-level comments are oldest first, and each one\'s replies are oldest first beneath it — a conversation reads forwards.

## Properties

Name | Type
------------ | -------------
`comments` | [Array&lt;Comment&gt;](Comment.md)
`commentCount` | number

## Example

```typescript
import type { CommentsResponse } from '@cosmic-dolphin/api-client'

// TODO: Update the object below with actual values
const example = {
  "comments": null,
  "commentCount": null,
} satisfies CommentsResponse

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as CommentsResponse
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


