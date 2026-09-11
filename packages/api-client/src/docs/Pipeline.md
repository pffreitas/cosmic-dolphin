
# Pipeline


## Properties

Name | Type
------------ | -------------
`id` | number
`refId` | number
`stages` | [Array&lt;PipelineStage&gt;](PipelineStage.md)
`status` | [PipelineStatus](PipelineStatus.md)
`createdAt` | Date

## Example

```typescript
import type { Pipeline } from '@cosmic-dolphin/api-client'

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "refId": null,
  "stages": null,
  "status": null,
  "createdAt": null,
} satisfies Pipeline

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as Pipeline
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


