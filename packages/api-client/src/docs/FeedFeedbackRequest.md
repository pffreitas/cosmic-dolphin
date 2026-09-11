
# FeedFeedbackRequest

One piece of feedback. Exactly one target field is required, and which one is decided by `kind` — a `fewer_domain` with only a `bookmarkId` is a 400, not a best effort, because guessing which domain the reader meant is exactly the kind of \"helpfulness\" that mutes the wrong source.

## Properties

Name | Type
------------ | -------------
`kind` | [FeedFeedbackKind](FeedFeedbackKind.md)
`bookmarkId` | string
`domain` | string
`topic` | string

## Example

```typescript
import type { FeedFeedbackRequest } from '@cosmic-dolphin/api-client'

// TODO: Update the object below with actual values
const example = {
  "kind": null,
  "bookmarkId": null,
  "domain": null,
  "topic": null,
} satisfies FeedFeedbackRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as FeedFeedbackRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


