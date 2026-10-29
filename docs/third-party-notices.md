# Third-party notices / 第三方代码声明

本项目自身**尚未选定开源许可证**。下列第三方代码按各自许可分发；这些许可**不表示**本项目所有源代码均采用 MIT，也不授予任何来源图片、图文或视频的版权。

## CAT·LOGUE — MIT License

本仓库以下文件与上游对应源文件逐字节一致（按 Git blob SHA 核对）：

| 当前仓库 | 上游 CAT·LOGUE 文件 |
| --- | --- |
| `source/extension/cat-media.js` | [`media_core.js`](https://github.com/cicicjy/CAT-LOGUE/blob/main/media_core.js) |
| `source/extension/cat-instagram.js` | [`instagram_core.js`](https://github.com/cicicjy/CAT-LOGUE/blob/main/instagram_core.js) |
| `source/extension/cat-xhs.js` | [`xhs_core.js`](https://github.com/cicicjy/CAT-LOGUE/blob/main/xhs_core.js) |

上游项目：[cicicjy/CAT-LOGUE](https://github.com/cicicjy/CAT-LOGUE)。  
上游授权：[MIT License](https://github.com/cicicjy/CAT-LOGUE/blob/main/LICENSE)。  
本仓库保留其原始版权及许可文本：[CAT-LOGUE-LICENSE.txt](CAT-LOGUE-LICENSE.txt)。

这些文件属于独立第三方作者贡献，并非 InspiShelf 独立原创。后续对其中代码的修改应继续保留相应版权和许可声明。

**分发检查项**：当前已发布的 v0.5.13 安装包早于本声明的整理；下一次构建 Windows 安装包、源码 ZIP 或其他发行物时，应确认上述 MIT 许可文本随所包含的第三方代码一起分发。仅在 GitHub 仓库添加声明，不能代替核对已有二进制包的内容。

## FFmpeg、Python 及其他依赖

Windows 安装包的媒体组件来源、对应源码、构建方式与许可说明见 [third-party-media.md](third-party-media.md)。Python 运行时与 Python 依赖分别受各自许可证约束，具体仍需在正式发布流程中核对发行包内容。

如发现署名、许可或来源清单不完整，请通过 GitHub Issues 报告，不要在公开 Issue 中提交敏感数据。
