
# UpdateCollectionRequest

Rename, recolour, or reparent. Every field is optional; an absent field is left alone. `parentId: null` moves the collection back to the root.

## Properties

Name | Type
------------ | -------------
`name` | string
`description` | string
`color` | string
`icon` | string
`parentId` | string
`isPublic` | boolean

## Example

```typescript
import type { UpdateCollectionRequest } from '@cosmic-dolphin/api-client'

// TODO: Update the object below with actual values
const example = {
  "name": null,
  "description": null,
  "color": null,
  "icon": null,
  "parentId": null,
  "isPublic": null,
} satisfies UpdateCollectionRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as UpdateCollectionRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


