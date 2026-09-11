
# BookmarkProcessingEvent


## Properties

Name | Type
------------ | -------------
`id` | string
`runId` | string
`parentEventId` | string
`kind` | [BookmarkProcessingEventKind](BookmarkProcessingEventKind.md)
`phase` | string
`name` | string
`status` | [BookmarkProcessingTimelineStatus](BookmarkProcessingTimelineStatus.md)
`sequence` | number
`startedAt` | Date
`endedAt` | Date
`durationMs` | number
`modelId` | string
`inputTokens` | number
`outputTokens` | number
`totalTokens` | number
`reasoningTokens` | number
`cachedInputTokens` | number
`costUsd` | string
`providerMetadata` | { [key: string]: any; }
`metadata` | { [key: string]: any; }
`error` | string
`createdAt` | Date
`updatedAt` | Date

## Example

```typescript
import type { BookmarkProcessingEvent } from '@cosmic-dolphin/api-client'

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "runId": null,
  "parentEventId": null,
  "kind": null,
  "phase": null,
  "name": null,
  "status": null,
  "sequence": null,
  "startedAt": null,
  "endedAt": null,
  "durationMs": null,
  "modelId": null,
  "inputTokens": null,
  "outputTokens": null,
  "totalTokens": null,
  "reasoningTokens": null,
  "cachedInputTokens": null,
  "costUsd": null,
  "providerMetadata": null,
  "metadata": null,
  "error": null,
  "createdAt": null,
  "updatedAt": null,
} satisfies BookmarkProcessingEvent

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as BookmarkProcessingEvent
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


