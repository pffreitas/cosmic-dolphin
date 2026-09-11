
# SearchMatchKind

How a result earned its place in the list.  `keyword` — the query\'s words are literally in the save. `semantic` — the save was reached only through vector similarity, so nothing the reader typed appears in it. The distinction is carried to the client because a row with no visible match has to explain itself: `/search` renders a `Related` tag on the semantic ones (docs/design-system/pages.md § Search).

## Properties

Name | Type
------------ | -------------

## Example

```typescript
import type { SearchMatchKind } from '@cosmic-dolphin/api-client'

// TODO: Update the object below with actual values
const example = {
} satisfies SearchMatchKind

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as SearchMatchKind
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


