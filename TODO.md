# TODO — J-Card Genesis 代码整改清单

> 基于 2026-03-13 代码审查，按优先级排列

---

## P0: 紧急修复（影响功能正确性/安全）

- [x] **BUG-1** 修复 `parseWorks` 中 `composerRel` 作用域错误（`app.jsx:267`）
  - 改为 `t._workComposer = workMap[w.id].composer`
- [x] **BUG-2** 修复 `updateTrack` 直接修改 state（`app.jsx:1918-1922`）
  - 使用函数式 `setData` + 不可变更新
- [x] **BUG-3** 修复 `formatDuration` 秒数舍入为 60 的问题（`app.jsx:292`）
  - `toFixed(0)` → `Math.floor`
- [x] **SEC-1** 修复 Electron 安全配置（`electron/main.js:10-11`）
  - 启用 `contextIsolation: true`，关闭 `nodeIntegration`
  - 创建 `preload.js`，通过 `contextBridge` 暴露 API

---

## P1: 重要改进（影响安全/可维护性）

- [x] **SEC-2** API Key 存储改进
  - 修正 localStorage key 名 `gemini_api_key` → `dashscope_api_key`（含迁移逻辑）
  - Electron 版改用 `safeStorage` 加密存储
- [x] **ARCH-1** 拆分 `app.jsx`（2413 行）
  - [x] 提取 `MusicBrainzService` → `src/services/MusicBrainzService.js`
  - [x] 提取 `ColorExtractor` → `src/services/ColorExtractor.js`
  - [x] 提取 `TextUtils` → `src/utils/TextUtils.js`
  - [x] 提取 `LayoutEngine` → `src/utils/LayoutEngine.js`
  - [x] 提取 `ContentFront` → `src/components/ContentFront.jsx`
  - [x] 提取 `ContentBack` → `src/components/ContentBack.jsx`
  - [x] 提取 `SpineContent` → `src/components/SpineContent.jsx`
  - [x] 提取 `JCardPreview` → `src/components/JCardPreview.jsx`
  - [x] 提取 Modal 组件（Settings / Import / Search）
- [x] **ARCH-2** 提取 `DEFAULT_DATA` 常量，消除 `data` 初始值与 `handleReset` 的重复
- [x] **ARCH-3** 合并重复工具函数
  - [x] `parseDurationToMs` 提取到 `src/utils/formatDuration.js`
  - [x] `urlToBase64` 统一为一份，删除 `DashScopeService.urlToBase64` 或全局版
  - [x] 删除 `JCardPreview` 中未使用的 `getSpineTitleSize` / `formatText`

---

## P2: 性能优化

- [x] **PERF-1** 为 `JCardPreview` 和 `ContentBack` 中的布局计算添加 `useMemo`
  - `getTitleLayout`、`groupTracksNested`、`calculateRealVisualLines`
- [x] **PERF-2** 文字输入添加防抖（300ms），避免每次按键重渲染复杂 SVG

---

## P3: 代码清理

- [x] **QUAL-1** 删除无效 SVG 属性 `uppercase="true"`（`app.jsx:825, 874`）
- [x] **QUAL-2** 清理陈旧注释（`app.jsx:71-72`）
- [x] **QUAL-3** `downloadPNG` 添加 `img.onerror` 处理，确保 Blob URL 被释放
- [x] **QUAL-5** 更新 MusicBrainz User-Agent 中的占位符邮箱（`app.jsx:149`）
- [x] **QUAL-6** 统一 localStorage key 命名规范
- [x] **ARCH-4** 合并 7 个 loading 布尔状态为集中管理

---

## P4: 功能增强

- [x] **QUAL-4** 添加曲目增删功能（Side A / Side B 各自可增减 track）
- [x] 添加 React Error Boundary，优雅处理渲染错误
- [x] 尺寸常量化（1748, 1181 等硬编码值提取到 `constants.js`）

---

## 完成标准

- 每个 P0 项修复后应手动验证对应功能
- P1 拆分完成后确保 `npm run dev` 和 `npm run build` 正常
- 所有修改应分批提交，每批对应一个 TODO 编号
