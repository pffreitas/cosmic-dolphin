
# FeedFeedbackKind

What the reader said about an item they did not want - docs/functional-spec/05-feed.md § Feedback.  Three kinds, and they are not three flavours of the same thing:   - `not_interested` is about **this item**. It carries `bookmarkId` and    nothing else, and the item never appears again in any scope.  - `fewer_domain` is about a **source**. It carries `domain`, and it is a    weight rather than a ban — \"fewer\", not \"none\", is what the menu says    and what the ranker does.  - `mute_topic` is about a **subject**. It carries `topic`, and everything    tagged with it leaves the feed until the user unmutes it.  Dismissal outweighs any positive signal by three to one (`dismissalWeight`), because a person who takes the trouble to tell a feed it is wrong is giving it better evidence than a click ever does.

## Properties

Name | Type
------------ | -------------

## Example

```typescript
import type { FeedFeedbackKind } from '@cosmic-dolphin/api-client'

// TODO: Update the object below with actual values
const example = {
} satisfies FeedFeedbackKind

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as FeedFeedbackKind
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


