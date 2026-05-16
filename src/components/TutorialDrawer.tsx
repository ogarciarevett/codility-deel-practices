import { Markdown } from '../lib/markdown';
import type { TutorialStep } from '../problems/types';

interface TutorialDrawerProps {
  steps: TutorialStep[];
  currentStep: number;
  onPrev: () => void;
  onNext: () => void;
  onApply: () => void;
  onClose: () => void;
}

export function TutorialDrawer({ steps, currentStep, onPrev, onNext, onApply, onClose }: TutorialDrawerProps) {
  const step = steps[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === steps.length - 1;

  return (
    <aside className="w-[420px] bg-white border-l border-slate-200 flex flex-col h-full overflow-hidden shadow-lg">
      <header className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-emerald-700 font-semibold">Tutorial</div>
          <div className="text-xs text-slate-500 font-mono mt-0.5">
            Step {currentStep + 1} of {steps.length}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close tutorial"
          className="text-slate-400 hover:text-slate-700 text-lg leading-none px-2"
        >
          ×
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <h2 className="text-base font-semibold text-slate-900 mb-3">{step.title}</h2>
        <div className="text-sm text-slate-700 leading-relaxed">
          <Markdown source={step.why} />
        </div>

        <details className="mt-4 group">
          <summary className="cursor-pointer text-xs font-medium text-slate-500 uppercase tracking-wider hover:text-slate-700">
            Vista previa del código (click para expandir)
          </summary>
          <pre className="mt-2 bg-slate-900 text-slate-100 text-xs p-3 rounded overflow-x-auto">
            <code>{step.codeAfter}</code>
          </pre>
        </details>
      </div>

      <footer className="border-t border-slate-200 bg-slate-50 px-4 py-3 space-y-2">
        <button
          type="button"
          onClick={onApply}
          className="w-full px-3 py-2 text-sm font-medium bg-emerald-600 text-white rounded hover:bg-emerald-700"
        >
          Apply step {currentStep + 1} → editor
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onPrev}
            disabled={isFirst}
            className="flex-1 px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 text-slate-700 rounded hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ← Prev
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={isLast}
            className="flex-1 px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 text-slate-700 rounded hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next →
          </button>
        </div>
      </footer>
    </aside>
  );
}
