import React from 'react';
import { Database, Loader2, Search, X } from 'lucide-react';

const SearchModal = ({
  isOpen,
  error,
  isLoading,
  searchQuery,
  searchResults,
  onClose,
  onSearch,
  onSearchQueryChange,
  onSelectResult
}) => {
  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl border border-gray-700 flex flex-col max-h-[85vh] text-white">
        <div className="flex justify-between items-center p-4 border-b border-gray-700">
          <h3 className="text-lg font-bold flex items-center gap-2"><Database size={20} className="text-orange-500" /> MusicBrainz 搜索</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={20} /></button>
        </div>
        <div className="p-4 bg-gray-900/50 space-y-3 border-b border-gray-700">
          <div className="flex gap-3">
            <input
              className="flex-1 bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm focus:border-orange-500 outline-none"
              placeholder="专辑标题 (例如：Abbey Road)"
              value={searchQuery.album}
              onChange={(e) => onSearchQueryChange({ ...searchQuery, album: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && onSearch()}
            />
            <input
              className="flex-1 bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm focus:border-orange-500 outline-none"
              placeholder="艺术家 (例如：The Beatles)"
              value={searchQuery.artist}
              onChange={(e) => onSearchQueryChange({ ...searchQuery, artist: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && onSearch()}
            />
            <button onClick={onSearch} disabled={isLoading} className="px-4 bg-orange-600 hover:bg-orange-500 text-white rounded font-bold text-sm flex items-center gap-2">
              {isLoading ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />}
              搜索
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
          {error && <div className="p-4 text-red-400 bg-red-900/20 text-center rounded">{error}</div>}
          {searchResults.map((releaseGroup) => (
            <div
              key={releaseGroup.id}
              className="bg-gray-700/50 hover:bg-gray-700 p-3 rounded flex justify-between items-center cursor-pointer transition-colors border border-transparent hover:border-orange-500/50"
              onClick={() => onSelectResult(releaseGroup)}
            >
              <div>
                <h4 className="font-bold text-white">{releaseGroup.title}</h4>
                <p className="text-sm text-gray-400">
                  {releaseGroup['artist-credit']?.[0]?.name} · {releaseGroup['first-release-date']?.slice(0, 4)} · {releaseGroup['primary-type']}
                </p>
              </div>
              <button className="px-3 py-1 bg-gray-600 hover:bg-orange-600 text-xs rounded text-white transition-colors">选择</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SearchModal;
