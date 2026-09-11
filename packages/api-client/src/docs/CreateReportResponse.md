
# CreateReportResponse

Deliberately thin.  It says the report was received and nothing else. It does not say what will happen, does not echo the target back, and — most importantly — carries no signal that the reported content has changed state, because it has not.

## Properties

Name | Type
------------ | -------------
`reported` | boolean

## Example

```typescript
import type { CreateReportResponse } from '@cosmic-dolphin/api-client'

// TODO: Update the object below with actual values
const example = {
  "reported": null,
} satisfies CreateReportResponse

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as CreateReportResponse
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


