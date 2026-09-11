
# LikeResponse


## Properties

Name | Type
------------ | -------------
`likeCount` | number
`isLikedByCurrentUser` | boolean

## Example

```typescript
import type { LikeResponse } from '@cosmic-dolphin/api-client'

// TODO: Update the object below with actual values
const example = {
  "likeCount": null,
  "isLikedByCurrentUser": null,
} satisfies LikeResponse

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as LikeResponse
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


