
# BookmarkSort

Library ordering - docs/functional-spec/04-library.md § Ordering.  `newest` is chronological by `created_at` descending. It is the default and must always be one click away: AI organisation is an overlay on that order, never a replacement for it.

## Properties

Name | Type
------------ | -------------

## Example

```typescript
import type { BookmarkSort } from '@cosmic-dolphin/api-client'

// TODO: Update the object below with actual values
const example = {
} satisfies BookmarkSort

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as BookmarkSort
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


