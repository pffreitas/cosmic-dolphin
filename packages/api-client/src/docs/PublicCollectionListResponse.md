
# PublicCollectionListResponse


## Properties

Name | Type
------------ | -------------
`collections` | [Array&lt;PublicCollection&gt;](PublicCollection.md)
`nextCursor` | string

## Example

```typescript
import type { PublicCollectionListResponse } from '@cosmic-dolphin/api-client'

// TODO: Update the object below with actual values
const example = {
  "collections": null,
  "nextCursor": null,
} satisfies PublicCollectionListResponse

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as PublicCollectionListResponse
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


