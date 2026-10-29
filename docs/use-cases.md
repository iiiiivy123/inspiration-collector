# 使用场景与 FAQ / Use cases & FAQ

[回到中文主页](../README.md) · [English use cases](use-cases-en.md) · [版权与隐私](rights-and-privacy.md)

InspiShelf（现有 v0.5.13 安装包仍名为“灵感采集”）是 Windows + Chrome 的本地素材采集工具，主要服务于**有保存权限的参考素材整理**。以下操作和平台范围均以当前安装版及页面实际可用功能为准。

## 1. Pinterest 画板图片如何保存到本地？

打开具体的 Pinterest 画板（不是搜索结果），启动 Chrome 扩展，选择可用的画板批量图片模式，设置处理数量与保存位置。仅能处理已被程序识别且可访问的 Pin；不保证隐藏、未加载或受限内容。当前不支持 Pinterest 画板批量图文笔记。

*English: Open a specific Pinterest board and use the available board image-collection mode. Content must be accessible; hidden or restricted Pins are not guaranteed.*

## 2. 如何把小红书图文笔记保存为 Markdown？

打开受支持的单篇笔记，选择“图文笔记”，按需勾选正文图片、已加载评论或本地 OCR；如果只要文字，选“纯文字 · Markdown”。程序不会保证读取全部评论或未加载的轮播内容。

*English: Supported Xiaohongshu notes can be saved as Markdown with optional images and already-loaded comments, or as text-only `.md` files.*

## 3. 如何保存 Instagram / X 的创作参考？

打开单帖或支持的作者内容列表，按页面实际提供的采集模式操作。部分列表提供批量处理，但页面变化、登录状态、转载内容与媒体格式可能限制可采集范围。

*English: Use a supported post or author-list workflow for Instagram or X; availability varies by content, site state and media format.*

## 4. 能从 B站视频或本地视频中抽取参考画面吗？

在受支持的 B站稿件页面选择视频保存或“保存并抽帧”。本地已有视频也可以使用独立抽帧页。抽帧按时间间隔采样，分段模式还会合并相似画面，因此并不是完整无遗漏的逐帧导出。不支持破解付费、加密或访问控制。

*English: Extract reference frames from supported Bilibili downloads or local video files; sampling and format restrictions apply.*

## 5. 怎样把跨平台参考图统一整理在一个文件夹？

首次使用时设置素材库目录，程序会根据模式与平台写入子目录。历史记录保留实际保存路径；**改默认位置不会移动旧文件**。可在采集记录中找到旧作品的原目录。

*English: Choose a local library root. Captures are organized by type and platform; previous files stay where they were saved.*

## 6. 为什么某篇帖子、某个平台无法下载？

可能是页面结构调整、内容未加载、登录状态变化、服务器响应格式不兼容、访问限制或视频使用了不受支持的格式。程序不会绕过付费墙、验证码、DRM 或访问控制。请参考 [使用教程](usage.md)，提交反馈时附脱敏步骤，不附他人素材或凭据。

## 7. 为什么不直接说“全网图片视频一键下载”？

因为这是不准确的功能声明。InspiShelf 仅支持已适配的页面和媒体类型，部分平台支持有限批量；也不保证用户对每个文件拥有复制或商业使用权。项目既不隶属平台，也不代理权利人的授权。

请在合法、获准的范围内使用；详情见 [版权、平台关系与隐私](rights-and-privacy.md)。
