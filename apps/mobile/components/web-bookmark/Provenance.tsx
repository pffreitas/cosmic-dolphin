import React from "react";
import { View } from "react-native";
import type { Bookmark } from "@/lib/api";
import { Favicon } from "@/components/web-home/FeedItem";
import { Action, Copy } from "@/components/web-home/Primitives";
import { relativeTime } from "@/components/web-home/data";
import { useWebTheme, webSansFont } from "@/components/web-home/theme";
import { radius } from "@/constants/theme";

export function DetailProvenance({
  bookmark,
  domain,
  owner,
  onOriginal,
}: {
  bookmark: Pick<Bookmark, "createdAt" | "metadata">;
  domain: string;
  owner: boolean;
  onOriginal: () => void;
}) {
  const { colors } = useWebTheme();
  const segments: React.ReactNode[] = [];
  if (domain)
    segments.push(
      <Action
        label={domain}
        onPress={onOriginal}
        style={{ paddingHorizontal: 0, minHeight: 17.5 }}
      >
        <View style={{ flexDirection: "row", gap: 7, alignItems: "center" }}>
          <Favicon
            domain={domain}
            uri={bookmark.metadata?.openGraph?.favicon}
          />
          <Copy
            role="meta"
            style={{ color: colors.fg, fontFamily: webSansFont(500) }}
          >
            {domain}
          </Copy>
        </View>
      </Action>,
    );
  const attribution =
    bookmark.metadata?.openGraph?.articleAuthor ||
    bookmark.metadata?.openGraph?.siteName;
  if (attribution) segments.push(<Copy role="meta">{attribution}</Copy>);
  if (owner) segments.push(<Copy role="meta">you saved this</Copy>);
  segments.push(<Copy role="meta">{relativeTime(bookmark.createdAt)}</Copy>);
  if (bookmark.metadata?.readingTime)
    segments.push(
      <Copy role="meta">{`${bookmark.metadata.readingTime} min`}</Copy>,
    );
  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 7,
      }}
    >
      {segments.map((segment, index) => (
        <View
          key={index}
          style={{ flexDirection: "row", alignItems: "center", gap: 7 }}
        >
          {index ? (
            <View
              accessible={false}
              style={{
                width: 3,
                height: 3,
                borderRadius: radius.pill,
                backgroundColor: colors.fgTertiary,
              }}
            />
          ) : null}
          {segment}
        </View>
      ))}
    </View>
  );
}
