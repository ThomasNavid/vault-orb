# Orb colour customisation

Implemented in source. People can personalise the orb from **Settings → Appearance**, preview the result immediately, and keep their choice across app restarts. See the [user guide](features/voice-and-controls.md#choose-your-orb-colour) and [development notes](development.md#orb-appearance). This document records the design and acceptance criteria.

The first version offers named presets plus a custom colour picker. Separate colour controls for each activity state remain a possible later extension.

1. Open **Settings → Appearance** and choose **Blue (default), Violet, Rose, Amber, Mint, or Teal**, or use **Custom** with a native colour picker and an editable `#RRGGBB` field.
2. Preview changes on the actual orb beside Settings. Presets have visible names, a selection indicator, and keyboard support. Invalid hex input shows an inline message and leaves the last valid preview visible.
3. Select **Apply colour** to save only appearance. The existing **Save settings** action also commits a valid appearance draft with the rest of the form. Show a clear saved or failed state.
4. **Reset to blue** previews the original appearance; Apply colour or Save settings makes it permanent. Leaving Settings or hiding Orb discards an unapplied draft and restores the saved colour.

The colour covers the orb body, shading, halo, listening/speaking ring, coloured lens reflections, and small orb illustrations in chat, including their glows. White highlights and dark glasses preserve the character's detail. Explore, chat suggestion, command-menu and footer icons use the orb colour directly on their strokes, with no coloured background tiles. Other application accents, activity status indicators, and tool-result colours keep their existing meanings.

Idle, listening, thinking, and speaking use variations derived from the selected colour. Their movement, audio response, ring visibility, and status text continue to communicate activity. The original blue option reproduces the existing four palettes exactly.

The picker supplies a base colour for the shaded orb. Derive lighter and darker tones with enough separation to preserve its shape, including for black, white, and grey inputs. Tune extreme values and inspect them against both light and dark desktop backgrounds before finalising the palette rules.

Implementation follows the current architecture:

| Area | Planned change |
| --- | --- |
| Shared colour logic | Add a small pure palette helper usable by the Electron main process and browser renderer. Own the default, presets, hex validation/normalisation, and derived palettes in one place. Preserve existing blue values as the default reference. |
| [Orb renderer](../src/orb.js) | Add `orbVisual.setColour(...)`. Update colour targets through the existing interpolation without resetting animation or voice level. Include currently hard-coded rim, shadow, and lens colours. Repaint immediately with reduced motion enabled. |
| Chat illustrations | Make `orbMark()` use the same palette. Update already-created marks and ensure future marks use the current colour. Retain independent SVG gradient IDs so marks still render when the main orb is hidden. |
| [Settings interface](../src/index.html) and [styles](../src/style.css) | Add Appearance controls, accessible selected/error/saved states, and an Apply colour button with `type="button"`. Scope colour-input styles and orb-specific glow variables. |
| [Renderer controller](../src/renderer.js) | Track saved colour separately from the draft. Apply saved colour during startup; initialise controls on settings entry; preview valid edits; commit successful saves; restore saved appearance on every settings-exit path. |
| [Main process](../src/main.cjs) and [preload](../src/preload.cjs) | Expose `appearance.orbColour` through public settings and a narrow `saveAppearance({orbColour})` bridge. Validate and atomically merge appearance into the latest configuration. Also accept appearance in the existing full settings transaction. |

Persist one canonical six-digit hex string in the app's existing local `settings.json`:

```json
{
  "appearance": {
    "orbColour": "#1f86ff"
  }
}
```

The choice belongs to this installation and survives changing vaults. Missing or malformed stored values fall back to the original blue. Invalid new save requests are rejected. Both save paths preserve unrelated settings and encrypted credentials, and older callers that omit appearance preserve the existing choice.

The appearance-only save works before a vault or provider has been configured. It avoids the vault validation and assistant reinitialisation currently performed by `save-settings`. Opening Settings currently ends an active voice session; that existing behaviour remains part of this workflow.

While a save is pending, prevent duplicate submissions and disable the colour controls. If saving fails, retain the draft with an inline error and leave the saved baseline unchanged. If the user leaves during a save, a successful response still updates the saved baseline and displayed colour without reopening Settings; a failed response leaves the previous saved colour in place. Guard against stale responses affecting a subsequently opened editor.

Implement in three steps:

1. Add palette logic and rendering support, including chat marks and reduced motion. Check the default blue against the current appearance before adding controls.
2. Add validated persistence and the Appearance controls, including preview, reset, both save actions, discard, and failure handling. Give the browser preview an in-memory appearance adapter so the complete interaction can be checked without credentials.
3. Validate the feature and update the voice-and-controls guide, settings guidance, and development documentation where needed.

Acceptance checks:

- Presets and custom colours change the live orb and existing/new chat marks consistently. Original blue matches the current appearance in all four activity states.
- Dark, light, grey, and saturated colours retain visible shading and glasses; audio response and motion remain intact, including reduced-motion mode.
- Apply colour works with no configured vault or provider. Saving other settings preserves the colour; Save settings commits a pending valid colour draft in the same transaction.
- Reset, discard, invalid input, failed writes, rapid interactions, and leaving during a save have the defined outcomes. Back, Explore, chat, Escape/hide, and the settings toggle all handle drafts consistently.
- The selected colour survives settings reopening and an actual Electron relaunch. Existing installations with no appearance setting load blue.
- Controls fit the current settings panel and work with keyboard navigation and screen-reader labels.

Use focused automated coverage for validation, fallback, configuration preservation, and save failure/lifecycle behaviour. Visually inspect all activity states and chat marks in the browser preview, then verify persistence in Electron. Run the repository's `npm test` suite after implementation. Automated coverage includes the real IPC handlers and temporary settings files with mocked Electron OS surfaces. Browser preview checks cover the UI and renderer; these checks do not claim native picker or installed-app relaunch validation.
