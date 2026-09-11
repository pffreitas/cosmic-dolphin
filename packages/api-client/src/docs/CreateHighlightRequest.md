
# CreateHighlightRequest


## Properties

Name | Type
------------ | -------------
`quote` | string
`prefix` | string
`suffix` | string
`note` | string

## Example

```typescript
import type { CreateHighlightRequest } from '@cosmic-dolphin/api-client'

// TODO: Update the object below with actual values
const example = {
  "quote": null,
  "prefix": null,
  "suffix": null,
  "note": null,
} satisfies CreateHighlightRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as CreateHighlightRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


