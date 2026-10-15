export const BOOKMARK_MODEL_IDS = {
  large: process.env.BOOKMARK_MODEL_LARGE || "openai/gpt-6-luna",
  small: process.env.BOOKMARK_MODEL_SMALL || "openai/gpt-6-luna",
};

export type BookmarkModelCategory = keyof typeof BOOKMARK_MODEL_IDS;
