
# TrendingPerson

Someone worth following, with their public output for the window.  `isFollowedByViewer` is computed for this list because it is short and bounded (the rail renders five) — unlike `/users/{handle}/followers`, where a relationship per row would be a query per row.

## Properties

Name | Type
------------ | -------------
`person` | [FeedActor](FeedActor.md)
`savesThisWeek` | number
`followers` | number
`isFollowedByViewer` | boolean

## Example

```typescript
import type { TrendingPerson } from '@cosmic-dolphin/api-client'

// TODO: Update the object below with actual values
const example = {
  "person": null,
  "savesThisWeek": null,
  "followers": null,
  "isFollowedByViewer": null,
} satisfies TrendingPerson

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as TrendingPerson
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


