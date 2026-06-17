export const BOOKMARK_MODEL_IDS = {
  large: "qwen/qwen3.7-plus",
  small: "deepseek/deepseek-v4-flash",
} as const;

export type BookmarkModelCategory = keyof typeof BOOKMARK_MODEL_IDS;
