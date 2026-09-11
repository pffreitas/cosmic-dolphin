
# PublicProfile

A profile as anyone is allowed to see it.  **There is no `email` field here, and there must never be one** (docs/functional-spec/06-social.md § Profiles). This is not a rule the handlers remember to apply: the repository selects an explicit column list that omits `email`, `PublicProfile` in `packages/shared` is a standalone type rather than an `Omit<Profile, \"email\">` that would inherit new fields for free, and a compile-time assertion fails the build if the field ever appears. This model is the fourth lock, and the one a client can see.

## Properties

Name | Type
------------ | -------------
`id` | string
`handle` | string
`name` | string
`pictureUrl` | string
`joinedAt` | Date
`counts` | [PublicProfileCounts](PublicProfileCounts.md)
`isSelf` | boolean
`isFollowedByViewer` | boolean
`followsViewer` | boolean
`isBlockedByViewer` | boolean

## Example

```typescript
import type { PublicProfile } from '@cosmic-dolphin/api-client'

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "handle": null,
  "name": null,
  "pictureUrl": null,
  "joinedAt": null,
  "counts": null,
  "isSelf": null,
  "isFollowedByViewer": null,
  "followsViewer": null,
  "isBlockedByViewer": null,
} satisfies PublicProfile

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as PublicProfile
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


