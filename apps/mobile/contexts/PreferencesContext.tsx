import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "./AuthContext";

type Preferences = {
  appearance: "system" | "light" | "dark";
  readingSize: "default" | "large" | "larger";
  interests: string[];
  hiddenTopics: string[];
};
const defaults: Preferences = {
  appearance: "system",
  readingSize: "default",
  interests: [],
  hiddenTopics: [],
};
const Context = createContext({
  ...defaults,
  ready: false,
  update: (_patch: Partial<Preferences>) => {},
});
export function PreferencesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState(defaults);
  const [ready, setReady] = useState(false);
  const key = user?.id ? `cosmic:preferences:${user.id}` : null;
  const currentKey = useRef(key);
  currentKey.current = key;
  useEffect(() => {
    let active = true;
    setReady(false);
    setPreferences(defaults);
    if (!key) {
      setReady(true);
      return;
    }
    AsyncStorage.getItem(key)
      .then((value) => {
        if (!active || !value) return;
        const parsed = JSON.parse(value);
        setPreferences({
          appearance: ["system", "light", "dark"].includes(parsed.appearance)
            ? parsed.appearance
            : "system",
          readingSize: ["default", "large", "larger"].includes(
            parsed.readingSize,
          )
            ? parsed.readingSize
            : "default",
          interests: Array.isArray(parsed.interests)
            ? parsed.interests.filter((v: unknown) => typeof v === "string")
            : [],
          hiddenTopics: Array.isArray(parsed.hiddenTopics)
            ? parsed.hiddenTopics.filter((v: unknown) => typeof v === "string")
            : [],
        });
      })
      .catch(() => {})
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, [key]);
  const update = useCallback(
    (patch: Partial<Preferences>) => {
      setPreferences((previous) => {
        const next = { ...previous, ...patch };
        if (key && ready && currentKey.current === key)
          AsyncStorage.setItem(key, JSON.stringify(next)).catch(() => {});
        return next;
      });
    },
    [key, ready],
  );
  return (
    <Context.Provider value={{ ...preferences, ready, update }}>
      {children}
    </Context.Provider>
  );
}
export const usePreferences = () => useContext(Context);
