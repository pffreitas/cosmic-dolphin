import React, { useState } from "react";
import { Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import HomeGallery from "./home";
import { SaveSheet } from "@/components/web-save/SaveSheet";
import type { SaveReadWhen } from "@/lib/read-when";

/** Visual fixture only. Real capture/provider/HTTP proof uses the /save route. */
export default function SaveGallery() {
  const params = useLocalSearchParams<{ stage?: string; url?: string; invalid?: string }>();
  const [stage, setStage] = useState<"link" | "private" | "confirmation">(params.stage === "private" ? "private" : params.stage === "confirmation" ? "confirmation" : "link");
  const [url, setUrl] = useState(params.url ?? (stage === "private" ? "https://example.com/private" : ""));
  const [description, setDescription] = useState("");
  const [note, setNote] = useState("");
  const [when, setWhen] = useState<SaveReadWhen>("No rush");
  if (!__DEV__) return <Text>Not found</Text>;
  return <View style={{ flex: 1 }}><View style={{ flex: 1 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><HomeGallery /></View><View style={{ position: "absolute", inset: 0 }}>
    <SaveSheet clipboard={false} stage={stage} url={url} description={description} note={note} when={when}
      heading="Saved. Cosmic is reading it." error={params.invalid === "true" ? "That does not look like a link. Check the address and try again." : undefined}
      onUrl={setUrl} onPaste={setUrl} onDescription={setDescription} onNote={setNote} onWhen={setWhen}
      onPrivate={() => setStage("private")} onSave={() => setStage("confirmation")} onDone={() => setStage("link")} onClose={() => setStage("link")} />
  </View></View>;
}
