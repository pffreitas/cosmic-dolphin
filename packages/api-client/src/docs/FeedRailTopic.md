
# FeedRailTopic

A tag the reader has been saving this week, and how many times.

## Properties

Name | Type
------------ | -------------
`topic` | string
`count` | number

## Example

```typescript
import type { FeedRailTopic } from '@cosmic-dolphin/api-client'

// TODO: Update the object below with actual values
const example = {
  "topic": null,
  "count": null,
} satisfies FeedRailTopic

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as FeedRailTopic
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


