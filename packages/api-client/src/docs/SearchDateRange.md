
# SearchDateRange

How far back a search looks, by the save\'s own `createdAt`.  A coarse range rather than a pair of dates: the question a reader actually asks of their own library is \"recently\" or \"ever\", and two date pickers buy precision nobody uses at the price of a form.

## Properties

Name | Type
------------ | -------------

## Example

```typescript
import type { SearchDateRange } from '@cosmic-dolphin/api-client'

// TODO: Update the object below with actual values
const example = {
} satisfies SearchDateRange

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as SearchDateRange
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


