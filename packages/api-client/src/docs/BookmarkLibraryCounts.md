
# BookmarkLibraryCounts

The counts the Library rail renders beside its rows. One query rather than one request per node - the rail has as many rows as the user has collections, and a count per row would be a request per row.

## Properties

Name | Type
------------ | -------------
`all` | number
`inbox` | number
`unread` | number
`archived` | number
`collections` | [Array&lt;BookmarkCollectionCount&gt;](BookmarkCollectionCount.md)

## Example

```typescript
import type { BookmarkLibraryCounts } from '@cosmic-dolphin/api-client'

// TODO: Update the object below with actual values
const example = {
  "all": null,
  "inbox": null,
  "unread": null,
  "archived": null,
  "collections": null,
} satisfies BookmarkLibraryCounts

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as BookmarkLibraryCounts
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


