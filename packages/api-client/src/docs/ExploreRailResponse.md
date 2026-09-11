
# ExploreRailResponse

Explore\'s rail - docs/design-system/pages.md § Explore.  Both lists are empty until the social graph is populated, and the client is expected to say so honestly rather than pad the column with the reader\'s own material.

## Properties

Name | Type
------------ | -------------
`collections` | [Array&lt;TrendingCollection&gt;](TrendingCollection.md)
`people` | [Array&lt;TrendingPerson&gt;](TrendingPerson.md)

## Example

```typescript
import type { ExploreRailResponse } from '@cosmic-dolphin/api-client'

// TODO: Update the object below with actual values
const example = {
  "collections": null,
  "people": null,
} satisfies ExploreRailResponse

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ExploreRailResponse
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


