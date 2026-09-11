
# TrendingCollection

A public collection with public saves in it, and who it belongs to.  Collections are the one library structure that survives being made public, so they are what Explore recommends rather than a second list of links.

## Properties

Name | Type
------------ | -------------
`id` | string
`name` | string
`description` | string
`saveCount` | number
`owner` | [FeedActor](FeedActor.md)

## Example

```typescript
import type { TrendingCollection } from '@cosmic-dolphin/api-client'

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "name": null,
  "description": null,
  "saveCount": null,
  "owner": null,
} satisfies TrendingCollection

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as TrendingCollection
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


