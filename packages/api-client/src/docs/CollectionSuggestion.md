
# CollectionSuggestion

A collection the pipeline thinks should exist. It does not exist yet.  The `file` phase never creates a collection - it accumulates supporting bookmarks against a proposed name. Only `POST /collections/suggestions/{id}/accept` turns one into a collection.

## Properties

Name | Type
------------ | -------------
`id` | string
`userId` | string
`name` | string
`parentId` | string
`bookmarkIds` | Array&lt;string&gt;
`status` | [CollectionSuggestionStatus](CollectionSuggestionStatus.md)
`dismissedUntil` | Date
`createdAt` | Date

## Example

```typescript
import type { CollectionSuggestion } from '@cosmic-dolphin/api-client'

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "userId": null,
  "name": null,
  "parentId": null,
  "bookmarkIds": null,
  "status": null,
  "dismissedUntil": null,
  "createdAt": null,
} satisfies CollectionSuggestion

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as CollectionSuggestion
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


