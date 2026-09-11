
# FeedRailPerson

Someone the reader follows, with what they have published in the last seven days.  `savesThisWeek` counts **public** saves only, which is the same number anyone could count by opening the person\'s profile. A rail that reported private activity would be leaking a library one integer at a time.

## Properties

Name | Type
------------ | -------------
`person` | [FeedActor](FeedActor.md)
`savesThisWeek` | number

## Example

```typescript
import type { FeedRailPerson } from '@cosmic-dolphin/api-client'

// TODO: Update the object below with actual values
const example = {
  "person": null,
  "savesThisWeek": null,
} satisfies FeedRailPerson

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as FeedRailPerson
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


