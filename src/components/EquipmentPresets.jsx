import React, { useState } from 'react';
import { STORAGE_KEYS } from '../constants/app.js';

const PRESET_COUNT = 3;
const defaultName = index => `设备 ${index + 1}`;

function loadPresets() {
  let saved;
  try { saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.equipmentPresets)); }
  catch { /* Unavailable or damaged storage starts with empty slots. */ }
  return Array.from({ length: PRESET_COUNT }, (_, index) => {
    const entry = Array.isArray(saved) ? saved[index] : null;
    return {
      name: typeof entry?.name === 'string' && entry.name.trim() ? entry.name : defaultName(index),
      equipment: typeof entry?.equipment === 'string' ? entry.equipment : null
    };
  });
}

export default function EquipmentPresets({ equipment, onSelect }) {
  const [presets, setPresets] = useState(loadPresets);
  const [selected, setSelected] = useState(null);
  const [name, setName] = useState('');
  const [status, setStatus] = useState('');
  const [saveError, setSaveError] = useState('');

  const selectPreset = index => {
    setSelected(index);
    setName(presets[index].name);
    setStatus('');
    setSaveError('');
    if (presets[index].equipment !== null) onSelect(presets[index].equipment);
  };

  const savePreset = () => {
    if (selected === null) return;
    const next = presets.map((entry, index) => index === selected
      ? { name: name.trim() || defaultName(index), equipment }
      : entry);
    try {
      localStorage.setItem(STORAGE_KEYS.equipmentPresets, JSON.stringify(next));
      setPresets(next);
      setName(next[selected].name);
      setSaveError('');
      setStatus(`已保存到“${next[selected].name}”`);
    } catch {
      setStatus('');
      setSaveError('设备预设保存失败，请检查本机存储后重试。');
    }
  };

  return <div className="space-y-2 mb-2">
    <div className="flex gap-2" role="group" aria-label="录音设备预设">
      {presets.map((preset, index) => <button
        key={index}
        type="button"
        aria-pressed={selected === index}
        onClick={() => selectPreset(index)}
        className={`flex-1 min-w-0 rounded border px-2 py-1 text-xs ${selected === index ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-gray-300 text-gray-600 hover:bg-gray-100'}`}
        title={preset.name}
      ><span className="block truncate">{preset.name}</span>{preset.equipment === null && <span className="text-gray-400">未保存</span>}</button>)}
    </div>
    {selected !== null && <div className="flex gap-2">
      <input
        aria-label="设备预设名称"
        value={name}
        onChange={event => { setName(event.target.value); setStatus(''); }}
        placeholder={defaultName(selected)}
        className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1 text-xs"
      />
      <button type="button" onClick={savePreset} className="shrink-0 rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-100">保存到当前预设</button>
    </div>}
    {status && <p role="status" className="text-xs text-green-700">{status}</p>}
    {saveError && <p role="alert" className="text-xs text-red-700">{saveError}</p>}
  </div>;
}
