import { useCallback, useEffect, useRef, useState } from 'react';
import { Download } from 'lucide-react';

interface ExportButtonProps {
  onExport: (format: 'csv' | 'json') => void;
  total?: number;
}

export default function ExportButton({ onExport, total }: ExportButtonProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const handleExport = useCallback(
    (format: 'csv' | 'json') => {
      onExport(format);
      setOpen(false);
    },
    [onExport],
  );

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-colors"
      >
        <Download size={14} />
        Export
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-lg py-1">
          {total != null && (
            <div className="px-3 py-1.5 text-[11px] text-slate-400 border-b border-slate-100">
              {total.toLocaleString()} result{total !== 1 ? 's' : ''}
            </div>
          )}
          <button
            onClick={() => handleExport('csv')}
            className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Export as CSV
          </button>
          <button
            onClick={() => handleExport('json')}
            className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Export as JSON
          </button>
        </div>
      )}
    </div>
  );
}
