
# Digest

An AI-authored feed item that groups 3-6 of the user\'s own recent saves into a single observation - docs/functional-spec/05-feed.md § Digests.  Generated on a schedule per user by the worker, by clustering the last 14 days of saves on embedding proximity and asking the model for a thesis plus 2-3 key points **only when the cluster is genuinely coherent**. A weak cluster produces no digest at all, which is why there is no \"confidence\" or \"quality\" field here: a digest that exists has already passed the bar, and a digest that did not pass it was never written.  A digest is a **first-class social object**. It has its own likes, its own share link, and its own detail route. Sharing one shares the digest, not its sources: the source bookmarks\' visibility is never touched by anything done to the digest.

## Properties

Name | Type
------------ | -------------
`id` | string
`title` | string
`summary` | string
`keyPoints` | [Array&lt;DigestKeyPoint&gt;](DigestKeyPoint.md)
`sources` | [Array&lt;DigestSource&gt;](DigestSource.md)
`coherence` | number
`createdAt` | Date
`likeCount` | number
`isLikedByCurrentUser` | boolean
`isPublic` | boolean
`shareUrl` | string

## Example

```typescript
import type { Digest } from '@cosmic-dolphin/api-client'

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "title": null,
  "summary": null,
  "keyPoints": null,
  "sources": null,
  "coherence": null,
  "createdAt": null,
  "likeCount": null,
  "isLikedByCurrentUser": null,
  "isPublic": null,
  "shareUrl": null,
} satisfies Digest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as Digest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


