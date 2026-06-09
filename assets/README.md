Place Expo assets here:

- `icon.png` — 1024×1024 app icon
- `splash-icon.png` — splash image
- `adaptive-icon.png` — Android adaptive icon foreground

Until brand assets are ready, you can generate defaults:

```bash
npx expo install expo-splash-screen
# Or copy from a fresh Expo template:
npx create-expo-app@latest temp-assets --template blank
cp temp-assets/assets/* ./apps/mobile/assets/
```
