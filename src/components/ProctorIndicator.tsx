interface ProctorIndicatorProps {
  keystrokes: number;
  pastes: number;
  clicks: number;
  pasteFlash: boolean;
}

export function ProctorIndicator({ keystrokes, pastes, clicks, pasteFlash }: ProctorIndicatorProps) {
  return (
    <div className={`flex items-center gap-3 px-3 py-1 text-xs font-mono border-t border-slate-200 transition-colors ${pasteFlash ? 'bg-amber-100' : 'bg-slate-50'}`}>
      <span className="text-slate-500">keystrokes: <span className="text-slate-800">{keystrokes}</span></span>
      <span className="text-slate-300">·</span>
      <span className={pastes > 0 ? 'text-amber-700' : 'text-slate-500'}>
        paste events: <span className="text-slate-800">{pastes}</span>
      </span>
      <span className="text-slate-300">·</span>
      <span className="text-slate-500">clicks: <span className="text-slate-800">{clicks}</span></span>
    </div>
  );
}
