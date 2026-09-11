
# DeleteCommentResponse

What happened to the comment.  A delete is one of two different things and the client has to render them differently: a comment with replies becomes a tombstone that stays in the thread, and a comment without replies stops existing.

## Properties

Name | Type
------------ | -------------
`deleted` | boolean
`comment` | [Comment](Comment.md)
`commentCount` | number

## Example

```typescript
import type { DeleteCommentResponse } from '@cosmic-dolphin/api-client'

// TODO: Update the object below with actual values
const example = {
  "deleted": null,
  "comment": null,
  "commentCount": null,
} satisfies DeleteCommentResponse

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as DeleteCommentResponse
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


