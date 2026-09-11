
# FeedActor

The person a feed item reached the viewer through — everything the provenance row draws, and nothing else.  Deliberately **not** `PublicProfile`. A page of 20 items can carry 20 distinct authors, and a `PublicProfile` carries four counts that cost a query each; 80 count queries to render a name and a 22px avatar is not a trade worth making. The handle is here, so the profile — counts and all — is one link away at `GET /users/{handle}`.

## Properties

Name | Type
------------ | -------------
`id` | string
`handle` | string
`name` | string
`pictureUrl` | string

## Example

```typescript
import type { FeedActor } from '@cosmic-dolphin/api-client'

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "handle": null,
  "name": null,
  "pictureUrl": null,
} satisfies FeedActor

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as FeedActor
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


