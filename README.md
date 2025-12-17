# 磁带封面生成器 (J-Card Genesis) 📼

> **v1.2.5 Update**: **Quad-Font System & Domestic Mirror!** Now offering 4 distinct typography themes: **Moderno**, **Analog**, **Handwritten**, and **Digital**. All fonts served via `fonts.loli.net` for lightning-fast loading in China. UI optimized with a new top-bar selector.

<img width="1400" height="900" alt="image" src="https://github.com/user-attachments/assets/24c966b2-d6dc-4ae6-ac17-30d6252503e9" />

**J-Card Genesis** 是一款专为磁带收藏家和 DIY 爱好者设计的桌面应用程序。它结合了现代 AI 技术，帮助你轻松制作出专业、美观的实体磁带封面（J-Card）。

## ✨ 主要功能 (Key Features)

*   **[NEW] 字体与排版系统 (Typography System)**:
    *   **四重奏风格**: 提供 `Moderno (现代)`, `Analog (复古)`, `Handwritten (手写)`, `Digital (数码)` 四种截然不同的字体组合。
    *   **国内加速**: 全线切换至国内镜像源，解决字体加载失效问题。
    *   **所见即所得**: 顶部工具栏新增字体切换开关，实时预览变化。
*   **智能 AI 驱动**:
    *   集成 **阿里云 DashScope (通义千问)**，自动根据曲目列表生成配色方案、心情描述和中文听感备注。
    *   **颗粒度 AI 控制**:
        *   **✨ 文案生成**: 独立的 "魔法棒" 按钮，一键生成 1-3 句俳句式短诗文案 (拒绝营销词)。
        *   **🎨 提示词生成**: 独立的 "AI 生成提示词" 按钮，自动分析曲风并从 4 种特定画风 (水彩/杂志/日记/平面) 中锁定一种，生成可落地的绘画指令。
    *   集成 **通义万相 (Wanx)**，一键生成高质量、富有艺术感的封面图。
*   **主题系统 (Theme System)**:
    *   **🌑 Dark**: 经典的深色模式，专业冷静。
    *   **☀️ Light**: 纯白背景，极简主义，适合白纸打印。
    *   **🖼️ Cover**: 沉浸式封面背景，自动应用高斯模糊滤镜。
    *   **🎨 Color**: 智能取色，自动提取封面主色调作为背景，并智能反转文字颜色。
*   **不仅仅是 J-Card**:
    *   支持 **4 折页布局 (U-Card)**，提供比传统 J-Card 更多的展示空间，完美包裹磁带盒。
    *   提供 **标准**、**古典**、**合辑** 三种排版模式。
*   **数据导入**:
    *   支持从 **MusicBrainz** 数据库直接搜索并填充专辑信息。
    *   **智能文本粘贴**：支持从 Spotify、网易云音乐等平台复制歌单文本，AI 自动解析提取。
*   **专业打印适配**:
    *   专为 **Canon SELPHY CP1500** 等 6 寸 (4R, 100x148mm) 照片打印机优化。
    *   支持导出 **SVG** (矢量) 和 **PNG** (高清) 格式。
*   **档案级元数据 (Archival Metadata)**:
    *   支持记录 **音源 (Source)**、**录音设备 (Equipment)** 和 **录制日期**，并持久化保存。

## 🚀 下载与安装 (Installation)

请在 [Releases](https://github.com/epochaudio/J-Card-Generator/releases) 页面下载适合您系统的版本：
*   **macOS**: `.dmg` (支持 Apple Silicon / Intel)
*   **Windows**: `.exe` (支持 x64)

## 📖 使用指南 (User Guide)

### 1. 配置 API Key (必填)
本应用使用阿里云 DashScope (通义千问 & 通义万相) 提供 AI 服务。
1.  访问 [阿里云百炼控制台](https://bailian.console.aliyun.com/?apiKey=1&tab=api#/api) 开通并获取 API Key (以 `sk-` 开头)。
2.  在软件右上角点击 **设置 (⚙️)**，粘贴 Key 并保存。

### 2. 制作流程
1.  **输入信息**:
    *   **文本导入 (推荐)**: 点击 "粘贴文本"，粘贴任意格式的曲目列表（如网易云/Spotify 歌单文本），AI 会自动识别。
    *   **MusicBrainz**: 点击搜索按钮，输入专辑名查找填入。
    *   **手动输入**: 在左侧面板修改细节。注意：UI 上不支持对单首曲目进行详细编辑，建议通过"粘贴文本"重新导入修正。
2.  **AI 创意策划**:
    *   **自动重塑**: 点击右上角 **"AI 创意总监"**，补全专辑基础信息（标题、配色、听感备注）。
    *   **Slogan**: 点击"封面标语"旁的 ✨ 按钮，生成私密感短诗。
    *   **Prompt**: 点击"AI 图片提示词"旁的按钮，生成适配曲风的绘画指令。
3.  **生成封面**:
    *   点击 **"生成封面"**，AI 将根据提示词生成艺术封面（约需30-60秒）。
    *   或点击 **"上传 (Upload)"** 使用本地图片（自动零裁剪填充）。
4.  **调整布局**:
    *   切换 `标准` / `古典` / `合辑` 模式。
    *   `古典模式` 特性：自动归类乐章，背面展示详细录音设备与时间信息 (Tech Specs)。
5.  **导出**:
    *   点击 **"导出 SVG"** (矢量打印) 或 **"导出 PNG"**。

### 3. 功能详解
*   **Toolbar**: `旋转箭头`图标可一键重置项目（保留硬件设置）。支持深浅色模式切换。
*   **Spine Layout**:
    *   **Note Upper**: 脊部顶部备注（常填年份）。
    *   **Note Lower**: 脊部底部备注（常填格式/版权）。
    *   支持“极简脊部”与“强制大写”选项。
*   **Data Persistence**: 录音设备 (Equipment) 和 音源 (Media Source) 会自动保存，方便制作系列磁带。

## ❓ 常见问题 (FAQ)

**Q: 为什么生成图片很慢？**
A: 高清图像模型 (Wanx 2.5) 计算量大，通常需要 30-60 秒，请耐心等待。

**Q: 生成的图片不满意？**
A: 可手动修改 "AI 图片提示词" 框中的描述（如增加“赛博朋克”等关键词），再点击生成。

**Q: MusicBrainz 搜不到？**
A: 建议直接 Google 搜索专辑曲目列表，复制文本后使用软件的 **"粘贴文本"** 功能导入，这是最高效的方式。

## 🖨️ 打印与规格说明

### 推荐设备：Canon SELPHY CP1500
*   **相纸**: 6 寸 (4R / 4x6 英寸 / 100x148mm)。
*   **打印**: 导出 PNG 后直接打印，**无需裁剪**，即打即用。

### J-Card 布局 (U-Card)
本生成器采用四折页布局：
1.  **Front**: 封面 (正方形)。
2.  **Spine**: 脊部。
3.  **Back**: 封底 (A面曲目)。
4.  **Extension**: 扩展折页 (B面曲目/歌词/详情)。

## 🛠️ 开发与构建 (Development)

```bash
# 克隆仓库
git clone https://github.com/epochaudio/J-Card-Generator.git
npm install

# 启动开发
npm run electron:dev

# 构建应用
npm run electron:build
```

# 版权声明与使用许可（正式版）

**© 2025 门耳朵。**
本软件为开源软件，源代码与相关资源遵循本声明所述的使用许可条款。若项目另附 LICENSE 文件且与本声明存在差异，以 LICENSE 为准；本声明作为补充说明同时适用。

## 1. 许可范围（个人免费使用）

在遵守本声明条款的前提下，允许任何个人用户**免费下载、安装、使用、学习与研究**本软件，用于**非商业目的**的个人使用。

## 2. 禁止商业化用途（明确禁止）

未经著作权人/权利人书面授权，任何组织或个人不得以任何形式将本软件用于商业目的，包括但不限于：

1. 在淘宝、闲鱼、拼多多等平台或任何渠道**售卖软件/安装包/激活服务**；
2. 以本软件提供**有偿服务**，例如：**有偿打印、代处理、代制作、收费出图/出片**等；
3. 将本软件打包为商品、付费下载、会员权益、课程赠品或“资源包”进行**变相收费**；
4. 以广告、引流、赞助、导流分成等方式对软件使用进行**直接或间接变现**；
5. 将本软件用于企业/门店/工作室等经营场景，或作为对外收费服务链条的一部分。

如需商业授权（含合作、定制、集成、二次分发、渠道上架等），请联系授权方获取书面许可。

## 3. 修改、二次开发与再发布（开源友好）

允许对本软件进行修改、二次开发与再发布（包括源代码与编译后的二进制发布），但必须同时满足以下条件：

1. **不得用于任何商业化用途**（含直接/间接收费与变相变现）；
2. 再发布时必须**完整保留**本版权声明与使用许可（以及原作者署名信息与仓库信息，如有）；
3. 若发布修改版/衍生版，建议在显著位置标注“**已修改**”并说明主要改动，且不得暗示获得原作者背书或官方认证。

## 4. 非商业转载/镜像分发（允许，但有条件）

允许任何个人或组织在**非商业目的**下转载、镜像或分享本软件安装包及相关文件，但必须同时满足以下条件：

1. **必须完整保留**本版权声明与使用许可，不得删改、遮挡或拆分；
2. 转载/分发过程及下载入口**不得收取任何费用**，不得设置付费门槛或捆绑收费；
3. 不得将转载/分发作为引流或变现手段（包括但不限于：会员专享、打赏解锁、付费社群下载、广告分成导流等）；
4. 不得植入广告、恶意代码或进行其他损害用户权益的修改。

## 5. 免责声明

本软件按“现状”提供，不提供任何明示或默示担保。作者不对因使用或无法使用本软件导致的任何直接或间接损失承担责任。用户应自行评估风险并承担使用后果。

## 6. 违约处理

如发现违反本声明的行为，权利人有权要求立即停止侵权、下架相关内容，并保留追究法律责任及索赔的权利。

---
*Made with ❤️ for Cassette Culture.*

<img width="1400" height="900" alt="image" src="https://github.com/user-attachments/assets/9d7e703d-70e4-4b97-aaad-8d623784b8fc" />


<img width="2722" height="1855" alt="ScreenShot_2025-12-14_202948_848" src="https://github.com/user-attachments/assets/47ffd6c7-15bb-4832-bfc1-8cb25af25e8d" />

<img width="1760" height="1729" alt="ScreenShot_2025-12-14_203002_303" src="https://github.com/user-attachments/assets/7865c3f3-a907-4d38-836f-ed2c3be546af" />



<img width="1965" height="1832" alt="ScreenShot_2025-12-14_203022_939" src="https://github.com/user-attachments/assets/20cb3938-2b6c-4c2b-9dfc-7545f27a3460" />


---
*Made with ❤️ for Cassette Culture.*

<img width="1400" height="900" alt="image" src="https://github.com/user-attachments/assets/9d7e703d-70e4-4b97-aaad-8d623784b8fc" />


<img width="2722" height="1855" alt="ScreenShot_2025-12-14_202948_848" src="https://github.com/user-attachments/assets/47ffd6c7-15bb-4832-bfc1-8cb25af25e8d" />

<img width="1760" height="1729" alt="ScreenShot_2025-12-14_203002_303" src="https://github.com/user-attachments/assets/7865c3f3-a907-4d38-836f-ed2c3be546af" />



<img width="1965" height="1832" alt="ScreenShot_2025-12-14_203022_939" src="https://github.com/user-attachments/assets/20cb3938-2b6c-4c2b-9dfc-7545f27a3460" />



