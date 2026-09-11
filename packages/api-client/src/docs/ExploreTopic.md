
# ExploreTopic

A topic the product as a whole has been saving, and how many public saves carry it inside the discovery window.  This is **not** `FeedRailTopic`. That one counts the reader\'s own saves and answers \"what have I been reading\"; this one counts everyone\'s public saves and answers \"what is the product reading\". Same shape, different question, and collapsing them would make Explore a mirror of Home — which is exactly what Explore exists not to be.

## Properties

Name | Type
------------ | -------------
`topic` | string
`count` | number

## Example

```typescript
import type { ExploreTopic } from '@cosmic-dolphin/api-client'

// TODO: Update the object below with actual values
const example = {
  "topic": null,
  "count": null,
} satisfies ExploreTopic

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ExploreTopic
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


