# Design Spec: Bookmark Save Optimization (Mobile)

**Date:** 2026-04-05
**Topic:** Optimize the mobile app's "Save Bookmark" page, fix state management bugs, and modernize UI/UX.

## 1. Problem Statement
The current "Save Bookmark" flow in the mobile app has several issues:
- **Multiple Modals:** Users sometimes see multiple bottom sheets popping up when sharing a link.
- **State Inconsistency:** The navigation logic in `RootLayoutNav` doesn't reset properly, causing intermittency.
- **Flaky URL Extraction:** Shared text containing URLs (but not *starting* with them) is often missed.
- **UI/UX:** The interface is basic and lacks a modern, premium feel.
- **Missing Info:** Previews sometimes fail or don't load all metadata correctly.

## 2. Proposed Solution

### 2.1 State Management & Navigation Fixes
- **RootLayoutNav Optimization:**
    - Reset `hasNavigatedToShare` ref whenever `hasShareIntent` becomes `false`.
    - Introduce a `navigationInProgress` ref to prevent race conditions during `router.replace` calls.
    - Ensure authentication is checked *before* navigating to `/share`. If not authenticated, the app will redirect to sign-in and then to `/share` once session is active.
- **Robust URL Extraction:**
    - Update `extractUrl` in `share.tsx` to use a regex that finds the first `http(s)` URL within any of the share intent fields (`text`, `data`, `url`, etc.).

### 2.2 Modern UI/UX Design
- **Visual Direction:** Modern, minimal, content-first.
- **Modal Structure:**
    - Emulate a high-end bottom sheet using `presentation: 'modal'` and `animation: 'slide_from_bottom'`.
    - Add a visual "handle" at the top of the modal for a tactile feel.
- **Preview Card:**
    - Immersive image with large border radius (`24px`).
    - High-quality typography (system-native or `Inter` if possible).
    - Clear hierarchy: Favicon + Domain -> Large Bold Title -> Muted Description.
    - Use `expo-blur` for a subtle frosted glass effect on the card background or modal overlay.
- **Interactions:**
    - Single, prominent "Save Bookmark" button with clear success state ("Saved!").
    - Smooth transitions for loading states (shimmer/skeleton UI).
    - Subtle haptic feedback on successful save (if `expo-haptics` is added).

### 2.3 Reliability Improvements
- **Fallback UI:** If metadata preview fails, show the extracted URL clearly and allow the user to save anyway.
- **Loading States:** Replace simple spinners with more informative skeletons or shimmers.

## 3. Implementation Plan

### Phase 1: Bug Fixes (State & Logic)
1.  Modify `apps/mobile/app/_layout.tsx` to fix the navigation logic.
2.  Modify `apps/mobile/app/share.tsx` to improve `extractUrl`.

### Phase 2: UI/UX Modernization
1.  Update `apps/mobile/app/share.tsx` with the new design.
2.  Incorporate `expo-blur` for enhanced visuals.
3.  Add shimmer loading effects.

### Phase 3: Verification
1.  Test sharing links from multiple apps (Browser, YouTube, etc.).
2.  Test sharing when unauthenticated.
3.  Verify that multiple modals no longer appear.

## 4. Testing Strategy
- **Manual Verification:** Share various types of content (raw URL, text + URL, etc.).
- **State Check:** Verify `hasShareIntent` is reset correctly after saving or canceling.
- **Auth Check:** Ensure redirect flow works correctly.

## 5. Risks & Mitigation
- **Regex Edge Cases:** Some shared text might contain multiple URLs. We'll pick the first one.
- **Modal Behavior:** Native modal behavior on iOS/Android might vary slightly. We'll stick to `expo-router` defaults for consistency.
