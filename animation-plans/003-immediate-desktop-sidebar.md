# 003 — Make the desktop sidebar immediate

- **Status**: DONE
- **Commit**: 36dc8cd
- **Severity**: HIGH
- **Category**: Purpose · performance
- **Estimated scope**: 2 files, small

## Problem

components/ui/sidebar.tsx:96-110 maps Cmd/Ctrl+B to toggleSidebar. The desktop state then animates width, left/right, margin, height, and padding at lines 217, 228, 404, and 473; the rail uses transition-all at line 290. A high-frequency keyboard command must land immediately, and these layout transitions trigger layout/paint.

## Target

- Remove transition-[width] duration-200 ease-linear from sidebar-gap.
- Remove transition-[left,right,width] duration-200 ease-linear from sidebar-container.
- Replace the rail transition-all ease-linear with transition-colors duration-wave-fast.
- Remove transition-[margin,opacity] duration-200 ease-linear from the group label.
- Narrow the menu button to transition-colors duration-wave-fast; geometry changes immediately.
- Leave the mobile Sheet path unchanged.

## Repo conventions to follow

- docs/WAVE-PRODUCT-UI.md:63-68 states that navigation does not animate.
- The desktop and mobile branches split at components/ui/sidebar.tsx:183-247; preserve that architecture.

## Steps

1. Apply the target class changes above only in components/ui/sidebar.tsx.
2. Keep focus rings, active colors, hover colors, cursor states, cookies, and keyboard handling unchanged.
3. Extend the motion contract test to reject desktop sidebar layout-transition and linear-easing strings.

## Boundaries

- Do not remove mobile Sheet motion.
- Do not replace layout animation with transform animation.
- Do not change sidebar dimensions, navigation items, labels, or shortcut.

## Verification

- **Mechanical**: focused test, lint, design check, build.
- **Feel check**: desktop click and Cmd/Ctrl+B collapse immediately with no intermediate width; collapsed navigation, keyboard focus, and rail hover still work. At 390px the mobile sheet remains unchanged.
- **Done when**: the desktop state has no authored open/close layout animation.

## Reconciliation

Implemented in 96cf07f and tightened in 282e58e. Desktop gap, container, rail, label and menu geometry have no authored transition. Browser QA measured 0s on both desktop layout elements and verified click plus Ctrl+B state changes immediately. Mobile navigation retains the 280ms Sheet lifecycle.
