
# CreateReportRequest

A report of a public bookmark or a comment.  Exactly one target. Reported content **stays visible** pending review: auto-hide is trivially weaponised, so nothing about filing this changes what anyone can see.

## Properties

Name | Type
------------ | -------------
`bookmarkId` | string
`commentId` | string
`reason` | string

## Example

```typescript
import type { CreateReportRequest } from '@cosmic-dolphin/api-client'

// TODO: Update the object below with actual values
const example = {
  "bookmarkId": null,
  "commentId": null,
  "reason": null,
} satisfies CreateReportRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as CreateReportRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


