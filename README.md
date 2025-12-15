# 磁带封面生成器 (J-Card Genesis) 📼

<img width="1400" height="900" alt="image" src="https://github.com/user-attachments/assets/acd17866-ce31-4c21-9c5c-ebf01fe85cc9" />


**J-Card Genesis** 是一款专为磁带收藏家和 DIY 爱好者设计的桌面应用程序。它结合了现代 AI 技术，帮助你轻松制作出专业、美观的实体磁带封面（J-Card）。



## ✨ 主要功能

*   **智能 AI 驱动**:
    *   集成 **阿里云 DashScope (通义千问)**，自动根据曲目列表生成配色方案、心情描述和中文听感备注。
    *   集成 **通义万相 (Wanx)**，一键生成高质量、富有艺术感的封面图。
*   **不仅仅是 J-Card**:
    *   支持 **4 折页布局 (U-Card)**，提供比传统 J-Card 更多的展示空间，完美包裹磁带盒。
    *   提供 **标准**、**古典**、**合辑** 三种排版模式。
*   **数据导入**:
    *   支持从 **MusicBrainz** 数据库直接搜索并填充专辑信息。
    *   **智能文本粘贴**：支持从 Spotify、网易云音乐等平台复制歌单文本，AI 自动解析提取。
*   **专业打印适配**:
    *   专为 **Canon SELPHY CP1500** 等 6 寸 (4R, 100x148mm) 照片打印机优化。
    *   支持导出 **SVG** (矢量) 和 **PNG** (高清) 格式。
*   **个性化定制**:
    *   支持深色/浅色模式。
    *   自定义脊部样式、字体大小、强调色等。
    *   **档案级元数据 (Archival Metadata)**: v1.2.0 新增，支持记录 **音源 (Source)**、**录音设备 (Equipment)** 和 **录制日期**。
    *   **手动封面上传**: 支持直接上传本地图片作为封面，并自动提取主题色。
    *   **一键重置**: 顶部新增重置按钮，快速开启新项目流程。
    *   **无边框封面 (Borderless)**: v1.1.5 新增，封面图片自动撑满整个面板，零缝隙设计。
    *   **布局引擎优化**: 修复了物理尺寸换算，打印更精准；古典模式增加硬核元数据展示。
    *   更多布局细节请参考 [HELP.md](HELP.md)。

## 🚀 快速开始

### 安装

请在 [Releases](https://github.com/epochaudio/J-Card-Generator/releases) 页面下载适合您系统的版本：
*   **macOS**: `.dmg` (支持 Apple Silicon)
*   **Windows**: `.exe` (支持 x64)

### 配置 API Key

本应用依赖阿里云模型服务生成 AI 内容。

1.  访问 [阿里云百炼控制台](https://bailian.console.aliyun.com/?apiKey=1&tab=api#/api) 获取 API Key。
2.  打开应用，点击右上角 **设置 (⚙️)** 图标。
3.  输入你的 DashScope API Key (以 `sk-` 开头)。

## 🖨️ 打印指南

推荐使用 **佳能炫飞 (Canon SELPHY)** 系列打印机（如 CP1500）。

*   **相纸**: 6 寸 (RP-108 / KP-108IN), 4x6 英寸 (100x148mm)。
*   **操作**: 导出 PNG 图片后，无需裁剪，直接打印即可获得完美尺寸的 J-Card。

## 🛠️ 开发与构建

如果你是开发者，想要自行构建：

```bash
# 克隆仓库
git clone https://github.com/epochaudio/J-Card-Generator.git

# 安装依赖
npm install

# 启动开发模式
npm run electron:dev

# 构建应用 (根据当前系统)
npm run electron:build
```

## 📄 许可证 & 版权

© 2025 **门耳朵** (Epoch Audio). All Rights Reserved.

---
*Made with ❤️ for Cassette Culture.*

<img width="1400" height="900" alt="image" src="https://github.com/user-attachments/assets/9d7e703d-70e4-4b97-aaad-8d623784b8fc" />


<img width="2722" height="1855" alt="ScreenShot_2025-12-14_202948_848" src="https://github.com/user-attachments/assets/47ffd6c7-15bb-4832-bfc1-8cb25af25e8d" />

<img width="1760" height="1729" alt="ScreenShot_2025-12-14_203002_303" src="https://github.com/user-attachments/assets/7865c3f3-a907-4d38-836f-ed2c3be546af" />



<img width="1965" height="1832" alt="ScreenShot_2025-12-14_203022_939" src="https://github.com/user-attachments/assets/20cb3938-2b6c-4c2b-9dfc-7545f27a3460" />

