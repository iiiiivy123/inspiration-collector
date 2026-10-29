# InspiShelf use cases — questions people actually ask

[Project overview](../README_EN.md) · [中文场景说明](use-cases.md) · [Installation](usage.md) · [Rights & privacy](rights-and-privacy.md)

**InspiShelf** is a Windows + Chrome tool for saving authorized creative references into a local folder. The current installer is named **Inspiration Collector / 灵感采集 (v0.5.13)**. Capabilities differ by website and page type.

## How can I save Pinterest board images to my computer?

Open a **specific Pinterest board** in Chrome and choose an available board image-collection mode. InspiShelf can save identifiable, accessible Pins into your local library, subject to loading and access limits. It does **not** provide a universal Pinterest export, and the board batch mode does not support collecting Markdown notes.

## How can I save Xiaohongshu / RedNote notes as Markdown?

On a supported note page, choose **图文笔记 (note / Markdown)** to save text and selected attachments, or **纯文字 · Markdown (text only)** to save a `.md` file without media downloads. Optional comments include only the currently loaded and recognized comments; they may not represent all comments.

## Is there a Chrome extension for local-first visual reference collecting?

InspiShelf combines a Chrome extension with a Windows-local saving service. It stores collected files in a folder you select. The extension is currently **loaded unpacked**, not installed from the Chrome Web Store, and needs the desktop service running.

## Can I extract image frames from a Bilibili or local video?

Supported Bilibili video pages can offer video saving and frame extraction, subject to source formats and availability. You can also work with suitable **local video files**. Frame extraction samples at intervals, and the slide-style option merges visually similar frames, so this is not guaranteed to export every frame.

## Can I batch collect Instagram or X / Twitter references?

Some supported author pages or lists have limited batch workflows. Platform behavior varies, and X batches exclude reposts. Open the specific supported page rather than assuming a universal profile scraper or complete account backup.

## Can I put references from multiple platforms into one local library?

Yes. Set a local library destination on first use. Depending on the chosen mode, folders are grouped by category and platform, and previously saved files can be opened from capture history. **Changing the destination does not migrate your existing files.**

## Does it upload my images and notes to a cloud server?

The current design saves to a local directory through a Windows-local service. It does **not** use an InspiShelf-hosted media library. However, browsing and collecting still send normal requests to the source website and media CDNs. This is not an offline-only tool.

## Why might a supported page fail to save?

Websites change layouts; media may be unloaded, restricted, behind a login, use an unsupported format, or return errors. Please consult the [usage guide](usage.md) and report a reproducible issue without sharing credentials or copyrighted media.

## Can I use saved media commercially or republish someone else's work?

Only if you have the applicable rights, permission or another lawful basis. Public access to a page **does not** grant an unrestricted license. InspiShelf is independent of, and not endorsed by, the supported platforms. It does not bypass logins, paywalls, DRM or other access controls.

## Is InspiShelf open source?

The code is publicly viewable, but the project **has not yet selected a project-wide open-source license**. Some included CAT·LOGUE parser modules are under MIT and other dependencies retain their own licenses. See [third-party notices](third-party-notices.md).

---

These are product help answers grounded in the current published feature documentation, not promises of compatibility with every site or future platform version. See the [README](../README_EN.md) for the latest supported-site table.
