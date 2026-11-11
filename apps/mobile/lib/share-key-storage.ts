import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import { Platform } from "react-native";
import { sharedKeychain } from "../modules/share-queue";
import type { SharedShareKey } from "./share-key";

const privateOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };
const sharedItemKey = "share-key";
export const shareKeyStorage = {
  async read(): Promise<SharedShareKey | null> {
    const value = Platform.OS === "ios" ? await sharedKeychain().readShareKey()
      : Platform.OS === "web" ? globalThis.localStorage?.getItem(sharedItemKey)
      : await SecureStore.getItemAsync(sharedItemKey, privateOptions);
    return value ? JSON.parse(value) : null;
  },
  async write(value: SharedShareKey) {
    const payload = JSON.stringify(value);
    if (Platform.OS === "ios") await sharedKeychain().writeShareKey(payload);
    else if (Platform.OS === "web") globalThis.localStorage?.setItem(sharedItemKey, payload);
    else await SecureStore.setItemAsync(sharedItemKey, payload, privateOptions);
  },
  async remove() {
    if (Platform.OS === "ios") await sharedKeychain().removeShareKey();
    else if (Platform.OS === "web") globalThis.localStorage?.removeItem(sharedItemKey);
    else await SecureStore.deleteItemAsync(sharedItemKey, privateOptions);
  },
  async deviceId() {
    const key = "share-installation-id";
    const stored = Platform.OS === "web" ? globalThis.localStorage?.getItem(key) : await SecureStore.getItemAsync(key, privateOptions);
    if (stored) return stored;
    const id = Crypto.randomUUID();
    if (Platform.OS === "web") globalThis.localStorage?.setItem(key, id);
    else await SecureStore.setItemAsync(key, id, privateOptions);
    return id;
  },
};
