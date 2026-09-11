
# SaveReadingProgressResponse


## Properties

Name | Type
------------ | -------------
`progress` | [ReadingProgress](ReadingProgress.md)
`accepted` | boolean

## Example

```typescript
import type { SaveReadingProgressResponse } from '@cosmic-dolphin/api-client'

// TODO: Update the object below with actual values
const example = {
  "progress": null,
  "accepted": null,
} satisfies SaveReadingProgressResponse

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as SaveReadingProgressResponse
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


