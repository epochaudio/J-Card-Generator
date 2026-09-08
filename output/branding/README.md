# 带藏 · TapeFolio

已确认采用折页封套与磁带双卷轴组合标识。

- `tapefolio-logo-concept-v1.png`：确认的品牌展示稿。
- `../../src/assets/branding/tapefolio-icon.png`：独立透明背景 PNG 图标，1254 × 1254。
- `../../build/icon.png`：同一图标的桌面打包入口。

界面与窗口显示“带藏 · TapeFolio”；桌面产品名称为 TapeFolio。保留原有 appId、内部包名、存储键和作品格式。打包版默认数据目录继续使用 Tape Cover Generator；显式指定的测试目录不受影响。QQ群名称及历史版本记录保留其原始名称。

验证：92 项测试、前端生产构建、Electron 语法检查、4 个数据目录兼容场景通过。尚未重新打包安装或发布。

## 独立图标生成

使用内置 image_gen，以确认的展示稿为编辑输入，提示词：

Extract the top-right rounded-square app icon from the approved TapeFolio brand board into one standalone square 1024x1024 PNG app icon. Preserve exactly its charcoal rounded square, cream folded-paper/cassette shape with two charcoal circular holes, vermilion upper-right folded corner. Keep the exact design and proportions of that top-right icon, not the large left emblem. Center icon, occupying 90% of canvas width and height, with genuinely transparent outside corners and outer margin. Crisp flat solid fills, no text, no board, no additional marks, no shadow, no texture or gradient. This is production asset extraction, not a redesign.

工具实际返回 1254 × 1254 PNG，已检查尺寸和 alpha 通道。
