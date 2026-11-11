import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo-modules-core";
export type PendingShare = { id: string; url: string; userId?: string; queuedAt: string; notBefore?: string };
export interface ShareQueueReader {
  readPendingShares(): Promise<string>;
  removePendingShares(ids: string[]): Promise<void>;
}
export interface ShareQueueNative extends ShareQueueReader {
  readShareKey(): Promise<string | null>;
  writeShareKey(payload: string): Promise<void>;
  removeShareKey(): Promise<void>;
  keychainProbe(): Promise<{ readable: boolean; accessGroup: string; service: string; account: string; deviceId: string; userId: string }>;
}
const nativeModule = requireOptionalNativeModule<ShareQueueNative>("ShareQueue");
export function sharedKeychain(): ShareQueueNative {
  if (!nativeModule) throw new Error("Shared keychain requires the native app build");
  return nativeModule;
}

export function pendingShares(): ShareQueueReader | null {
  return Platform.OS === "ios" ? nativeModule : null;
}

export type AndroidShare = { id: string; text: string; queuedAt: string; offline: boolean };
export interface AndroidShareBridge {
  readAndroidShares(): Promise<string>;
  removeAndroidShares(ids: string[]): Promise<void>;
  addListener(event: "onAndroidShare", listener: () => void): { remove(): void };
}
export function androidShares(): AndroidShareBridge | null {
  return Platform.OS === "android" ? nativeModule as unknown as AndroidShareBridge | null : null;
}
