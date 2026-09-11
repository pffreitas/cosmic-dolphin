
# Profile

The caller\'s own profile.  The only profile shape that carries an email, because it is the caller\'s own. Everything anyone else sees is a `PublicProfile`.

## Properties

Name | Type
------------ | -------------
`id` | string
`name` | string
`email` | string
`pictureUrl` | string
`handle` | string
`handleClaimed` | boolean
`handleChangeAvailableAt` | Date
`createdAt` | Date
`updatedAt` | Date

## Example

```typescript
import type { Profile } from '@cosmic-dolphin/api-client'

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "name": null,
  "email": null,
  "pictureUrl": null,
  "handle": null,
  "handleClaimed": null,
  "handleChangeAvailableAt": null,
  "createdAt": null,
  "updatedAt": null,
} satisfies Profile

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as Profile
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


