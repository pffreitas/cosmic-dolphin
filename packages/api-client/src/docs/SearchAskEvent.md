
# SearchAskEvent

One frame of the `/search/ask` stream.  The stream is SSE and the `event:` name carries the discriminator:    `sources` — always first, and always before any `chunk`. Empty means the               query matched nothing, and no `chunk` follows it.   `chunk`   — a fragment of the answer, in order.   `done`    — the stream is complete.   `error`   — the run failed; nothing more follows.  Modelled rather than left as an opaque `string` so `SearchAnswerSource` reaches the generated client, which is where the \"an answer names its sources\" rule has to be typed for a client to be able to honour it.

## Properties

Name | Type
------------ | -------------
`event` | string
`sources` | [Array&lt;SearchAnswerSource&gt;](SearchAnswerSource.md)
`text` | string
`error` | string

## Example

```typescript
import type { SearchAskEvent } from '@cosmic-dolphin/api-client'

// TODO: Update the object below with actual values
const example = {
  "event": null,
  "sources": null,
  "text": null,
  "error": null,
} satisfies SearchAskEvent

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as SearchAskEvent
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


