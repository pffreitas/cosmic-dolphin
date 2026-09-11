
# BookmarkProcessingPhase

The pipeline\'s phases, in order - docs/functional-spec/03-ai-pipeline.md. Sequential, each independently retryable. `fetch` through `file` are surfaced in the UI as a five-line checklist; `embed` runs silently because it has no user-legible output.

## Properties

Name | Type
------------ | -------------

## Example

```typescript
import type { BookmarkProcessingPhase } from '@cosmic-dolphin/api-client'

// TODO: Update the object below with actual values
const example = {
} satisfies BookmarkProcessingPhase

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as BookmarkProcessingPhase
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


