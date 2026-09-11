
# BookmarkScope

Which slice of the library a query is about - the Library rail\'s rows, docs/functional-spec/04-library.md § Collections.  `all` is every non-archived save. `inbox` narrows that to the ones nothing has filed yet (`collection_id IS NULL`). `archive` is the only scope that returns `is_archived = true` rows, which is what makes archiving a way out of the list rather than a delete.

## Properties

Name | Type
------------ | -------------

## Example

```typescript
import type { BookmarkScope } from '@cosmic-dolphin/api-client'

// TODO: Update the object below with actual values
const example = {
} satisfies BookmarkScope

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as BookmarkScope
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


