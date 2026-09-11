
# CommentAuthor

The public identity behind a comment. Never carries an email — see `PublicProfile`.

## Properties

Name | Type
------------ | -------------
`id` | string
`handle` | string
`name` | string
`pictureUrl` | string

## Example

```typescript
import type { CommentAuthor } from '@cosmic-dolphin/api-client'

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "handle": null,
  "name": null,
  "pictureUrl": null,
} satisfies CommentAuthor

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as CommentAuthor
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


