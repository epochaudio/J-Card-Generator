import React, { useState } from 'react';

export default function ModelPicker({ label, value, onChange, models, hint, disabled, allowDefault }) {
  const [query, setQuery] = useState('');
  const matches = models.filter(model => model.id.toLowerCase().includes(query.trim().toLowerCase()));
  const listed = models.some(model => model.id === value);
  const visible = matches.some(model => model.id === value);
  return <div className="space-y-2">
    <label className="block text-sm">{label}（保存值）
      <input aria-label={label} value={value} disabled={disabled} onChange={event => onChange(event.target.value)} placeholder="直接填写模型 ID，或从下方列表选择" spellCheck={false} className="mt-1 w-full bg-gray-900 border border-gray-600 rounded p-2.5 text-white text-sm font-mono" />
    </label>
    <label className="block text-xs text-gray-400">筛选已获取的模型列表（不会作为模型保存）
      <input aria-label={`${label} 搜索`} type="search" value={query} disabled={disabled} onChange={event => setQuery(event.target.value)} placeholder="仅筛选列表；模型 ID 请填上方" className="mt-1 w-full bg-gray-900 border border-gray-600 rounded p-2 text-white text-sm" />
    </label>
    <select aria-label={`${label} 选择`} value={value} disabled={disabled} onChange={event => onChange(event.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded p-2.5 text-white text-sm">
      <option value="">{allowDefault ? '沿用默认（标题 qwen-plus，其余 qwen3-max）' : '请选择模型或在上方直接填写'}</option>
      {value && !visible && <option value={value}>{value}（{listed ? '当前选择' : '当前配置，未在获取列表中'}）</option>}
      {matches.map(model => <option key={model.id} value={model.id}>{model.id}</option>)}
    </select>
    {query && !matches.length && <p className="text-xs text-gray-400">没有匹配项。如要使用此型号，请将完整 ID 填入上方“保存值”。</p>}
    <p className="text-xs text-gray-400">{hint}</p>
  </div>;
}
