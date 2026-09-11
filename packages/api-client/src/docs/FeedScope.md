
# FeedScope

Which slice of the Home feed a request is about - docs/functional-spec/05-feed.md § Scopes.  `for_you` is the default and the only one that mixes sources: own unread saves, saves from followed users, and AI digests, ranked. `following` is the same ranking over followed saves alone. `unread` is the user\'s own unread saves in reverse chronological order with **no ranking at all** — which is what makes it the place an item the ranker has stopped serving is still reachable.

## Properties

Name | Type
------------ | -------------

## Example

```typescript
import type { FeedScope } from '@cosmic-dolphin/api-client'

// TODO: Update the object below with actual values
const example = {
} satisfies FeedScope

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as FeedScope
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


