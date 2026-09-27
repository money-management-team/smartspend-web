# Settings (الإعدادات) - Implementation Guide

## Architecture

The Settings module is located at `src/features/Dashboards/User/Settings/` and is divided into modular components corresponding to each settings domain:

```
src/features/Dashboards/User/Settings/
├── Settings.jsx
├── Settings.css
└── components/
    ├── SettingsTabs/
    │   ├── SettingsTabs.jsx
    │   └── SettingsTabs.css
    ├── ProfileSettings/
    │   ├── ProfileSettings.jsx
    │   └── ProfileSettings.css
    ├── SecuritySettings/
    │   ├── SecuritySettings.jsx
    │   └── SecuritySettings.css
    ├── PreferencesSettings/
    │   ├── PreferencesSettings.jsx
    │   └── PreferencesSettings.css
    └── AISettings/
        ├── AISettings.jsx
        ├── AISettings.css
        ├── DeleteChatHistoryModal.jsx
        └── DeleteChatHistoryModal.css
```

## State & Data Persistence

1. **Profile Settings**:
   - Synchronized with `useAuthContext()` (`user`, `workspace`, `updateUser`) and calls `authApi.updateProfile()`.
   - Refreshes email verification status via `useEmailVerification()`.

2. **Security Settings**:
   - Submits password changes through `authApi.changePassword()`.
   - Computes password strength dynamically (length, letters, numbers, symbols) and validates matching confirmation.
   - Manages active devices and sessions state with mock/API revocation triggers.

3. **Preferences Settings**:
   - **Language**: Switches between `ar` and `en` via `useLanguageContext()` / `i18n.changeLanguage()`. Automatically adjusts document direction (`rtl` / `ltr`) and HTML attributes.
   - **Theme**: Connects with `useThemeContext()` (`changeTheme`). Supports `light`, `dark`, and `system` (evaluates `window.matchMedia('(prefers-color-scheme: dark)')`).
   - **Preferences Cache**: Stored in `localStorage` under `smartspend_preferences`.

4. **AI Settings & Chat History Purge**:
   - Toggles stored in `localStorage` under `smartspend_ai_settings`.
   - Purge action opens `DeleteChatHistoryModal` and safely removes cached conversation transcripts and context state from local storage.

## Localization & RTL Support

- All labels, descriptions, placeholders, badges, and validation messages have complete Arabic and English keys in:
  - `src/locales/ar/ar.json` under `dashboard.settings.*`
  - `src/locales/en/en.json` under `dashboard.settings.*`
- CSS utilizes logical properties (`padding-inline`, `margin-inline`, `inset-inline-*`) and specific `[dir="rtl"]` overrides for switches and slider transitions.
