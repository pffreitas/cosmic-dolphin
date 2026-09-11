
# FeedItem

One row of the Home feed - docs/functional-spec/05-feed.md.  `rankingReason` is generated **server-side** from the top two contributing signals and is never synthesised on the client: the client cannot know what the ranker weighted, and a plausible-sounding wrong answer is worse than none. It is absent on `pending`, which is pinned rather than ranked.

## Properties

Name | Type
------------ | -------------
`type` | [FeedItemType](FeedItemType.md)
`bookmark` | [Bookmark](Bookmark.md)
`digest` | [Digest](Digest.md)
`actor` | [FeedActor](FeedActor.md)
`rankingReason` | string
`signals` | [Array&lt;RankingSignal&gt;](RankingSignal.md)

## Example

```typescript
import type { FeedItem } from '@cosmic-dolphin/api-client'

// TODO: Update the object below with actual values
const example = {
  "type": null,
  "bookmark": null,
  "digest": null,
  "actor": null,
  "rankingReason": null,
  "signals": null,
} satisfies FeedItem

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as FeedItem
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


