
# BookmarkProcessingTimelineResponse


## Properties

Name | Type
------------ | -------------
`bookmark` | [Bookmark](Bookmark.md)
`run` | [BookmarkProcessingRun](BookmarkProcessingRun.md)
`events` | [Array&lt;BookmarkProcessingEvent&gt;](BookmarkProcessingEvent.md)
`pollAfterMs` | number

## Example

```typescript
import type { BookmarkProcessingTimelineResponse } from '@cosmic-dolphin/api-client'

// TODO: Update the object below with actual values
const example = {
  "bookmark": null,
  "run": null,
  "events": null,
  "pollAfterMs": null,
} satisfies BookmarkProcessingTimelineResponse

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as BookmarkProcessingTimelineResponse
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


