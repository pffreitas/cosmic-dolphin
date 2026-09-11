
# RankingSignal

One signal\'s contribution to one item\'s score. Debugging only - present outside production, absent in it. Never the source of the reason string: `rankingReason` is written by the ranker, which is the only thing that knows what it actually weighted.

## Properties

Name | Type
------------ | -------------
`name` | string
`weight` | number
`value` | number
`contribution` | number

## Example

```typescript
import type { RankingSignal } from '@cosmic-dolphin/api-client'

// TODO: Update the object below with actual values
const example = {
  "name": null,
  "weight": null,
  "value": null,
  "contribution": null,
} satisfies RankingSignal

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as RankingSignal
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


