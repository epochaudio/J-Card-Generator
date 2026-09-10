import React, { useEffect, useRef } from 'react';

// Native disclosure keeps ordinary buttons and their keyboard behavior intact.
export default function DisclosureMenu({ label, compact = false, children }) {
  const node = useRef(null);
  useEffect(() => {
    const closeOutside = event => {
      if (!node.current?.contains(event.target)) node.current?.removeAttribute('open');
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('focusin', closeOutside);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('focusin', closeOutside);
    };
  }, []);
  return <details ref={node} className="relative" onKeyDown={event => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      node.current.removeAttribute('open');
      node.current.querySelector('summary').focus();
    }
  }}>
    <summary aria-label={label} className={`cursor-pointer select-none rounded-md px-3 py-2 text-sm hover:bg-gray-100 ${compact ? 'list-none [&::-webkit-details-marker]:hidden' : ''}`}>{compact ? <span aria-hidden="true">▾</span> : label}</summary>
    <div className="absolute right-0 top-full mt-2 w-64 max-w-[85vw] max-h-[70vh] overflow-y-auto rounded-lg border border-gray-200 bg-white text-gray-800 p-2 shadow-xl z-30" onClick={event => {
      if (event.target.closest('button, a')) {
        node.current.removeAttribute('open');
        // Only restore focus when the action has not already opened another surface.
        if (node.current.contains(document.activeElement)) node.current.querySelector('summary').focus();
      }
    }}>{children}</div>
  </details>;
}
