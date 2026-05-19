# Design: Reprocess on Settings Change (Compress & Enhance)

**Date:** 2026-05-19  
**Status:** Approved

## Problem

In the Compress and Enhance sections, once an image has been processed the Process button becomes disabled (`hasPending` is false because all files are `'done'`). To reprocess with different settings the user must remove and re-upload the file.

## Goal

The Process button re-enables whenever the user changes any setting after a completed process run, without requiring a file re-upload.

## Scope

- **Affected:** Compress and Enhance (share the same `settings` state and `UploadPanel` component)
- **Not affected:** Resize — already uses `canProcess = files.length > 0 && !processing && ...`, so the button is always enabled when files are present

## Solution: `settingsDirty` flag

### State (App.tsx)

Add one boolean state variable:

```ts
const [settingsDirty, setSettingsDirty] = useState(false)
```

Replace direct `setSettings` calls with a wrapper that also marks dirty:

```ts
const handleSettingsChange = useCallback((s: ProcessingSettings) => {
  setSettings(s)
  setSettingsDirty(true)
}, [])
```

After each compress/enhance process completes, reset the flag:

```ts
// inside handleProcess, after await:
setSettingsDirty(false)
```

### Props (UploadPanel)

Add `settingsDirty: boolean` to `UploadPanelProps`.

Change the button disabled condition from:

```tsx
disabled={!hasPending || processing}
```

to:

```tsx
disabled={(!hasPending && !settingsDirty) || processing}
```

### No changes to

- `useProcessing` hook
- `useFileQueue` hook (`resetAll()` already resets all files to `pending` before each run)
- `ResizePanel`
- `SettingsBox`

## Behavior After the Change

| State | Button |
|---|---|
| Files loaded, not yet processed | Enabled (hasPending) |
| Processing in progress | Disabled (processing) |
| Process complete, no settings changed | Disabled |
| Process complete, any setting changed | Enabled (settingsDirty) |
| User clicks Process → runs again | Files reset to pending, results replaced, button re-disables |

## Files to Modify

1. `frontend/src/App.tsx` — add `settingsDirty` state + `handleSettingsChange` wrapper, reset flag after process
2. `frontend/src/components/UploadPanel.tsx` — add `settingsDirty` prop, update button disabled condition
