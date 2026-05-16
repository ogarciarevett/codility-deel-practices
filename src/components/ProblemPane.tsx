import { Markdown } from '../lib/markdown';
import type { Problem } from '../problems';

interface ProblemPaneProps {
  problem: Problem;
}

export function ProblemPane({ problem }: ProblemPaneProps) {
  const complexity =
    problem.kind === 'js' ? problem.expectedComplexity
    : problem.kind === 'sql' ? 'Optimize for query plan'
    : 'HTTP handler — correctness + ownership';
  return (
    <div className="h-full overflow-y-auto bg-white border-r border-slate-200 p-6">
      <div className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">
        Task · {problem.id}
      </div>
      <div className="text-xs text-slate-500 mb-4">
        Expected complexity: <span className="font-mono text-slate-700">{complexity}</span>
      </div>
      <Markdown source={problem.statement} />
    </div>
  );
}
