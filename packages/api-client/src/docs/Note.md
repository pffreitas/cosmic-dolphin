
# Note


## Properties

Name | Type
------------ | -------------
`id` | number
`documentId` | number
`title` | string
`summary` | string
`body` | string
`tags` | Array&lt;string&gt;
`type` | [NoteType](NoteType.md)
`userId` | string
`createdAt` | string
`resources` | [Array&lt;Resource&gt;](Resource.md)

## Example

```typescript
import type { Note } from '@cosmic-dolphin/api-client'

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "documentId": null,
  "title": null,
  "summary": null,
  "body": null,
  "tags": null,
  "type": null,
  "userId": null,
  "createdAt": null,
  "resources": null,
} satisfies Note

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as Note
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


