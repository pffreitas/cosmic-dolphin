
# CosmicError


## Properties

Name | Type
------------ | -------------
`code` | number
`message` | string

## Example

```typescript
import type { CosmicError } from '@cosmic-dolphin/api-client'

// TODO: Update the object below with actual values
const example = {
  "code": null,
  "message": null,
} satisfies CosmicError

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as CosmicError
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


