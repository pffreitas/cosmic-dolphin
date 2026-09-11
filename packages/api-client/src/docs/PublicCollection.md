
# PublicCollection

A collection as anyone is allowed to see it.  `saveCount` counts **public, non-archived** saves only. The size of the private half of a public collection is not a number anyone else gets, which is why this is not `Collection` with a field removed.

## Properties

Name | Type
------------ | -------------
`id` | string
`name` | string
`description` | string
`saveCount` | number
`createdAt` | Date

## Example

```typescript
import type { PublicCollection } from '@cosmic-dolphin/api-client'

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "name": null,
  "description": null,
  "saveCount": null,
  "createdAt": null,
} satisfies PublicCollection

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as PublicCollection
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


