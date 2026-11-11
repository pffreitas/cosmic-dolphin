import { useEffect } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";

/** Keep old reader links usable in the unified bookmark reading view. */
export default function ReaderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  useEffect(() => {
    router.replace({ pathname: "/bookmark/[id]", params: { id, mode: "read" } });
  }, [id, router]);
  return null;
}
