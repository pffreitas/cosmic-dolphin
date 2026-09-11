
# OpenGraph


## Properties

Name | Type
------------ | -------------
`type` | string
`url` | string
`title` | string
`description` | string
`siteName` | string
`image` | string
`imageAlt` | string
`imageWidth` | number
`imageHeight` | number
`articlePublishedTime` | string
`articleModifiedTime` | string

## Example

```typescript
import type { OpenGraph } from '@cosmic-dolphin/api-client'

// TODO: Update the object below with actual values
const example = {
  "type": null,
  "url": null,
  "title": null,
  "description": null,
  "siteName": null,
  "image": null,
  "imageAlt": null,
  "imageWidth": null,
  "imageHeight": null,
  "articlePublishedTime": null,
  "articleModifiedTime": null,
} satisfies OpenGraph

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as OpenGraph
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


