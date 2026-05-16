import type { Scorecard } from '../lib/score';
import type { TestResult } from '../runners/js-runner';

interface ResultsModalProps {
  open: boolean;
  taskTitle: string;
  scorecard: Scorecard;
  correctness: TestResult[];
  performance: TestResult[];
  onClose: () => void;
}

function ScoreBar({ pct, label }: { pct: number; label: string }) {
  const color = pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-xs">
        <span className="text-slate-600">{label}</span>
        <span className="font-mono font-semibold text-slate-900">{pct}%</span>
      </div>
      <div className="h-2 bg-slate-200 rounded overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function ResultsModal({ open, taskTitle, scorecard, correctness, performance, onClose }: ResultsModalProps) {
  if (!open) return null;
  const all = [...correctness.map(r => ({ ...r, group: 'Correctness' })), ...performance.map(r => ({ ...r, group: 'Performance' }))];
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-[640px] max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-slate-500">Submit results</div>
            <div className="text-lg font-semibold text-slate-900">{taskTitle}</div>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-wider text-slate-500">Total</div>
            <div className="text-3xl font-bold text-emerald-600 font-mono">{scorecard.totalPct}%</div>
          </div>
        </div>
        <div className="px-6 py-4 grid grid-cols-2 gap-4 border-b border-slate-200">
          <ScoreBar pct={scorecard.correctnessPct} label={`Correctness (${scorecard.correctnessPassed}/${scorecard.correctnessTotal})`} />
          <ScoreBar pct={scorecard.performancePct} label={`Performance (${scorecard.performancePassed}/${scorecard.performanceTotal})`} />
        </div>
        <div className="overflow-y-auto flex-1">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-slate-500 bg-slate-50 sticky top-0">
              <tr>
                <th className="px-4 py-2 text-left">Group</th>
                <th className="px-4 py-2 text-left">Test</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-right">Time</th>
              </tr>
            </thead>
            <tbody>
              {all.map((r, i) => (
                <tr key={i} className="border-t border-slate-100">
                  <td className="px-4 py-2 text-slate-500 text-xs">{r.group}</td>
                  <td className="px-4 py-2 font-mono">{r.name}</td>
                  <td className="px-4 py-2">
                    <span className={
                      r.status === 'pass' ? 'text-emerald-700' :
                      r.status === 'timeout' ? 'text-amber-700' : 'text-red-700'
                    }>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-xs text-slate-500">{Math.round(r.durationMs)}ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-3 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 text-white text-sm rounded hover:bg-slate-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
