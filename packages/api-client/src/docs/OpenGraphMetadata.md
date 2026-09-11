
# OpenGraphMetadata


## Properties

Name | Type
------------ | -------------
`favicon` | string
`title` | string
`description` | string
`image` | string
`url` | string
`siteName` | string
`type` | string
`locale` | string
`articleAuthor` | string
`articlePublishedTime` | string
`articleModifiedTime` | string
`articleSection` | string
`articleTag` | Array&lt;string&gt;

## Example

```typescript
import type { OpenGraphMetadata } from '@cosmic-dolphin/api-client'

// TODO: Update the object below with actual values
const example = {
  "favicon": null,
  "title": null,
  "description": null,
  "image": null,
  "url": null,
  "siteName": null,
  "type": null,
  "locale": null,
  "articleAuthor": null,
  "articlePublishedTime": null,
  "articleModifiedTime": null,
  "articleSection": null,
  "articleTag": null,
} satisfies OpenGraphMetadata

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as OpenGraphMetadata
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


