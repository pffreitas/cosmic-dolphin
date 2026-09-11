
# Comment

A comment on a bookmark.  Plain text plus links — no rich text, no images, no embeds, and no field here in which to put any. 2,000 characters.  **One level of nesting.** `parentId` is either absent (a top-level comment) or the id of a top-level comment. It is never the id of a reply: a `parentId` pointing at a reply is re-pointed server-side at that reply\'s own parent, so the client\'s request succeeds and lands where a one-level thread can hold it. Deep threads are where reading products turn into forums.

## Properties

Name | Type
------------ | -------------
`id` | string
`bookmarkId` | string
`parentId` | string
`body` | string
`author` | [CommentAuthor](CommentAuthor.md)
`createdAt` | Date
`updatedAt` | Date
`isEdited` | boolean
`isDeleted` | boolean
`isOwn` | boolean
`canEdit` | boolean

## Example

```typescript
import type { Comment } from '@cosmic-dolphin/api-client'

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "bookmarkId": null,
  "parentId": null,
  "body": null,
  "author": null,
  "createdAt": null,
  "updatedAt": null,
  "isEdited": null,
  "isDeleted": null,
  "isOwn": null,
  "canEdit": null,
} satisfies Comment

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as Comment
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


