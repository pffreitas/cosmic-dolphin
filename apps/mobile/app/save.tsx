import React, { useEffect, useRef, useState } from "react";
import { Keyboard, Platform } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SaveSheet } from "@/components/web-save/SaveSheet";
import { useCaptures } from "@/contexts/CaptureContext";
import { useAuth } from "@/contexts/AuthContext";
import { MobileAPI } from "@/lib/mobile-api";
import { captureUrl } from "@/components/web-home/data";
import { readWhen, savedReadWhenCopy, type SaveReadWhen } from "@/lib/read-when";
export default function SaveScreen() {
  const { user } = useAuth();
  const params = useLocalSearchParams<{ url?: string; accountId?: string; privateLink?: string; captureSource?: string }>();
  const scope = useRef({ accountId: user?.id, generation: 0 });
  if (scope.current.accountId !== user?.id) {
    scope.current = { accountId: user?.id, generation: scope.current.generation + 1 };
  }
  const identity = scope.current;
  const pastedUrl = identity.generation === 0 && typeof params.url === "string"
    && (typeof params.accountId === "string" && params.accountId === user?.id) ? params.url : "";
  // A new account gets a fresh form synchronously, including confirmation fields.
  return <SaveForm key={identity.generation} pastedUrl={pastedUrl} initialSource={pastedUrl && params.captureSource !== "save_sheet" ? "clipboard" : "save_sheet"} privateLink={!!pastedUrl && params.privateLink === "true"} isCurrent={() => scope.current === identity} />;
}
function SaveForm({ pastedUrl, initialSource, privateLink, isCurrent }: { pastedUrl: string; initialSource: "clipboard" | "save_sheet"; privateLink: boolean; isCurrent: () => boolean }) {
  const { user } = useAuth();
  const router = useRouter();
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const current = () => alive.current && isCurrent();
  const { save, confirm, captures } = useCaptures();
  const [source, setSource] = useState(initialSource);
  const [url, setUrl] = useState(pastedUrl);
  const [isPrivate, setPrivate] = useState(privateLink);
  const [description, setDescription] = useState("");
  const [previewTitle, setPreviewTitle] = useState<string>();
  const [note, setNote] = useState("");
  const [when, setWhen] = useState<SaveReadWhen>("No rush");
  const [savedId, setSavedId] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);
  const capture = captures.find(value => value.id === savedId);
  // Metadata is a bonus, never a precondition. Owner/route lifetime fences a
  // late preview even if transport ignores AbortSignal.
  useEffect(() => {
    if (!isPrivate || !user?.id || savedId) return;
    const controller = new AbortController();
    setPreviewTitle(undefined);
    void MobileAPI.preview(url.trim(), controller.signal, user.id).then(result => {
      if (!controller.signal.aborted && current()) setPreviewTitle(result.metadata.title || undefined);
    }).catch(() => {});
    return () => controller.abort();
    // current() reads synchronous owner/lifetime refs; no effect identity dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPrivate, url, user?.id, savedId]);
  const submit = async () => {
    if (!current() || submitting.current || savedId) return;
    const candidate = captureUrl(url);
    if (!candidate) { setError("That does not look like a link. Check the address and try again."); return; }
    if (isPrivate && !description.trim()) {
      setError("Add a brief description so this private link is findable later."); return;
    }
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      const id = await save({ sourceUrl: candidate, captureSource: source,
        capturePlatform: Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "web",
        ...(isPrivate ? { isPrivateLink: true, description: description.trim(), ...(previewTitle ? { title: previewTitle } : {}) } : {}) });
      if (current()) { Keyboard.dismiss(); setSavedId(id); }
    } catch { if (current()) setError("Couldn't save on this phone. Try again."); }
    finally { submitting.current = false; if (current()) setBusy(false); }
  };
  const finish = async () => {
    if (!current() || !savedId || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      await confirm(savedId, note, readWhen(when));
      if (!current()) return;
      if (router.canGoBack()) router.back();
      else router.replace("/(tabs)");
    } catch { if (current()) setError("Change was not saved. Check your connection."); }
    finally { submitting.current = false; if (current()) setBusy(false); }
  };
  const close = () => {
    if (!current()) return;
    Keyboard.dismiss();
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)");
  };
  const openPrivate = () => {
    const candidate = captureUrl(url);
    if (!candidate) { setError("That does not look like a link. Check the address and try again."); return; }
    setUrl(candidate); setError(""); setPrivate(true); Keyboard.dismiss();
  };
  return <SaveSheet stage={savedId ? "confirmation" : isPrivate ? "private" : "link"}
    url={url} description={description} note={note} when={when} busy={busy} error={error} previewTitle={previewTitle}
    heading={capture?.status === "saved" ? capture.alreadySaved ? "Already in your Library" : capture.bookmark?.isPrivateLink ? "Private link saved" : "Saved. Cosmic is reading it." : "Saved on this phone"}
    status={savedId && capture?.status !== "saved" ? "Saved on this phone. Cosmic reads it when you open the app." : undefined}
    timing={when !== "No rush" ? savedReadWhenCopy(readWhen(when)) : undefined}
    onUrl={value => { setUrl(value); setSource("save_sheet"); setError(""); }}
    onPaste={value => { setUrl(value.trim()); setSource("clipboard"); setError(""); }}
    onDescription={value => { setDescription(value); setError(""); }} onNote={setNote} onWhen={setWhen}
    onPrivate={openPrivate} onSave={() => { void submit(); }} onDone={() => { void finish(); }} onClose={close} />;
}
