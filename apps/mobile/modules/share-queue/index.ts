import { requireOptionalNativeModule } from "expo-modules-core";
export interface ShareQueueNative {
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
