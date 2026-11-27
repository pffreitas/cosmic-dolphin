import React, { useEffect, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import type { Comment, FeedItem } from "@cosmic-dolphin/api-client";
import { radius } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { MobileAPI } from "@/lib/mobile-api";
import { Action, Copy } from "./Primitives";
import { useWebTheme, webText } from "./theme";
import { relativeTime } from "./data";

/** Mounted only when requested. The owning Home is keyed by account. */
export function HomeComments({ item, onClose, offline }: { item: FeedItem; onClose: () => void; offline: boolean }) {
  const { user } = useAuth();
  const { colors } = useWebTheme();
  const [comments, setComments] = useState<Comment[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string>();
  const [revision, setRevision] = useState(0);
  const id = item.bookmark!.id;
  const count = loading ? item.bookmark?.commentCount ?? 0 : comments.filter(comment => !comment.isDeleted).length;
  const heading = count === 0 ? "Comments" : `${count} ${count === 1 ? "comment" : "comments"}`;
  useEffect(() => {
    let active = true;
    setLoading(true); setError(undefined);
    void MobileAPI.comments(id, user?.id).then(result => { if (active) setComments(result.comments); })
      .catch(() => { if (active) setError("Comments couldn't load."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, user?.id, revision]);
  // A separate leaf fences posting completions after close/unmount, too.
  const alive = React.useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const post = async () => {
    if (!body.trim() || posting || offline || !user) return;
    setPosting(true);
    try { await MobileAPI.comment(id, body.trim(), user.id); if (alive.current) { setBody(""); setRevision(n => n + 1); } }
    catch { if (alive.current) setError("Couldn't post that comment. Try again."); }
    finally { if (alive.current) setPosting(false); }
  };
  return <Modal visible transparent animationType="none" onRequestClose={onClose}>
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, justifyContent: "flex-end" }}>
      <Pressable onPress={onClose} accessibilityLabel="Close comments" style={{ position: "absolute", height: "100%", width: "100%", backgroundColor: colors.overlay }} />
      <SafeAreaView edges={["bottom"]} style={{ maxHeight: "90%", padding: 24, gap: 16, backgroundColor: colors.bgPanel, borderWidth: 1, borderColor: colors.border, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg }}>
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}><Copy role="title2" style={{ flex: 1, color: colors.fg }}>{heading}</Copy><Action label="Close comments" icon={X} onPress={onClose} /></View>
        <Copy lines={2}>{item.bookmark?.title}</Copy>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 0 }}>
          {loading ? <Copy>Loading comments…</Copy> : !error && !comments.length ? <Copy>No comments yet.</Copy> : null}
          {comments.map(comment => <View key={comment.id} style={{ paddingVertical: 14, marginLeft: comment.parentId ? 44 : 0, gap: 6, borderBottomWidth: 1, borderColor: colors.border }}>
            {comment.isDeleted ? <Copy style={{ fontStyle: "italic", color: colors.fgTertiary }}>Comment deleted</Copy> : <><View style={{ flexDirection: "row", gap: 8 }}><Copy style={{ fontFamily: "InterMedium", color: colors.fg }}>{comment.author?.name ?? comment.author?.handle}</Copy><Copy role="meta">{relativeTime(comment.createdAt)}{comment.isEdited ? " · edited" : ""}</Copy></View><Copy>{comment.body}</Copy></>}
          </View>)}
        </ScrollView>
        {error ? <View style={{ gap: 8 }}><Copy style={{ color: colors.danger }}>{error}</Copy><Action label="Retry comments" onPress={() => setRevision(n => n + 1)}>Retry</Action></View> : null}
        {offline ? <Copy>{"You're offline. Connect to post a comment."}</Copy> : <>
          <TextInput accessibilityLabel="Your comment" placeholder="Add a comment" placeholderTextColor={colors.fgTertiary} multiline value={body} onChangeText={setBody} style={[webText("bodySm"), { minHeight: 72, paddingHorizontal: 12, paddingVertical: 10, color: colors.fg, backgroundColor: colors.bgPanel, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.md }]} />
          <Action label="Post comment" primary disabled={posting || !body.trim()} onPress={() => { void post(); }}>Post comment</Action>
        </>}
      </SafeAreaView>
    </KeyboardAvoidingView>
  </Modal>;
}
