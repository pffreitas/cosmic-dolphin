
# Highlight

A span of extracted content the reader kept.  Anchored by `quote` plus a short `prefix` and `suffix`, never by character offsets: the pipeline re-extracts a page on every reprocess and offsets would then point silently at the wrong sentence. Resolution against the current extraction happens on the client, in shared code, so a highlight that can no longer be placed is reported as orphaned rather than drawn in the wrong place.  Private to its author even when the bookmark is public.

## Properties

Name | Type
------------ | -------------
`id` | string
`bookmarkId` | string
`userId` | string
`quote` | string
`prefix` | string
`suffix` | string
`note` | string
`createdAt` | Date

## Example

```typescript
import type { Highlight } from '@cosmic-dolphin/api-client'

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "bookmarkId": null,
  "userId": null,
  "quote": null,
  "prefix": null,
  "suffix": null,
  "note": null,
  "createdAt": null,
} satisfies Highlight

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as Highlight
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


