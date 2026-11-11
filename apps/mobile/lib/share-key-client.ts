import { ShareKeyManager } from "./share-key";
import { shareKeyStorage } from "./share-key-storage";
import { MobileAPI } from "./mobile-api";
export const shareKeys = new ShareKeyManager({
  storage: shareKeyStorage,
  api: { issue: MobileAPI.issueShareKey, revoke: MobileAPI.revokeShareKey },
  apiBaseUrl: (process.env.EXPO_PUBLIC_API_URL || "").replace(/\/$/, ""),
});
