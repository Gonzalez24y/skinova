import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import type { TokenCache } from "@clerk/expo/dist/cache";

const createTokenCache = (): TokenCache => ({
  getToken: async (key: string) => {
    if (Platform.OS === "web") return null;
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  saveToken: async (key: string, value: string) => {
    if (Platform.OS === "web") return;
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {}
  },
  clearToken: async (key: string) => {
    if (Platform.OS === "web") return;
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {}
  },
});

export const tokenCache = createTokenCache();
