
# DigestSource

One bookmark a digest was built from - docs/functional-spec/05-feed.md § Digests.  This model is the contract behind the `Built from` provenance row, and the reason it carries a `url` and a `domain` as well as an id: the row renders a favicon chip and a domain *as a link*, and a client that had only the id would have to fetch every source to draw the one line that makes the digest trustworthy.  A digest names **every** bookmark it was built from. `Digest.sources` is never truncated server-side; the `+n more` tail in the UI is a display decision taken over a complete list.

## Properties

Name | Type
------------ | -------------
`bookmarkId` | string
`title` | string
`url` | string
`domain` | string
`faviconUrl` | string

## Example

```typescript
import type { DigestSource } from '@cosmic-dolphin/api-client'

// TODO: Update the object below with actual values
const example = {
  "bookmarkId": null,
  "title": null,
  "url": null,
  "domain": null,
  "faviconUrl": null,
} satisfies DigestSource

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as DigestSource
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


