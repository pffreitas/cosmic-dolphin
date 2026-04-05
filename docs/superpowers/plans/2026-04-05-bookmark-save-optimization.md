# Bookmark Save Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix state management bugs in the share flow and modernize the Save Bookmark UI.

**Architecture:** 
- In `RootLayoutNav`, use `useRef` to track navigation progress and reset state when share intent is cleared.
- In `ShareScreen`, implement regex-based URL extraction and a modern, minimal UI with `expo-blur`.
- Use `router.replace` carefully to avoid modal stacking.

**Tech Stack:** React Native, Expo, `expo-router`, `expo-share-intent`, `expo-blur`, `Ionicons`.

---

### Task 1: Fix RootLayoutNav Navigation Logic

**Files:**
- Modify: `apps/mobile/app/_layout.tsx`

- [ ] **Step 1: Update RootLayoutNav with robust navigation tracking**

```typescript
function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const pathname = usePathname();
  const { session, isLoading: authLoading } = useAuth();
  
  // Track if we've already initiated navigation to share screen for the current intent
  const hasNavigatedToShare = useRef(false);
  const navigationInProgress = useRef(false);

  // Handle incoming share intents
  const { hasShareIntent, shareIntent, error, resetShareIntent } = useShareIntent({
    debug: true,
    resetOnBackground: true,
  });

  // Reset navigation state when share intent is cleared
  useEffect(() => {
    if (!hasShareIntent) {
      hasNavigatedToShare.current = false;
      navigationInProgress.current = false;
    }
  }, [hasShareIntent]);

  // Navigate to share screen when a link is shared
  useEffect(() => {
    // Only navigate if:
    // 1. We have a share intent with actual data
    // 2. We're authenticated (or we'll let the protected route handle it)
    // 3. We haven't already navigated for this intent
    // 4. We're not currently on the share screen
    // 5. Navigation is not already in progress
    
    const isOnShareScreen = pathname === '/share';
    const hasValidIntent = hasShareIntent && shareIntent && Object.keys(shareIntent).length > 0;
    
    if (hasValidIntent && !hasNavigatedToShare.current && !isOnShareScreen && !navigationInProgress.current) {
      // If not authenticated, the protected route will handle redirecting to sign-in.
      // Once signed in, this effect will re-run and trigger navigation.
      if (!session) return;

      console.log('🐬 Navigating to share screen...');
      hasNavigatedToShare.current = true;
      navigationInProgress.current = true;
      
      // Use replace to avoid stacking modals
      router.replace('/share');
    }
  }, [hasShareIntent, shareIntent, pathname, session]);

  // ... (rest of the component)
}
```

- [ ] **Step 2: Verify changes (conceptual)**
Ensure `hasNavigatedToShare` is reset correctly.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/_layout.tsx
git commit -m "fix(mobile): robust share intent navigation logic"
```

---

### Task 2: Improve URL Extraction in ShareScreen

**Files:**
- Modify: `apps/mobile/app/share.tsx`

- [ ] **Step 1: Implement regex-based URL extraction**

```typescript
// Helper to extract URL from various share intent structures
function extractUrl(shareIntent: any): string | null {
  if (!shareIntent) return null;
  
  // URL detection regex
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  
  // Try various possible fields
  const possibleValues = [
    shareIntent.url,
    shareIntent.webUrl, 
    shareIntent.text,
    shareIntent.meta?.url,
    shareIntent.meta?.webUrl,
    shareIntent.uri,
    shareIntent.data,
  ];
  
  for (const value of possibleValues) {
    if (typeof value === 'string' && value.length > 0) {
      const match = value.match(urlRegex);
      if (match && match[0]) {
        return match[0];
      }
    }
  }
  
  return null;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/app/share.tsx
git commit -m "feat(mobile): robust URL extraction for share intent"
```

---

### Task 3: Modernize ShareScreen UI

**Files:**
- Modify: `apps/mobile/app/share.tsx`

- [ ] **Step 1: Update styling and layout**
- Add a drag handle visual.
- Use `expo-blur` for the preview card.
- Improve spacing and typography.

```typescript
// (Update ShareScreen component with new UI structure)
export default function ShareScreen() {
  // ... state and hooks
  
  return (
    <ThemedView style={styles.container}>
      {/* Visual handle for modal feel */}
      <View style={styles.dragHandle} />
      
      {/* Header with cleaner look */}
      <View style={styles.header}>
        <ThemedText type="subtitle" style={styles.headerTitle}>Save Bookmark</ThemedText>
      </View>

      <ScrollView style={styles.scrollContent} contentContainerStyle={styles.contentContainer}>
        {/* Preview Section with Blur and modern Card */}
        {sharedUrl && (
          <View style={styles.modernCardContainer}>
            {/* ... card content ... */}
          </View>
        )}
      </ScrollView>

      {/* Footer with primary CTA */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        {/* ... buttons ... */}
      </View>
    </ThemedView>
  );
}

// (Update styles with new design tokens)
```

- [ ] **Step 2: Verify UI visually (conceptual)**
Check against mockup.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/share.tsx
git commit -m "style(mobile): modernize Save Bookmark UI"
```

---

### Task 4: Add Loading Shimmer and Polish

**Files:**
- Modify: `apps/mobile/app/share.tsx`

- [ ] **Step 1: Implement shimmer/skeleton for loading state**

- [ ] **Step 2: Add finishing touches (shadows, transitions)**

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/share.tsx
git commit -m "style(mobile): add loading shimmer and UI polish to ShareScreen"
```
