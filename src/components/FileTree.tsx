import type { ProblemFile } from '../problems/types';

interface FileTreeProps {
  files: ProblemFile[];
  activeFile: string;
  onSelect: (path: string) => void;
}

function iconFor(file: ProblemFile): string {
  if (file.path.endsWith('.md')) return '📝';
  if (file.path.endsWith('.sql')) return '🗄';
  if (file.path.endsWith('.json')) return '⚙';
  return '📄';
}

export function FileTree({ files, activeFile, onSelect }: FileTreeProps) {
  return (
    <aside className="w-44 bg-slate-50 border-r border-slate-200 flex flex-col overflow-hidden">
      <div className="px-3 py-2 text-[10px] uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200">
        Files
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {files.map(f => {
          const active = f.path === activeFile;
          return (
            <button
              key={f.path}
              type="button"
              onClick={() => onSelect(f.path)}
              className={`w-full text-left px-3 py-1 text-xs font-mono flex items-center gap-2 ${
                active ? 'bg-white text-slate-900 border-l-2 border-l-emerald-500' : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span>{iconFor(f)}</span>
              <span className="truncate">{f.path}</span>
              {f.readOnly && <span className="ml-auto text-[9px] text-slate-400">RO</span>}
            </button>
          );
        })}
      </div>
    </aside>
  );
}
