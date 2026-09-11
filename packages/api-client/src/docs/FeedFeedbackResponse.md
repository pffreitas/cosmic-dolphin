
# FeedFeedbackResponse

What was recorded, echoed back.  Idempotent: sending the same feedback twice records one row and returns the same answer. The ranked head is dropped as part of the write, which is what makes \"takes effect on the next request\" true rather than aspirational — without it the reader would keep seeing the dismissed item for the remainder of the five-minute cache and reasonably conclude nothing happened.

## Properties

Name | Type
------------ | -------------
`kind` | [FeedFeedbackKind](FeedFeedbackKind.md)
`bookmarkId` | string
`domain` | string
`topic` | string
`rankingInvalidated` | boolean

## Example

```typescript
import type { FeedFeedbackResponse } from '@cosmic-dolphin/api-client'

// TODO: Update the object below with actual values
const example = {
  "kind": null,
  "bookmarkId": null,
  "domain": null,
  "topic": null,
  "rankingInvalidated": null,
} satisfies FeedFeedbackResponse

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as FeedFeedbackResponse
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


