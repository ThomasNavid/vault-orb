# Contributing to Vault Orb

[Project home](README.md) · [Documentation](docs/README.md) · [Development](docs/development.md)

Contributions should preserve Orb's small interface, source-backed answers, and explicit user control over writes. Use fictional data when developing, testing, or reporting problems.

## Before changing code

1. Read the feature's [user guide](docs/README.md#feature-guides) and relevant implementation.
2. Identify the concrete behavior you want to change and the current limitation or bug.
3. Keep changes focused. Do not fold unrelated cleanup, new services, or extra integrations into a feature fix.
4. For a larger change, describe the proposed user workflow and data effects in an issue or draft pull request so they can be reviewed.

The project currently targets Apple Silicon macOS. See [Development](docs/development.md) for dependencies, source layout, and build commands.

## Validate a change

Run the relevant offline tests and the full `npm test` suite for code changes. Add tests for meaningful behavior, data preservation, validation, and failure cases. Use temporary vaults; do not point tests at a personal vault or call live paid services in the offline suite.

Check UI changes in the browser preview and, where relevant, in Electron. Preview fixtures cannot verify macOS permissions, key storage, native shortcuts, Obsidian source opening, or live voice/model behavior. For a live integration check, use a disposable vault and clearly separate observed results from mocked tests.

For native/package changes, run the native gesture test and `npm run package`. Packaging does not install the app or create a notarized release. For documentation-only changes, check links, anchors, code/configuration examples, sample filenames, and claims against source; a full application rebuild is normally unnecessary.

## Keep documentation with the feature

A feature change is ready for review when its documentation is ready too:

- Update its page under `docs/features/`: purpose, setup, requests, expected results, a walkthrough, limits, and troubleshooting.
- State whether each example reads data, writes vault notes, or changes an external system. Document the exact scope of undo.
- Add useful copyable examples to [Things to ask Orb](docs/things-to-ask.md), with any prerequisites.
- Check examples against the actual tool schemas, validation, and routing. Do not advertise a planned feature as available or call source inspection a live model test.
- Add or revise fictional sample vault content when it makes the example directly runnable. Existing private notes are not documentation fixtures.
- Update [Vault format](docs/vault-format.md) for property/layout changes, [Privacy](docs/privacy.md) for data-handling changes, and [Development](docs/development.md) for architecture/build changes.
- Link new guides from the [documentation index](docs/README.md). Keep the root README focused on orientation and quick start.
- Avoid duplicating deep setup instructions across pages. Link to the page that owns them so corrections stay consistent.

Models may phrase answers differently. Examples should document supported intent, prerequisites, and observable outcomes rather than promise exact generated wording.

## Pull requests

Lead with the problem and resulting behavior. Include relevant validation and any remaining limitations. For UI changes, include fictional-data screenshots when helpful. For file writes, explain version checks, preservation, undo, and partial-failure behavior. For integrations, state what leaves the machine and whether the action is reversible through Orb.

Keep secrets, real vaults, private feed URLs, access tokens, app support files, generated app bundles, and native binaries out of commits. The ignore rules help, but they do not replace reviewing your diff.

## Bug reports

Include steps to reproduce, expected/actual behavior, the precise error, operating system/architecture, and whether you run from source or a packaged/installed copy. Attach a minimal fictional note or sample data only when it helps reproduce the issue. If a write partly succeeded, say which items exist now.

For credentials or private data accidentally exposed in a report, remove the exposure and rotate the affected credential through its provider; do not repost the secret in a follow-up.

The app and sample vault use the [MIT license](LICENSE).
