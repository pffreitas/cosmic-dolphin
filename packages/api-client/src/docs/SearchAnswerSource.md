
# SearchAnswerSource

One bookmark an answer was built from.  Rule 8: no AI output ships without naming its sources, and a source that is not a link is not provenance — `bookmarkId` is what makes each one clickable. An answer with an empty `sources` array is not an answer and the server does not stream one.

## Properties

Name | Type
------------ | -------------
`bookmarkId` | string
`title` | string
`domain` | string
`faviconUrl` | string

## Example

```typescript
import type { SearchAnswerSource } from '@cosmic-dolphin/api-client'

// TODO: Update the object below with actual values
const example = {
  "bookmarkId": null,
  "title": null,
  "domain": null,
  "faviconUrl": null,
} satisfies SearchAnswerSource

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as SearchAnswerSource
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


