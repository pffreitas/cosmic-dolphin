export enum EventType {
  BOOKMARK_CREATED = "bookmark.created",
  BOOKMARK_PART_UPDATED = "bookmark.part.updated",
  BOOKMARK_UPDATED = "bookmark.updated",
}

export interface Event<T> {
  type: EventType;
  data: T;
  timestamp: Date;
}
