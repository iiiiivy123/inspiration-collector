# 内置媒体组件

Windows 安装包的 `media-tools` 目录包含未修改的 FFmpeg 源码所构建的 `ffmpeg.exe` 和 `ffprobe.exe`，作为独立子进程处理本地文件；本应用不链接 FFmpeg 库。

- 上游：https://github.com/FFmpeg/FFmpeg/tree/611cec792a
- 源码归档：`ffmpeg-source-611cec792a.zip`，安装包直接附带在 `media-tools` 内，转发安装包时同时转发源码。
- 源码 ZIP SHA256：`52416bfdf2fd346ce2f14e0ac922985d6df4701538e5ee9ddba6d52f6c8a2f4a`。
- FFmpeg 许可：LGPL 2.1 或以后版本；完整 `COPYING.LGPLv2.1` 与上游 `LICENSE.md` 随组件提供。第三方文件保留源码中的原始许可。此组件许可不授予任何采集素材的使用权，也不替本项目选定开源许可证。
- 本软件包含 Independent JPEG Group 开发的软件；相关上游文件未修改。

只启用本地 file 输入、MOV/MP4 容器、H.264/AAC 解析及检查所需功能。没有外部媒体库、GPL/nonfree 功能或网络协议，不含转码编码器；用途是无重编码合并与检查。用户可以用兼容版本替换两个可执行文件；程序不进行签名锁定。

## 重建

构建脚本为 `tools/build_media.sh`，同时随安装组件提供。源文件无补丁；归档解压后保留原样。使用 Docker Ubuntu 24.04，镜像摘要 `sha256:fe81560990fae86dc4743202b2cb4d3df98d0bcf949173cecef15ce1127ef852`，脚本通过 MinGW-w64 交叉编译 Windows x64。实际完整配置随组件的 `build-config.txt` 提供。工具链包版本记录随构建证据保存；不同工具链可能生成不同二进制哈希。

构建时把包含上述源码 ZIP 的目录挂载为 `/work`，将脚本挂载为 `/build.sh`，执行 `sh /build.sh`。产物在 `/work/media-minimal`。构建本身需要网络安装工具链；最终用户安装与本地合并不需要下载组件。

FFmpeg 作者和其他贡献者保留其版权。保留许可与对应源码后再分发，不将第三方组件冒充本项目原创。
