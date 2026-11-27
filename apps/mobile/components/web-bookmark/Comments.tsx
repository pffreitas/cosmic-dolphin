import React, { useEffect, useRef, useState } from "react";
import { Text, TextInput, View } from "react-native";
import type { Comment } from "@cosmic-dolphin/api-client";
import { radius } from "@/constants/theme";
import { MobileAPI } from "@/lib/mobile-api";
import { SheetButton } from "@/components/web-save/SaveSheet";
import { Copy } from "@/components/web-home/Primitives";
import { relativeTime } from "@/components/web-home/data";
import { useWebTheme, webText, webSansFont } from "@/components/web-home/theme";

/** The detail thread is inline. The route keys this leaf by account and bookmark. */
export function DetailComments({
  id,
  accountId,
}: {
  id: string;
  accountId?: string;
}) {
  const { colors } = useWebTheme();
  const [comments, setComments] = useState<Comment[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true),
    [posting, setPosting] = useState(false);
  const [error, setError] = useState(""),
    [revision, setRevision] = useState(0);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    let current = true;
    setLoading(true);
    setError("");
    void MobileAPI.comments(id, accountId)
      .then((result) => {
        if (current) setComments(result.comments);
      })
      .catch(() => {
        if (current) setError("Comments couldn't load.");
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [id, accountId, revision]);
  const post = async () => {
    if (!accountId || !body.trim() || posting) return;
    setPosting(true);
    try {
      await MobileAPI.comment(id, body.trim(), accountId);
      if (alive.current) {
        setBody("");
        setRevision((n) => n + 1);
      }
    } catch {
      if (alive.current) setError("Your comment was not posted. Try again.");
    } finally {
      if (alive.current) setPosting(false);
    }
  };
  return (
    <View accessibilityLabel="Comments" style={{ gap: 16 }}>
      <Text
        accessibilityRole="header"
        style={[webText("title3"), { color: colors.fg }]}
      >
        Comments
      </Text>
      {loading ? (
        <Copy>Loading the conversation…</Copy>
      ) : !comments.length && !error ? (
        <Copy>No comments yet.</Copy>
      ) : null}
      {comments.map((comment) => (
        <View
          key={comment.id}
          style={{
            gap: 6,
            paddingVertical: 14,
            borderBottomWidth: 1,
            borderColor: colors.border,
            marginLeft: comment.parentId ? 28 : 0,
          }}
        >
          {comment.isDeleted ? (
            <Copy>Comment deleted</Copy>
          ) : (
            <>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                <Copy
                  style={{ fontFamily: webSansFont(500), color: colors.fg }}
                >
                  {comment.author?.name || comment.author?.handle || "Reader"}
                </Copy>
                <Copy role="meta">
                  {relativeTime(comment.createdAt)}
                  {comment.isEdited ? " · edited" : ""}
                </Copy>
              </View>
              <Copy>{comment.body}</Copy>
            </>
          )}
        </View>
      ))}
      {error ? (
        <View style={{ gap: 8 }}>
          <Copy style={{ color: colors.danger }}>{error}</Copy>
          <SheetButton
            label="Retry comments"
            onPress={() => setRevision((n) => n + 1)}
          />
        </View>
      ) : null}
      {accountId ? (
        <>
          <TextInput
            accessibilityLabel="Add a public comment"
            placeholder="Add a comment"
            placeholderTextColor={colors.fgTertiary}
            multiline
            value={body}
            onChangeText={setBody}
            style={[
              webText("bodySm"),
              {
                minHeight: 72,
                padding: 12,
                color: colors.fg,
                backgroundColor: colors.bgPanel,
                borderWidth: 1,
                borderColor: colors.borderStrong,
                borderRadius: radius.md,
              },
            ]}
          />
          <Copy role="meta">
            Comments are public. Your highlights remain private.
          </Copy>
          <View style={{ alignSelf: "flex-start" }}>
            <SheetButton
              label="Comment"
              primary
              busy={posting}
              disabled={!body.trim()}
              onPress={() => {
                void post();
              }}
            />
          </View>
        </>
      ) : (
        <Copy role="meta">Sign in to comment.</Copy>
      )}
    </View>
  );
}
