import React, { useEffect, useState } from "react";
import { Image, View } from "react-native";
import { Copy } from "@/components/web-home/Primitives";
import { useWebTheme } from "@/components/web-home/theme";
import { radius } from "@/constants/theme";

/** Web ReaderImages uses a stable 16:9 cover frame and a 12px caption. */
export function ReaderImage({
  image,
}: {
  image: { url: string; title?: string; description?: string };
}) {
  const { colors } = useWebTheme();
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [image.url]);
  return (
    <View style={{ gap: 6 }}>
      <View
        style={{
          width: "100%",
          aspectRatio: 16 / 9,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radius.md,
          overflow: "hidden",
          backgroundColor: colors.bgSubtle,
        }}
      >
        {failed ? (
          <View
            style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
          >
            <Copy>Image couldn&apos;t load.</Copy>
          </View>
        ) : (
          <Image
            source={{ uri: image.url }}
            accessibilityLabel={image.title || image.description || undefined}
            onError={() => setFailed(true)}
            style={{ width: "100%", height: "100%" }}
            resizeMode="cover"
          />
        )}
      </View>
      {image.title ? (
        <Copy role="meta" style={{ fontSize: 12, lineHeight: 16.8 }}>
          {image.title}
        </Copy>
      ) : null}
    </View>
  );
}
