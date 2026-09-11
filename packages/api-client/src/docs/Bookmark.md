
# Bookmark


## Properties

Name | Type
------------ | -------------
`id` | string
`sourceUrl` | string
`createdAt` | Date
`updatedAt` | Date
`collectionId` | string
`collectionPath` | [Array&lt;CollectionPathItem&gt;](CollectionPathItem.md)
`title` | string
`isArchived` | boolean
`isFavorite` | boolean
`cosmicImages` | [Array&lt;BookmarkImage&gt;](BookmarkImage.md)
`cosmicLinks` | [Array&lt;BookmarkLink&gt;](BookmarkLink.md)
`cosmicSummary` | string
`cosmicBriefSummary` | string
`cosmicKeyPoints` | Array&lt;string&gt;
`cosmicTags` | Array&lt;string&gt;
`metadata` | [BookmarkMetadata](BookmarkMetadata.md)
`userId` | string
`isPrivateLink` | boolean
`likeCount` | number
`isLikedByCurrentUser` | boolean
`commentCount` | number
`savedFromBookmarkId` | string
`isPublic` | boolean
`shareSlug` | string
`readAt` | Date
`isRead` | boolean
`processingStatus` | [ProcessingStatus](ProcessingStatus.md)
`processingStartedAt` | Date
`processingCompletedAt` | Date
`processingError` | string

## Example

```typescript
import type { Bookmark } from '@cosmic-dolphin/api-client'

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "sourceUrl": null,
  "createdAt": null,
  "updatedAt": null,
  "collectionId": null,
  "collectionPath": null,
  "title": null,
  "isArchived": null,
  "isFavorite": null,
  "cosmicImages": null,
  "cosmicLinks": null,
  "cosmicSummary": null,
  "cosmicBriefSummary": null,
  "cosmicKeyPoints": null,
  "cosmicTags": null,
  "metadata": null,
  "userId": null,
  "isPrivateLink": null,
  "likeCount": null,
  "isLikedByCurrentUser": null,
  "commentCount": null,
  "savedFromBookmarkId": null,
  "isPublic": null,
  "shareSlug": null,
  "readAt": null,
  "isRead": null,
  "processingStatus": null,
  "processingStartedAt": null,
  "processingCompletedAt": null,
  "processingError": null,
} satisfies Bookmark

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as Bookmark
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


