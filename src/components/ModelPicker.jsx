import React, { useState } from 'react';

export default function ModelPicker({ label, value, onChange, models, hint, disabled, allowDefault }) {
  const [query, setQuery] = useState('');
  const matches = models.filter(model => model.id.toLowerCase().includes(query.trim().toLowerCase()));
  const listed = models.some(model => model.id === value);
  const visible = matches.some(model => model.id === value);
  return <div className="space-y-2">
    <label className="block text-sm">{label}
      <input aria-label={`${label} 搜索`} type="search" value={query} disabled={disabled} onChange={event => setQuery(event.target.value)} placeholder="搜索已获取的模型" className="mt-1 w-full bg-gray-900 border border-gray-600 rounded p-2 text-white text-sm" />
    </label>
    <select aria-label={`${label} 选择`} value={value} disabled={disabled} onChange={event => onChange(event.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded p-2.5 text-white text-sm">
      <option value="">{allowDefault ? '沿用默认（标题 qwen-plus，其余 qwen3-max）' : '请选择模型或在下方手动填写'}</option>
      {value && !visible && <option value={value}>{value}（{listed ? '当前选择' : '当前配置，未在获取列表中'}）</option>}
      {matches.map(model => <option key={model.id} value={model.id}>{model.id}</option>)}
    </select>
    {query && !matches.length && <p className="text-xs text-gray-400">没有匹配的模型，当前选择保留。</p>}
    <details>
      <summary className="text-xs text-orange-300 cursor-pointer">手动填写模型 ID</summary>
      <input aria-label={label} value={value} disabled={disabled} onChange={event => onChange(event.target.value)} placeholder="输入模型 ID" className="mt-2 w-full bg-gray-900 border border-gray-600 rounded p-2 text-white text-sm font-mono" />
    </details>
    <p className="text-xs text-gray-400">{hint}</p>
  </div>;
}
