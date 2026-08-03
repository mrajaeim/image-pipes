# Changelog

All notable changes to Image Pipes are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-08-03

### Added

- **Workflow library** — save, rename, recent list, templates, and dirty-state tracking for local workflows
- **Workflow Export / Import** — Export downloads JSON; Import loads workflows from disk
- **Embedded asset registry in exports** — referenced Load Images batches ship with the workflow and rehydrate on import
- **Desktop asset pickers** — native open-images / open-folder / pick-folder IPC for local paths without copying
- **Asset registry** — register external, staged, and folder batches; Load Images resolves via `asset_batch_id`
- **Save Image packaging** — choose **Bare files** or **ZIP archive**, with optional destination folder (desktop)
- **Save destination on canvas** — Save Image nodes show the output folder / packaging mode instead of image thumbnails
- **Iteration × batch previews** — executor exposes iteration and batch indexes; canvas paginates result slides
- Seed / Iterations header tooltips for clearer run controls

### Changed

- Renamed **Save as…** to **Export…**; first-time **Save** only persists to the library (no file download)
- Renamed run control **Samples** → **Iterations** (how many times to run the full pipeline over the image set)
- Save Image default destination is the workflow **output** folder (no nested `downloads/` directory)
- Load Images UI is picker-only (no editable path field); templates use `"sample": "lena"` instead of `path`
- Save Image folder selection uses a folder picker rather than a free-text path input
- Example workflows updated to the sample-marker format

### Fixed

- Executor runs the **full image batch on every iteration** (no longer undersampling across iterations)
- Save Image no longer triggers a **browser ZIP download**; files are written to disk and reported via `saved` events
- Export unwraps `/api/assets/{id}` `{ batch, count }` payloads so embedded assets collect correctly

### Removed

- Legacy Load Images `path` param from the node schema and exported graph params (legacy path still accepted at execute time as a fallback)
- Browser auto-download of Save Image ZIP archives
- `outputs/downloads` default subdirectory; ZIPs and bare saves use `outputs/` directly
- Legacy outputs API / root data-dir plumbing cleaned up; runtime state directories no longer tracked in git

### Documentation

- README revised with clearer structure, download instructions, and quick start

## [0.1.1] - 2026-07-31

Baseline release tag preceding the workflow library and asset-registry work.

[Unreleased]: https://github.com/mrajaeim/image-pipes/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/mrajaeim/image-pipes/releases/tag/v0.2.0
[0.1.1]: https://github.com/mrajaeim/image-pipes/releases/tag/v0.1.1
