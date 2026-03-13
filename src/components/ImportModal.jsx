import React from 'react';
import { FileText, Sparkles, X } from 'lucide-react';

const ImportModal = ({ isOpen, importText, isLoading, onClose, onImportTextChange, onSubmit }) => {
  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-lg border border-gray-700 flex flex-col max-h-[90vh] text-white">
        <div className="flex justify-between items-center p-4 border-b border-gray-700">
          <h3 className="text-lg font-bold flex items-center gap-2"><FileText size={20} className="text-orange-500" /> 粘贴曲目列表</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={20} /></button>
        </div>
        <div className="p-4 flex-1 overflow-hidden flex flex-col">
          <p className="text-sm text-gray-400 mb-2">在下方粘贴原始文本、HTML 或 JSON。AI 将自动提取信息。</p>
          <textarea
            className="w-full flex-1 bg-gray-900 p-4 rounded text-sm font-mono border border-gray-700 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none resize-none"
            placeholder={`1. Song A - Artist (3:20)\n2. Song B - Artist\n...`}
            value={importText}
            onChange={(e) => onImportTextChange(e.target.value)}
          />
        </div>
        <div className="p-4 border-t border-gray-700 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white">取消</button>
          <button
            onClick={onSubmit}
            disabled={isLoading || !importText}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded text-sm font-bold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? <span className="animate-spin">⏳</span> : <Sparkles size={16} />}
            {isLoading ? '分析中...' : '解析并导入'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportModal;
