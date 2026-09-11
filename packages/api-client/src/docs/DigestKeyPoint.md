
# DigestKeyPoint

One finding in a digest.  Findings, **not a sequence**: the UI renders them with a dot marker and never numbers them, because numbering claims an order the content does not have (docs/design-system/patterns.md § AI callout).

## Properties

Name | Type
------------ | -------------
`term` | string
`text` | string

## Example

```typescript
import type { DigestKeyPoint } from '@cosmic-dolphin/api-client'

// TODO: Update the object below with actual values
const example = {
  "term": null,
  "text": null,
} satisfies DigestKeyPoint

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as DigestKeyPoint
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


