
# BookmarkProcessingRun


## Properties

Name | Type
------------ | -------------
`id` | string
`bookmarkId` | string
`userId` | string
`status` | [BookmarkProcessingTimelineStatus](BookmarkProcessingTimelineStatus.md)
`startedAt` | Date
`endedAt` | Date
`durationMs` | number
`inputTokens` | number
`outputTokens` | number
`totalTokens` | number
`reasoningTokens` | number
`cachedInputTokens` | number
`costUsd` | string
`error` | string
`createdAt` | Date
`updatedAt` | Date

## Example

```typescript
import type { BookmarkProcessingRun } from '@cosmic-dolphin/api-client'

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "bookmarkId": null,
  "userId": null,
  "status": null,
  "startedAt": null,
  "endedAt": null,
  "durationMs": null,
  "inputTokens": null,
  "outputTokens": null,
  "totalTokens": null,
  "reasoningTokens": null,
  "cachedInputTokens": null,
  "costUsd": null,
  "error": null,
  "createdAt": null,
  "updatedAt": null,
} satisfies BookmarkProcessingRun

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as BookmarkProcessingRun
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


