import React from 'react';
import { Palette } from 'lucide-react';
import { PALETTES } from '../config/design.mjs';
import { FONT_THEMES, getFontConfig } from '../config/fonts.js';

const buttonStyle = selected => `rounded-lg border px-2 py-2 text-xs transition-colors ${selected ? 'border-orange-700 bg-orange-50 text-orange-900' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`;
const layouts = [ ['STANDARD', '经典居中'], ['EDITORIAL', '编辑左齐'], ['REVERSIBLE', '双面颠倒'] ];
export default function DesignPanel({ data, theme, fontTheme, mode, onLayout, onTheme, onFont, onMode, onAutoColor, hasImage }) {
  const publication = data.layout.designEdition === 'publication';
  const font = getFontConfig(fontTheme, data.layout.designEdition);
  return <section id="design-panel" className="space-y-4 scroll-mt-4" aria-label="封面设计">
    <h2 className="text-sm font-semibold flex items-center gap-2"><Palette size={16} /> 封面设计</h2>
    <div className="flex gap-2">
      <button className={`${buttonStyle(publication)} flex-1`} aria-pressed={publication} onClick={() => onLayout({ designEdition: 'publication', texture: false })}>出版排版</button>
      <button className={`${buttonStyle(!publication)} flex-1`} aria-pressed={!publication} onClick={() => onLayout({ designEdition: 'legacy', frontStyle: data.layout.frontStyle === 'EDITORIAL' ? 'STANDARD' : data.layout.frontStyle })}>原版排版</button>
    </div>
    <div>
      <label htmlFor="design-font" className="block text-xs text-gray-500 mb-2">字体搭配</label>
      <select id="design-font" value={fontTheme} onChange={event => onFont(event.target.value)} className="w-full rounded border border-gray-200 bg-white p-2 text-sm">
        {Object.values(FONT_THEMES).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
      <div className="mt-2 px-3 py-2 rounded bg-stone-50 text-stone-700" aria-label="字体小样">
        <span style={{ fontFamily: font.fonts.title }} className="text-xl">声音档案 · Album</span>
        <span style={{ fontFamily: font.fonts.body }} className="block text-xs mt-1">曲目与艺术家 · Track 01</span>
      </div>
    </div>
    <fieldset>
      <legend className="text-xs text-gray-500 mb-2">完整配色</legend>
      <div className="grid grid-cols-3 gap-2">
        {Object.entries(PALETTES).map(([id, palette]) => <button key={id} aria-pressed={theme.paletteId === id} className={buttonStyle(theme.paletteId === id)} onClick={() => onTheme({ ...theme, paletteId: id, accent: palette.accent })}>
          <span className="flex items-center justify-between h-9 px-2 mb-2 rounded" style={{ background: palette.background, color: palette.text }}><span className="text-base">Aa</span><span className="w-3 h-3 rounded-full" style={{ background: palette.accent }} /></span>
          {palette.name}
        </button>)}
      </div>
      <div className="grid grid-cols-4 gap-1 mt-2">
        {[['dark', '深色'], ['light', '浅色'], ['cover', '封面背景'], ['color', '图片取色']].map(([value, label]) => <button key={value} className={buttonStyle(theme.paletteId === 'legacy' && mode === value)} aria-pressed={theme.paletteId === 'legacy' && mode === value} onClick={() => { onTheme({ ...theme, paletteId: 'legacy' }); onMode(value); }}>{label}</button>)}
      </div>
    </fieldset>
    <div className="flex items-center justify-between gap-2 text-xs text-gray-500">
      <label className="flex items-center gap-2">强调色<input aria-label="强调色" type="color" value={theme.accent} onChange={event => onTheme({ ...theme, accent: event.target.value })} className="h-7 w-8 bg-transparent cursor-pointer" /></label>
      <button disabled={!hasImage} onClick={onAutoColor} className="disabled:opacity-40 hover:text-orange-800">从封面推荐</button>
    </div>
    <fieldset>
      <legend className="text-xs text-gray-500 mb-2">正面布局</legend>
      <div className="grid grid-cols-3 gap-2">
        {layouts.map(([value, label]) => <button key={value} className={buttonStyle(data.layout.frontStyle === value)} aria-pressed={data.layout.frontStyle === value} onClick={() => onLayout({ frontStyle: value, ...(value === 'EDITORIAL' ? { designEdition: 'publication' } : {}) })}>
          <span aria-hidden="true" className={`flex flex-col gap-1 w-9 h-12 border border-current rounded-sm p-1 mx-auto mb-2 ${value === 'STANDARD' ? 'items-center' : ''}`}><span className="bg-current opacity-20 w-full h-6" /><span className="bg-current opacity-60 w-4 h-0.5" /><span className="bg-current opacity-30 w-3 h-0.5" /></span>{label}
        </button>)}
      </div>
    </fieldset>
    {publication && data.layout.frontStyle !== 'REVERSIBLE' && <label className="flex items-center justify-between text-xs text-gray-500">标题尺寸
      <select aria-label="标题尺寸" value={data.layout.titleSize || 'balanced'} onChange={event => onLayout({ titleSize: event.target.value })} className="border border-gray-200 rounded p-1 bg-white">
        <option value="compact">克制</option><option value="balanced">均衡</option><option value="expressive">醒目</option>
      </select>
    </label>}
    {publication && <label className="flex gap-2 items-center text-xs text-gray-500"><input type="checkbox" checked={!!data.layout.texture} onChange={event => onLayout({ texture: event.target.checked })} />轻微纸纹</label>}
    {!publication && <p className="text-xs text-gray-500">保留原版字号与间距；选择出版排版可使用新的文字层级。</p>}
  </section>;
}
