import React, { useRef } from "react";
import { View, type GestureResponderEvent } from "react-native";

/** Static card: horizontal gestures commit without a fly-out or countdown. */
export function SwipeableCard({ id, children, done, tonight }: { id: string; children: React.ReactNode; done?: () => void; tonight?: () => void }) {
  const origin = useRef({ x: 0, y: 0 });
  const distance = (event: GestureResponderEvent) => ({ x: event.nativeEvent.pageX - origin.current.x, y: event.nativeEvent.pageY - origin.current.y });
  if (!done || !tonight) return <>{children}</>;
  return <View testID={`swipe-card-${id}`}
    onTouchStart={event => { origin.current = { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY }; }}
    onMoveShouldSetResponder={event => { const d = distance(event); return Math.abs(d.x) > 24 && Math.abs(d.x) > Math.abs(d.y) * 2; }}
    onResponderTerminationRequest={() => true}
    onResponderRelease={event => { const d = distance(event); if (Math.abs(d.x) >= 64 && Math.abs(d.x) > Math.abs(d.y) * 2) { if (d.x > 0) done(); else tonight(); } }}>
    {children}
  </View>;
}
