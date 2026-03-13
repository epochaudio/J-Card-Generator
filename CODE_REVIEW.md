# Code Review Report — J-Card Genesis v1.3.3

> 审查日期：2026-03-13
> 审查范围：全部源码（app.jsx, src/*, electron/*, 配置文件）

---

## 一、Bug（需立即修复）

### BUG-1: `parseWorks` 中 `composerRel` 引用错误

**文件**：`app.jsx:267`
**严重程度**：高

`composerRel` 在 `if (!workMap[w.id])` 块内声明（行 255），但在块外引用（行 267）。当同一 Work 有多条 track 时，第二条及之后的 track 会因 `composerRel` 不在作用域内而得到 `undefined`。

```js
// 问题代码
if (!workMap[w.id]) {
    const composerRel = w.relations?.find(r => r.type === 'composer');
    workMap[w.id] = { ... };
}
workMap[w.id].tracks.push(t.id);
t._workComposer = composerRel?.artist?.name; // composerRel 此处不可访问
```

**修复方案**：改为从已存储的 `workMap` 中获取：

```js
t._workComposer = workMap[w.id].composer;
```

---

### BUG-2: `updateTrack` 直接修改 React State

**文件**：`app.jsx:1918-1922`
**严重程度**：高

`{ ...data }` 是浅拷贝，`newData.sideA` / `newData.sideB` 仍指向原 state 的数组引用。直接赋值 `newData[side][index][field] = value` 违反 React 不可变更新原则，可能导致：
- 组件不重新渲染
- 时间旅行调试失效
- 数据竞态异常

```js
// 问题代码
const newData = { ...data };
newData[side][index][field] = value; // 直接修改原数组中的对象
setData(newData);
```

**修复方案**：

```js
const updateTrack = (side, index, field, value) => {
    setData(prev => ({
        ...prev,
        [side]: prev[side].map((t, i) =>
            i === index ? { ...t, [field]: value } : t
        )
    }));
};
```

---

### BUG-3: `formatDuration` 秒数可能舍入为 60

**文件**：`app.jsx:292-293`
**严重程度**：中

`toFixed(0)` 对 59.5 会四舍五入为 `"60"`，产生 `"3:60"` 这样的非法时间格式。

```js
// 问题代码
const seconds = ((ms % 60000) / 1000).toFixed(0);
```

**修复方案**：

```js
const seconds = Math.floor((ms % 60000) / 1000);
```

---

## 二、安全问题

### SEC-1: Electron 安全配置危险

**文件**：`electron/main.js:10-11`
**严重程度**：高

```js
webPreferences: {
    nodeIntegration: true,
    contextIsolation: false
}
```

当前配置下，渲染进程中的任何 XSS 漏洞都可直接执行 Node.js 代码（读写文件系统、执行系统命令）。考虑到应用加载了外部资源（MusicBrainz API、CoverArt Archive 图片、DashScope API），攻击面不小。

**修复方案**：

1. 设置 `contextIsolation: true`
2. 设置 `nodeIntegration: false`
3. 通过 `contextBridge` + `preload.js` 暴露必要 API

---

### SEC-2: API Key 明文存储在 localStorage

**文件**：`app.jsx:1482-1488`
**严重程度**：中

- localStorage 中的数据对同源脚本完全可见
- 存储 key 名为 `gemini_api_key`（遗留命名，实际存储的是 DashScope key）

**修复方案**：

- Web 版：最低限度更正 key 名称为 `dashscope_api_key`
- Electron 版：使用 `safeStorage` API 加密存储

---

## 三、架构问题

### ARCH-1: 巨型单文件 `app.jsx`（2413 行）

所有逻辑集中在一个文件中：工具函数、API 服务、SVG 组件、主 App 状态管理。

**建议拆分结构**：

```
src/
├── components/
│   ├── ContentFront.jsx
│   ├── ContentBack.jsx
│   ├── SpineContent.jsx
│   ├── JCardPreview.jsx
│   └── modals/
│       ├── SettingsModal.jsx
│       ├── ImportModal.jsx
│       └── SearchModal.jsx
├── services/
│   ├── DashScopeService.js    (已拆分)
│   ├── ExportService.js       (已拆分)
│   ├── MusicBrainzService.js  (待拆分)
│   └── ColorExtractor.js      (待拆分)
├── utils/
│   ├── TextUtils.js
│   ├── imageUtils.js
│   └── formatDuration.js
├── config/
│   ├── fonts.js               (已拆分)
│   ├── defaultData.js         (待提取)
│   └── constants.js           (待提取)
└── hooks/
    ├── useLocalStorage.js
    └── useTheme.js
```

---

### ARCH-2: 默认数据重复定义

初始 `data` state（行 1491-1523）与 `handleReset`（行 1935-1967）完全重复。

**修复方案**：提取 `DEFAULT_DATA` 常量。

---

### ARCH-3: 工具函数重复实现

| 函数 | 位置 1 | 位置 2 |
|------|--------|--------|
| `parseDurationToMs` | 行 1627 (handleSelectReleaseGroup) | 行 1678 (handleSmartImport) |
| `urlToBase64` | 行 127 (全局) | 行 131 (DashScopeService) |
| `getSpineTitleSize` | 行 981 (SpineContent) | 行 1296 (JCardPreview, 未使用) |
| `formatText` | 行 979 (SpineContent) | 行 1294 (JCardPreview, 未使用) |

---

### ARCH-4: 7 个独立 loading 布尔状态

```js
const [loading, setLoading] = useState(false);
const [loadingTitle, setLoadingTitle] = useState(false);
const [loadingSearch, setLoadingSearch] = useState(false);
const [loadingImport, setLoadingImport] = useState(false);
const [loadingImage, setLoadingImage] = useState(false);
const [loadingSlogan, setLoadingSlogan] = useState(false);
const [loadingPrompt, setLoadingPrompt] = useState(false);
```

**修复方案**：合并为 `useReducer` 或集中管理对象。

---

### ARCH-5: MusicBrainz Service 未拆分为独立模块

`MusicBrainzService` 对象（行 148-295）仍内联在 `app.jsx` 中，而 `DashScopeService` 和 `ExportService` 已拆分。应保持一致。

---

## 四、性能问题

### PERF-1: 缺少 `useMemo` / `useCallback`

每次渲染都重新计算以下昂贵操作：

- `getTitleLayout(title)` — 标题换行计算
- `LayoutEngine.groupTracksNested()` — 曲目分组
- `calculateRealVisualLines()` — 布局行数估算
- 所有 `TextUtils.getWrappedLines()` 调用

**影响**：在输入框每次按键时，整个 SVG 布局引擎重新运行。

---

### PERF-2: 文字输入无防抖

文本输入直接触发 `setData` → 完整 SVG 重渲染（1748x1181 复杂 SVG 含滤镜），曲目多时可感知卡顿。

---

## 五、代码质量

### QUAL-1: 无效 SVG 属性 `uppercase="true"`

**文件**：`app.jsx:825, 874`

`uppercase` 不是合法 SVG 属性，不会产生任何效果。大写转换已通过 `.toUpperCase()` 实现。

---

### QUAL-2: 陈旧注释残留

**文件**：`app.jsx:71-72`

```js
// REMOVE duplicate standalone getContrastYIQ if exists
// (It was added in previous step but we are moving it inside ColorExtractor now)
```

开发过程中的遗留注释，应清理。

---

### QUAL-3: `downloadPNG` 缺少 `onerror` 处理

**文件**：`app.jsx:1871-1916`

`img.onerror` 未定义。如果图片加载失败，`URL.revokeObjectURL` 不会调用，Blob URL 泄漏。

---

### QUAL-4: Track 列表无法增删

UI 只能编辑固定的 5+5 条轨道，缺少添加/删除按钮。手动输入场景下无法调整曲目数量。

---

### QUAL-5: MusicBrainz User-Agent 含占位符邮箱

**文件**：`app.jsx:149`

```js
userAgent: "JCardGenesis/2.0 ( contact@example.com )"
```

MusicBrainz API 政策要求 User-Agent 包含真实联系信息，否则可能被限流或封禁。

---

### QUAL-6: localStorage key 命名不一致

| 用途 | 当前 key | 建议 key |
|------|---------|---------|
| DashScope API Key | `gemini_api_key` | `dashscope_api_key` |
| 主题模式 | `jcard_theme_mode` | OK |
| 字体主题 | `jcard_font_theme` | OK |
| 录音数据 | `jcard_recording_data` | OK |

---

## 六、汇总

| 类别 | 严重程度 | 数量 |
|------|---------|------|
| Bug | 高/中 | 3 |
| 安全 | 高/中 | 2 |
| 架构 | 中 | 5 |
| 性能 | 中 | 2 |
| 代码质量 | 低 | 6 |
| **合计** | | **18** |
