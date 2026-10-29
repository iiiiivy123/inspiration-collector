# InspiShelf — A local-first reference collector

**From scattered saves to a folder you actually own.**

When inspiration lives across tabs, bookmarks and different social platforms, finding a reference again can become a project of its own.

**InspiShelf** is a **Windows + Chrome tool for collecting authorized visual references** into local folders. Save images, Markdown notes, text and supported video files from selected websites. Some author pages and boards also support batch collection, and supported videos can be turned into reference frames.

**[Download Windows installer](https://github.com/iiiiivy123/inspiration-collector/releases/latest)** · [Setup guide](docs/usage.md) · [中文说明](README.md) · [Use cases](docs/use-cases-en.md)

> **Name transition:** InspiShelf is the new public-facing name. The current **v0.5.13** installer, desktop shortcut and extension still use **Inspiration Collector / 灵感采集**. They are the same project; there is no separately released InspiShelf binary yet.
>
> **Updating an existing installation?** First exit the old desktop app from the **Windows system tray → right-click → 退出灵感采集 (Exit)**. Closing Chrome or the extension popup does not stop the local background service. Install the new version only after it has exited, then reload the Chrome extension.

## What can it save?

| Your reference | Available workflow | Local output |
| --- | --- | --- |
| Visuals from a supported post | Collect images | Image files |
| A post worth keeping as a note | Save text, source and optional images / already-loaded comments / local OCR | Markdown and selected attachments |
| Text only | Choose text-only mode | A `.md` file, without media attachments |
| A supported ordinary video | Save the video and optionally extract frames | Video file and reference images |
| A set of related posts | Use supported profile / board batches | Organized folders, history and duplicate checks |

Your files go into **a local library folder you choose**, not an InspiShelf cloud collection. You can review saved items, open their folders, and resume or retry certain unfinished tasks.

## Supported websites

| Website | Current coverage and limits |
| --- | --- |
| **Xiaohongshu / RedNote** | Supported note images, Markdown, text and video modes; some creator-profile batches |
| **Pinterest** | Individual Pins and specific boards; **no batch Markdown mode for boards** |
| **Instagram** | Posts, Reels and some profile-list workflows |
| **X / Twitter** | Posts and some author-post batches; reposts excluded |
| **Huaban** | Individual items and selected image-batch modes |
| **Bilibili** | Supported video pages and creator-upload lists; applicable video download / frame extraction |
| **Other sites** | Mainly images from the current page; no universal batching |

Capabilities vary by site, page type, loaded content, access rights and media format. The tool does not bypass logins, paywalls, DRM or other access controls.

## Get started in four steps

1. From [GitHub Releases](https://github.com/iiiiivy123/inspiration-collector/releases/latest), download the **Windows x64 Setup .exe** under **Assets**, not the green Code button or the source ZIP. The current file is `InspirationCollector-0.5.13-Windows-x64-Setup.exe`.
2. Install and run **Inspiration Collector / 灵感采集**. It stays in the Windows system tray rather than opening a main window.
3. In Chrome, open `chrome://extensions`, enable **Developer mode**, and choose **Load unpacked**. Select the installed `extension` folder; its path can be copied from the tray menu.
4. Pin the extension, select a local library folder, then open a supported content page and choose a collection mode.

**Requires Windows 10/11 x64 and Google Chrome.** The installer includes the required Python and media components. There is currently no Chrome Web Store listing, mobile app or automatic updater. The installer is unsigned; verify its source and never disable security protections to install it.

For detailed setup and troubleshooting, see the [full guide (Chinese)](docs/usage.md).

## Updating an existing installation

**Always stop the old desktop background app before running a new installer.** This applies to every manual update.

1. Finish or stop any running collection task.
2. Find **灵感采集 / Inspiration Collector** in the Windows notification area (expand the hidden tray icons with **∧** if necessary).
3. Right-click its icon and choose **退出灵感采集 (Exit)**. Wait for the icon to disappear. If Setup says the app is still running, cancel Setup, exit the app, and start the installer again.
4. Download the latest Windows installer from [Releases](https://github.com/iiiiivy123/inspiration-collector/releases/latest), and install **to the same folder**. You normally do not need to uninstall the previous version or delete your library.
5. After installation, confirm the desktop background service is running. Open `chrome://extensions`, find the **灵感采集** extension, click **Reload**, and refresh any already-open target page.

Your selected media library is not automatically moved by an update. The app currently has **no automatic updater**.

## Where do files go?

```text
Chosen library/
├── 图片 / platform / item /
├── 图文 / platform / item /
├── 视频 / platform / item /
└── 批量 / platform / creator or board /
```

Folder names are examples. Changing your library location does not move files saved previously.

## Common questions

**Can I save a Xiaohongshu post as Markdown?**  
Yes, for supported note pages. You can include selected media and already-loaded comments, or save text only.

**Can it save Pinterest board images locally?**  
It can collect identifiable, accessible Pins from a specific supported board. It is not a full export of hidden or inaccessible items.

**Can it extract frames from video?**  
Yes, for supported videos and locally available video files. Sampling and similarity-based filtering may skip some frames.

**Does it upload my media to a service operated by InspiShelf?**  
The current collector writes to local folders and uses a local background service. Ordinary requests to source websites and media CDNs still occur.

**Is content that is publicly viewable free to reuse?**  
No. Visibility does not establish a license to copy, distribute or commercially exploit someone else's work.

See the [English use-case guide](docs/use-cases-en.md) and [rights & privacy statement](docs/rights-and-privacy.md) for more.

## Independence, licensing and feedback

InspiShelf is an independent third-party project, **not affiliated with or endorsed by** Xiaohongshu, Pinterest, Instagram, X, Huaban or Bilibili. Site names identify compatibility only. Comply with applicable law, site rules and rights-holder permissions.

The repository is publicly readable but **does not yet have a project-wide open-source license**. Some parser files originate from CAT·LOGUE under MIT; media and runtime components have their own licenses. See the [notices](docs/third-party-notices.md) and [media component details](docs/third-party-media.md).

For bug reports, use [GitHub Issues](https://github.com/iiiiivy123/inspiration-collector/issues) with a version number, steps and redacted screenshots. Do not post cookies, credentials, private data or copyrighted media.

Maintained by [iiiiivy123](https://github.com/iiiiivy123), with AI-assisted development contributions from OpenAI Codex. [Brand guide](docs/brand-guide.md) · [Launch copy](docs/launch-copy.md).
