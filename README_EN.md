# InspiShelf — Local-first reference and media collector

**Keep the web references you are allowed to save in your own local library.**

InspiShelf (formerly **Inspiration Collector / 灵感采集**) combines a Chrome extension with a Windows desktop background service. It helps creators save images, Markdown notes, text and supported video files from selected sites, with batch collection and frame extraction where available.

[中文说明](README.md) · [Download for Windows](https://github.com/iiiiivy123/inspiration-collector/releases/latest) · [Full setup guide (Chinese)](docs/usage.md) · [Use cases and FAQ](docs/use-cases.md) · [Rights & privacy](docs/rights-and-privacy.md)

> **Naming transition:** The current **v0.5.13** installer and app still say **Inspiration Collector / 灵感采集**. InspiShelf is the new public-facing product name; there is no separate InspiShelf binary yet. Renaming the installed app requires a separately tested release to preserve existing settings and saved files.
>
> **Independent project:** Not affiliated with, endorsed by, or sponsored by any platform named below. Names are used only to describe compatibility.

## Who is this for?

Designers, illustrators, video editors and other creators who need to keep **authorized reference materials** on their own Windows computer rather than scattered across multiple site collections.

## Features

- Save images from supported post or content pages to a chosen local folder.
- Save body text, source metadata and optional already-loaded comments, images and Windows OCR output as **Markdown notes**.
- Save text-only `.md` files without downloading attached media.
- Save supported ordinary video files; extract reference frames from supported downloads or local videos.
- Collect several items from certain supported profiles or boards, subject to site-specific limits.
- Review capture history, skip verified duplicates, retry failed items and resume some interrupted batches.

**Requirements:** Windows 10 or 11, x64; Google Chrome. No Python setup is needed for the packaged installer. This is **not** a mobile app, cloud storage service or universal website scraper.

## Website compatibility

| Site | Scope (may depend on page, login state and format) |
| --- | --- |
| Xiaohongshu / RedNote | Supported individual notes, images, Markdown and video workflows; some profile batches |
| X / Twitter | Individual posts and supported author-post batches, excluding reposts |
| Instagram | Supported posts, Reels and profile-list workflows |
| Pinterest | Individual Pins and specific boards; no batch Markdown board mode |
| Huaban | Individual items and selected image-batch workflows |
| Bilibili | Supported video pages and creator-upload lists, subject to media format limits |
| Other websites | Mainly images visible on the current page; no universal batch support |

Every mode is **not** available on every platform. Website changes, content loading and access restrictions can cause failures. This tool does not bypass logins, paywalls, DRM or access controls.

## Installation

1. Open [Releases](https://github.com/iiiiivy123/inspiration-collector/releases/latest) and download the **Windows x64 Setup .exe** asset, not the green Code button or Source code ZIP.
2. For v0.5.13 the file is called `InspirationCollector-0.5.13-Windows-x64-Setup.exe`.
3. Run the Windows app. It stays in the system tray.
4. Open `chrome://extensions`, enable Developer mode, then **Load unpacked** using the installed `extension` folder. The tray menu can copy its path.
5. Pin the extension, choose your local library folder, open a supported content page and select the capture mode.

The installer is currently unsigned, and there is no automatic updater. Verify the source and do not disable Windows security protection to install it.

## Local folder structure

```text
Your chosen library/
├─ 图片 / [platform] / [item]/
├─ 图文 / [platform] / [item]/
├─ 视频 / [platform] / [item]/
└─ 批量 / [platform] / [creator or board]/
```

Changing the default destination does not move previous files. Text-only notes are stored in the notes or batch categories.

## Questions people ask

**Can I save Pinterest boards to my computer?**  
Supported Pin and board workflows can collect accessible items from a specific board, subject to loading and platform limits.

**Can I export a Xiaohongshu post to Markdown?**  
Supported notes can be saved as rich Markdown or text only. Optional comments are limited to what is currently loaded and recognized.

**Can I extract still frames from a video?**  
Yes, from supported video workflows and local video files, within configured limits.

**Does InspiShelf upload my collection to its own cloud?**  
The current collector writes files locally and communicates with a local service. Normal website and media requests still go to the respective source websites or CDNs. See [privacy details](docs/rights-and-privacy.md).

**Can I redistribute or commercially reuse saved media?**  
Only when you have the necessary rights, permission or a valid legal basis. Content being public on a website does not automatically grant such rights.

## Licensing, acknowledgements and issues

The project source is publicly readable, but **the project has not selected an open-source license**. Third-party components have independent licenses, including [CAT·LOGUE MIT-origin parsing modules](docs/third-party-notices.md) and [FFmpeg components](docs/third-party-media.md).

For bugs, please open a [GitHub Issue](https://github.com/iiiiivy123/inspiration-collector/issues) with reproducible steps and a redacted screenshot. Do not share credentials, cookies, private data or copyrighted media files.

Maintained by [iiiiivy123](https://github.com/iiiiivy123), with AI-assisted development contributions from OpenAI Codex.
