
# ExploreResponse

A page of Explore - docs/design-system/pages.md § Explore.  The same `FeedItem` shape Home uses, ranked for **discovery** rather than personal usefulness: engagement on public saves with a recency decay, over everybody\'s public library rather than the reader\'s own and the people they follow. `rankingReason` still comes from the server and is still never synthesised on the client.  `topics` rides along with the page because the segmented control is part of the same surface and a second request for six strings would reflow the page once for nothing.

## Properties

Name | Type
------------ | -------------
`items` | [Array&lt;FeedItem&gt;](FeedItem.md)
`topics` | [Array&lt;ExploreTopic&gt;](ExploreTopic.md)
`nextCursor` | string
`computedAt` | Date

## Example

```typescript
import type { ExploreResponse } from '@cosmic-dolphin/api-client'

// TODO: Update the object below with actual values
const example = {
  "items": null,
  "topics": null,
  "nextCursor": null,
  "computedAt": null,
} satisfies ExploreResponse

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ExploreResponse
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


