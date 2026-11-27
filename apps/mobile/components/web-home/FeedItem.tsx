import React, { useContext, useEffect, useRef, useState } from "react";
import { HomeFeedFixtureContext } from "@/hooks/HomeFeedFixtureContext";
import { Image, Linking, Pressable, Share, Text, View } from "react-native";
import { Heart, MessageCircle, Bookmark as SaveIcon, Share as ShareIcon, MoreHorizontal, Lock } from "lucide-react-native";
import type { FeedItem as FeedEntry } from "@cosmic-dolphin/api-client";
import { useRouter } from "expo-router";
import { radius } from "@/constants/theme";
import { MobileAPI } from "@/lib/mobile-api";
import { bookmarkRoute } from "@/lib/bookmark-route";
import type { FeedCardActions } from "@/components/FeedCard";
import { useAuth } from "@/contexts/AuthContext";
import { SwipeableCard } from "@/components/SwipeableCard";
import { Thumbnail } from "./Thumbnail";
import { Action, Copy, Tag } from "./Primitives";
import { domainFor, identitySlot, relativeTime, socialCount } from "./data";
import { useWebTheme, webText } from "./theme";
import { BalancedTitle } from "./BalancedTitle";

export function Favicon({ domain, uri }: { domain: string; uri?: string }) {
  const { colors } = useWebTheme();
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);
  const slot = identitySlot(domain);
  const palette = colors as unknown as Record<string, string>;
  return <View accessible={false} style={{ width: 16, height: 16, borderRadius: radius.xs, overflow: "hidden", alignItems: "center", justifyContent: "center", backgroundColor: uri && !failed ? colors.bgInset : palette[`id${slot}Bg`] }}>
    {uri && !failed ? <Image source={{ uri }} onError={() => setFailed(true)} style={{ width: 16, height: 16 }} resizeMode="contain" />
      : <Text style={{ fontFamily: "InterSemibold", fontSize: 9, lineHeight: 12, color: palette[`id${slot}`] }}>{domain.replace(/^www\./, "").slice(0, 1).toUpperCase()}</Text>}
  </View>;
}
export function Provenance({ item }: { item: FeedEntry }) {
  const fixture = useContext(HomeFeedFixtureContext);
  const { colors } = useWebTheme();
  const bookmark = item.bookmark;
  if (!bookmark) return null;
  const domain = domainFor(bookmark.sourceUrl);
  const actor = item.actor;
  const slot = identitySlot(actor?.name ?? actor?.handle ?? "");
  const palette = colors as unknown as Record<string, string>;
  const meta = { fontSize: 12.5, lineHeight: 17.5, color: colors.fgSecondary, fontFamily: "Inter" };
  const segments: React.ReactNode[] = [];
  if (actor) {
    segments.push(<Pressable onPress={() => void Linking.openURL(`${process.env.EXPO_PUBLIC_SITE_URL || "https://cosmic-dolphin.com"}/u/${encodeURIComponent(actor.handle)}`)} accessibilityRole="button" accessibilityLabel={actor.name ?? actor.handle} style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
      <View style={{ width: 22, height: 22, borderRadius: radius.pill, backgroundColor: palette[`id${slot}Bg`], alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        {actor.pictureUrl ? <Image source={{ uri: actor.pictureUrl }} style={{ width: 22, height: 22 }} /> : <Text style={{ fontFamily: "InterSemibold", fontSize: 9, color: palette[`id${slot}`] }}>{(actor.name ?? actor.handle).split(/\s+/).slice(0, 2).map(p => p[0]).join("").toUpperCase()}</Text>}
      </View>
      <Text style={[meta, { color: colors.fg, fontFamily: "InterMedium" }]}>{actor.name ?? actor.handle}</Text>
    </Pressable>);
    segments.push(<Text style={meta}>shared</Text>);
  }
  segments.push(<View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}><Favicon domain={domain} uri={bookmark.metadata?.openGraph?.favicon} /><Text style={[meta, { color: colors.fg, fontFamily: "InterMedium" }]}>{domain}</Text></View>);
  if (!actor) segments.push(<Text style={meta}>you saved this</Text>);
  segments.push(<Text style={meta}>{relativeTime(bookmark.createdAt, __DEV__ ? fixture?.now : undefined)}</Text>);
  return <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 7, rowGap: 7 }}>
    {segments.map((segment, index) => <View key={index} style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>{index ? <Dot /> : null}{segment}</View>)}
  </View>;
}
function Dot() {
  const { colors } = useWebTheme();
  return <View accessible={false} style={{ width: 3, height: 3, borderRadius: radius.pill, backgroundColor: colors.fgTertiary }} />;
}
export function NativeFeedItem({ item, variant = "row", actions = {}, offline = false, onError, onComment }: {
  onComment?: () => void; item: FeedEntry; variant?: "lead" | "row"; actions?: FeedCardActions; offline?: boolean; onError: (message: string) => void;
}) {
  const { colors } = useWebTheme();
  const { user } = useAuth();
  const router = useRouter();
  const bookmark = item.bookmark;
  const [expanded, setExpanded] = useState(false);
  const [liked, setLiked] = useState(bookmark?.isLikedByCurrentUser ?? false);
  const [likes, setLikes] = useState(bookmark?.likeCount ?? 0);
  const [saved, setSaved] = useState(false);
  const [liking, setLiking] = useState(false);
  const [saving, setSaving] = useState(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { setLiked(bookmark?.isLikedByCurrentUser ?? false); setLikes(bookmark?.likeCount ?? 0); }, [bookmark?.isLikedByCurrentUser, bookmark?.likeCount]);
  const own = item.type === "own_save" || item.type === "pending";
  const shareUrl = bookmark?.shareSlug ? `${process.env.EXPO_PUBLIC_SITE_URL || "https://cosmic-dolphin.com"}/s/${encodeURIComponent(bookmark.shareSlug)}` : undefined;
  const like = async () => {
    if (!bookmark || liking || !user) return;
    setLiking(true);
    const next = !liked; setLiked(next); setLikes(n => Math.max(0, n + (next ? 1 : -1)));
    try {
      const result = await MobileAPI.like(bookmark.id, next, user.id);
      if (alive.current) { setLikes(result.likeCount); setLiked(result.isLikedByCurrentUser); }
    } catch { if (alive.current) { setLiked(!next); setLikes(bookmark.likeCount ?? 0); onError("Couldn't update that like."); } }
    finally { if (alive.current) setLiking(false); }
  };
  const share = async () => {
    if (!bookmark || !user || !shareUrl) return;
    try {
      const url = shareUrl;
      if (alive.current) await Share.share({ url, message: url });
    } catch { if (alive.current) onError("Couldn't share this save."); }
  };
  const save = async () => {
    if (!bookmark || !user || saving || saved) return;
    setSaving(true);
    try { await MobileAPI.saveRecommendation(bookmark.id, user.id); if (alive.current) setSaved(true); }
    catch { if (alive.current) onError("Couldn't save this link. Try again."); }
    finally { if (alive.current) setSaving(false); }
  };
  if (item.digest) return <NativeDigest item={item} offline={offline} onError={onError} onMore={actions.more} onOpen={() => router.push({ pathname: "/topic", params: { id: `digest:${item.digest!.id}` } })} />;
  if (!bookmark) return null;
  const lead = variant === "lead";
  const open = () => router.push(bookmarkRoute(item));
  const summary = bookmark.cosmicBriefSummary || bookmark.metadata?.openGraph?.description;
  const image = bookmark.metadata?.openGraph?.image;
  const tags = (bookmark.cosmicTags ?? []).slice(0, lead ? 3 : 2);
  const footer = <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", rowGap: 8, columnGap: 12 }}>
    <View style={{ flexDirection: "row", gap: 2, marginLeft: -8 }}>
      <Action label={`Like on ${bookmark.title}`} icon={Heart} tone="like" selected={liked} disabled={offline || liking} onPress={like}>{likes ? socialCount(likes) : null}</Action>
      <Action label={`Comments on ${bookmark.title}`} icon={MessageCircle} onPress={onComment ?? (() => router.push(bookmarkRoute(item)))}>{bookmark.commentCount ? socialCount(bookmark.commentCount) : null}</Action>
      <Action label={own ? "In your library" : saved ? "Saved" : "Save"} icon={SaveIcon} selected={own || saved} disabled={offline || own || saved || saving} onPress={save}>{own ? "In your library" : saved ? "Saved" : "Save"}</Action>
      <Action label={`Share on ${bookmark.title}`} icon={ShareIcon} disabled={offline || !shareUrl} onPress={share} />
    </View>
    <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
      {tags.map(tag => <Tag key={tag}>{tag}</Tag>)}
      {(bookmark.cosmicTags?.length ?? 0) > tags.length ? <Copy style={{ fontSize: 12.5, color: colors.fgTertiary }}>+{bookmark.cosmicTags!.length - tags.length}</Copy> : null}
      {bookmark.metadata?.readingTime ? <Copy role="meta" style={{ color: colors.fgTertiary, lineHeight: 12.5 }}>{bookmark.metadata.readingTime} min read</Copy> : null}
    </View>
  </View>;
  return <SwipeableCard id={bookmark.id} done={own ? actions.done : undefined} tonight={own ? actions.tonight : undefined}>
    <View testID={`feed-card-${bookmark.id}`} style={{ gap: lead ? 14 : 8, ...(lead ? { paddingBottom: 24 } : { marginHorizontal: -12, paddingHorizontal: 12, paddingVertical: 20, borderBottomWidth: 1, borderColor: colors.border }) }}>
      {lead && image ? <Pressable onPress={open}><Thumbnail uri={image} /></Pressable> : null}
      <View style={{ gap: 4, position: "relative" }}>
        <View style={{ minHeight: 26, paddingRight: 42, justifyContent: "center" }}><Provenance item={item} /></View>
        {item.rankingReason ? <Pressable accessibilityRole="button" accessibilityLabel="Why this appeared" accessibilityState={{ expanded }} onPress={() => setExpanded(!expanded)} hitSlop={6} style={{ paddingTop: 3, minHeight: 24 }}>
          <Copy role="meta" style={{ color: colors.fgTertiary, textDecorationLine: "underline", textDecorationStyle: "dotted" }}>Why this appeared</Copy>
        </Pressable> : null}
        <View style={{ position: "absolute", top: -4, right: 0 }}><Action label={`More actions for ${bookmark.title}`} icon={MoreHorizontal} onPress={actions.more} style={{ width: 34, height: 34 }} /></View>
      </View>
      {expanded ? <View style={{ paddingHorizontal: 13, paddingVertical: 11, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgSubtle }}><Copy style={{ fontSize: 13, lineHeight: 20.15 }}>{item.rankingReason}</Copy></View> : null}
      <View style={{ gap: lead ? 14 : 6 }}>
        <Pressable onPress={open} onLongPress={actions.more} accessibilityRole="button" accessibilityLabel={`Open ${bookmark.title || domainFor(bookmark.sourceUrl)}`}
          accessibilityActions={own ? [{ name: "done", label: "Mark done" }, { name: "later", label: "Later" }, { name: "more", label: "More actions" }] : [{ name: "more", label: "More actions" }]}
          onAccessibilityAction={event => { const name = event.nativeEvent.actionName; if (own && name === "done") actions.done?.(); else if (own && name === "later") actions.later?.(); else if (name === "more") actions.more?.(); }}>
          {lead ? <BalancedTitle style={[webText("lead"), { color: colors.fg }]}>{bookmark.title || domainFor(bookmark.sourceUrl)}</BalancedTitle>
            : <View style={{ flexDirection: "row", gap: 8 }}>{bookmark.isPrivateLink ? <Lock size={14} strokeWidth={1.7} color={colors.fgTertiary} style={{ marginTop: 4 }} /> : null}<View style={{ flex: 1 }}><BalancedTitle maxLines={2} style={[webText("feedRow"), { color: colors.fg }]}>{bookmark.title || domainFor(bookmark.sourceUrl)}</BalancedTitle></View></View>}
        </Pressable>
        {bookmark.isPrivateLink ? <View style={{ backgroundColor: colors.bgSubtle, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, flexDirection: "row", gap: 8 }}><Lock size={14} strokeWidth={1.7} color={colors.warning} style={{ marginTop: 1 }} /><Copy style={{ flex: 1, fontSize: 13, lineHeight: 19.5 }}><Text style={{ fontFamily: "InterMedium", color: colors.fg }}>Private link.</Text>{" Cosmic couldn't read this page, so your own title and notes are shown instead."}</Copy></View>
          : summary ? <Copy role={lead ? "body" : "bodySm"} lines={lead ? 4 : 2}>{summary}</Copy> : null}
      </View>
      <View style={lead ? { paddingTop: 4 } : undefined}>{footer}</View>
    </View>
  </SwipeableCard>;
}
function NativeDigest({ item, onOpen, offline, onError, onMore }: { item: FeedEntry; onOpen: () => void; offline: boolean; onError: (message: string) => void; onMore?: () => void }) {
  const { colors } = useWebTheme();
  const { user } = useAuth();
  const router = useRouter();
  const digest = item.digest!;
  const [liked, setLiked] = useState(digest.isLikedByCurrentUser);
  const [likes, setLikes] = useState(digest.likeCount);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(digest.isPublic);
  const [shareUrl, setShareUrl] = useState(digest.shareUrl);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { setLiked(digest.isLikedByCurrentUser); setLikes(digest.likeCount); setSaved(digest.isPublic); setShareUrl(digest.shareUrl); }, [digest.isLikedByCurrentUser, digest.likeCount, digest.isPublic, digest.shareUrl]);
  const like = async () => {
    if (!user || busy || offline) return;
    setBusy(true);
    try { const result = await MobileAPI.digestLike(digest.id, !liked, user.id); if (alive.current) { setLiked(result.isLikedByCurrentUser); setLikes(result.likeCount); } }
    catch { if (alive.current) onError("Couldn't update that like."); }
    finally { if (alive.current) setBusy(false); }
  };
  const save = async () => {
    if (!user || busy || offline || saved) return;
    setBusy(true);
    try { const result = await MobileAPI.digestShare(digest.id, user.id); if (alive.current) { setSaved(true); setShareUrl(result.shareUrl); } }
    catch { if (alive.current) onError("Couldn't save this digest."); }
    finally { if (alive.current) setBusy(false); }
  };
  return <View style={{ marginVertical: 16, padding: 20, borderWidth: 1, borderRadius: radius.md, borderColor: colors.border, backgroundColor: colors.bgPanel }}>
    <Copy style={{ fontFamily: "InterSemibold", fontSize: 12.5, lineHeight: 17.5, marginBottom: 10 }}>This week in your library</Copy>
    <Pressable accessibilityRole="button" accessibilityLabel={`Open ${digest.title}`} onPress={onOpen} onLongPress={onMore} style={{ marginBottom: 8 }}><BalancedTitle maxLines={2} style={[webText("title2"), { color: colors.fg }]}>{digest.title}</BalancedTitle></Pressable>
    <Copy style={{ fontSize: 14, lineHeight: 22.4 }}>{digest.summary}</Copy>
    <View style={{ marginTop: 12, gap: 11 }}>{digest.keyPoints.map((point, i) => <View key={i} style={{ flexDirection: "row", gap: 11 }}><View style={{ width: 5, height: 5, borderRadius: radius.pill, backgroundColor: colors.fgTertiary, marginTop: 9 }} /><Copy style={{ flex: 1, fontSize: 14, lineHeight: 21.7 }}>{point.text}</Copy></View>)}</View>
    <View style={{ borderTopWidth: 1, borderColor: colors.border, marginTop: 16, paddingTop: 14, gap: 12 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 7 }}><Copy role="meta">Built from</Copy>
        {digest.sources.slice(0, 3).map((source, index) => <View key={source.bookmarkId} style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>{index ? <Dot /> : null}<Pressable accessibilityRole="link" onPress={() => router.push(`/bookmark/${source.bookmarkId}`)} style={{ flexDirection: "row", alignItems: "center", gap: 7 }}><Favicon domain={source.domain} /><Copy role="meta" style={{ color: colors.fg, fontFamily: "InterMedium" }}>{source.domain}</Copy></Pressable></View>)}
        {digest.sources.length > 3 ? <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}><Dot /><Copy role="meta">+{digest.sources.length - 3} more</Copy></View> : null}
      </View>
      <View style={{ flexDirection: "row", gap: 2, marginLeft: -8 }}>
        <Action label={`Like on ${digest.title}`} icon={Heart} tone="like" selected={liked} disabled={offline || busy} onPress={() => { void like(); }}>{likes ? socialCount(likes) : null}</Action>
        <Action label={`Comments on ${digest.title}`} icon={MessageCircle} onPress={onOpen} />
        <Action label={saved ? "Saved" : "Save digest"} icon={SaveIcon} selected={saved} disabled={offline || busy || saved} onPress={() => { void save(); }}>{saved ? "Saved" : "Save digest"}</Action>
        <Action label={`Share on ${digest.title}`} icon={ShareIcon} disabled={offline || !shareUrl} onPress={() => { if (shareUrl) void Share.share({ url: shareUrl, message: shareUrl }).catch(() => onError("Couldn't share this digest.")); }} />
      </View>
    </View>
  </View>;
}
