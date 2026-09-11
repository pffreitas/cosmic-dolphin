
# FeedRailResponse

Home\'s rail, in one request - docs/design-system/pages.md § Home.  Continue reading is deliberately **not** here: it already has a route (`GET /bookmarks/continue-reading`) and duplicating it would give the same list two definitions of \"part-way through\".  Nothing in the rail is unique to it. Below 900px the rail is not rendered at all, and every destination it offers is reachable from Library, search, or a profile — so a failure here dims a column rather than costing the reader anything.

## Properties

Name | Type
------------ | -------------
`topics` | [Array&lt;FeedRailTopic&gt;](FeedRailTopic.md)
`people` | [Array&lt;FeedRailPerson&gt;](FeedRailPerson.md)

## Example

```typescript
import type { FeedRailResponse } from '@cosmic-dolphin/api-client'

// TODO: Update the object below with actual values
const example = {
  "topics": null,
  "people": null,
} satisfies FeedRailResponse

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as FeedRailResponse
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


