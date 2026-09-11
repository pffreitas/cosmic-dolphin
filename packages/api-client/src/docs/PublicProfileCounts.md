
# PublicProfileCounts

Public counts only. The size of someone\'s private library is theirs.

## Properties

Name | Type
------------ | -------------
`followers` | number
`following` | number
`publicSaves` | number
`collections` | number

## Example

```typescript
import type { PublicProfileCounts } from '@cosmic-dolphin/api-client'

// TODO: Update the object below with actual values
const example = {
  "followers": null,
  "following": null,
  "publicSaves": null,
  "collections": null,
} satisfies PublicProfileCounts

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as PublicProfileCounts
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


