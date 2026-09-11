
# PipelineStage


## Properties

Name | Type
------------ | -------------
`id` | number
`name` | string
`key` | string
`status` | [PipelineStatus](PipelineStatus.md)
`createdAt` | Date
`updatedAt` | Date

## Example

```typescript
import type { PipelineStage } from '@cosmic-dolphin/api-client'

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "name": null,
  "key": null,
  "status": null,
  "createdAt": null,
  "updatedAt": null,
} satisfies PipelineStage

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as PipelineStage
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


