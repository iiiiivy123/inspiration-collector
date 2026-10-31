# 0.5.24 source review snapshot

This branch contains the accumulated local changes since main (527e93b), including the 0.5.14 remediation and subsequent local releases through 0.5.24. It is a source review snapshot, not a new installer release. Earlier documentation records describe their historical versions; the extension manifest identifies the current source version.

## Review priorities

- Platform list boundaries: YouTube playlist/watch contexts, ArtStation projects versus album covers, and Xiaohongshu saved posts with mixed authors.
- Media selection and download: Pinterest browser-assisted image fetching, Bilibili audio fallback diagnostics, segmented media, and output conversion.
- Original-language captions, author versus automatic captions, and local transcription fallback.
- Collection-scoped duplicate checks, directory naming, batch counts, progress, cancellation, and failure reporting.
- Local service authorization, public image URL validation, retention, and installer upgrade behavior.

## Validation boundaries

Previous local targeted offline runs passed after corrections; this upload does not rerun or claim full validation. Public synthetic checks are included in tests/public; private test artifacts, captured pages, screenshots, local data, credentials, models, and dependency binaries are excluded. The latest platform-specific local regression files are not part of the existing public test allowlist, so public CI alone does not reproduce all local checks.

Still requiring live verification: Pinterest's full 27-item board, the reported Bilibili audio failure, the reported YouTube music-video captions, and logged-in ArtStation and saved-list layouts. X network failures, Wiki completeness, Huaban, and other platforms' favorites are not declared solved.

Optional media and speech dependencies are pinned separately in tools/requirements-media.txt and tools/requirements-subtitles.txt. They must not be assumed installed by source/server/requirements.txt. Existing materials, preferences, and models were not migrated by this snapshot.
