import { BookmarkLikeRepository } from "../repositories";

export interface LikeResult {
  likeCount: number;
  isLikedByCurrentUser: boolean;
}

export interface BookmarkLikeService {
  like(userId: string, bookmarkId: string): Promise<LikeResult>;
  unlike(userId: string, bookmarkId: string): Promise<LikeResult>;
  isLikedByUser(userId: string, bookmarkId: string): Promise<boolean>;
  getLikeCount(bookmarkId: string): Promise<number>;
}

export class BookmarkLikeServiceImpl implements BookmarkLikeService {
  constructor(private bookmarkLikeRepository: BookmarkLikeRepository) {}

  async like(userId: string, bookmarkId: string): Promise<LikeResult> {
    await this.bookmarkLikeRepository.like(userId, bookmarkId);
    const likeCount = await this.bookmarkLikeRepository.getLikeCount(bookmarkId);
    return { likeCount, isLikedByCurrentUser: true };
  }

  async unlike(userId: string, bookmarkId: string): Promise<LikeResult> {
    await this.bookmarkLikeRepository.unlike(userId, bookmarkId);
    const likeCount = await this.bookmarkLikeRepository.getLikeCount(bookmarkId);
    return { likeCount, isLikedByCurrentUser: false };
  }

  async isLikedByUser(userId: string, bookmarkId: string): Promise<boolean> {
    return this.bookmarkLikeRepository.isLikedByUser(userId, bookmarkId);
  }

  async getLikeCount(bookmarkId: string): Promise<number> {
    return this.bookmarkLikeRepository.getLikeCount(bookmarkId);
  }
}
