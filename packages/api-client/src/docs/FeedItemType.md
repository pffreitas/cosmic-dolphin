
# FeedItemType

What a feed item *is* - docs/functional-spec/05-feed.md § Item types.  `pending` is a save still being processed. It is pinned to the top of the feed regardless of score, because the user just created it and expects to see it. `digest` is an AI-authored grouping of the user\'s own saves; it carries a `digest` payload instead of a `bookmark`, and the ranker spaces it at one per eight items, three per session.

## Properties

Name | Type
------------ | -------------

## Example

```typescript
import type { FeedItemType } from '@cosmic-dolphin/api-client'

// TODO: Update the object below with actual values
const example = {
} satisfies FeedItemType

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as FeedItemType
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


