import React from 'react';
import { Globe, Key, Settings, X } from 'lucide-react';

const SettingsModal = ({ isOpen, apiKey, onClose, onApiKeyChange }) => {
  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-[60] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-md border border-gray-700 text-white">
        <div className="flex justify-between items-center p-4 border-b border-gray-700">
          <h3 className="text-lg font-bold flex items-center gap-2"><Settings size={20} className="text-gray-400" /> 设置</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={20} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
              <Key size={16} className="text-orange-500" />
              DashScope API Key (阿里云)
            </label>
            <input
              type="password"
              value={apiKey || ''}
              onChange={(e) => onApiKeyChange(e.target.value)}
              className="w-full bg-gray-900 border border-gray-600 rounded p-3 text-white focus:ring-2 focus:ring-orange-500 outline-none font-mono text-sm"
              placeholder="sk-..."
            />
            <p className="mt-2 text-xs text-gray-400">
              <a href="https://help.aliyun.com/zh/model-studio/get-started-with-models/" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline flex items-center gap-1">
                如何获取 API Key? <Globe size={10} />
              </a>
            </p>
          </div>

          <div className="pt-4 border-t border-gray-700">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">关于 (About)</h4>
            <div className="text-[10px] text-gray-400 leading-relaxed space-y-2">
              <p>
                <span className="text-gray-300 font-bold">© 2025 门耳朵 (Epoch Audio). 保留所有权利。</span>
              </p>
              <p>
                本软件为开源软件，仅供个人<span className="text-gray-300">非商业目的</span>免费使用、学习与研究。
              </p>
              <p className="text-red-400/80">
                🚫 禁止商业化用途：禁止售卖、会员付费下载或提供有偿代制作服务。
              </p>
              <p>
                允许非商业转载，但必须完整保留本声明且不得收费。
              </p>
            </div>
          </div>
        </div>
        <div className="p-4 border-t border-gray-700 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded font-medium">完成</button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
