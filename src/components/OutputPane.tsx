import { useState } from 'react';
import type { TestResult, ConsoleLog } from '../runners/js-runner';
import { CodePane } from './CodePane';

export type OutputTab = 'example' | 'submit' | 'reference' | 'console';

interface OutputPaneProps {
  exampleResults: TestResult[] | null;
  submitCorrectness: TestResult[] | null;
  submitPerformance: TestResult[] | null;
  referenceSolution: string;
  referenceLanguage: 'javascript' | 'sql';
  referenceUnlocked: boolean;
  running: boolean;
  activeTab: OutputTab;
  onTabChange: (t: OutputTab) => void;
}

function StatusBadge({ status }: { status: TestResult['status'] }) {
  const colors = {
    pass: 'bg-emerald-100 text-emerald-700',
    fail: 'bg-red-100 text-red-700',
    timeout: 'bg-amber-100 text-amber-700',
    error: 'bg-red-100 text-red-700',
  }[status];
  return (
    <span className={`px-1.5 py-0.5 rounded text-xs font-medium uppercase ${colors}`}>
      {status}
    </span>
  );
}

function ResultRow({ r }: { r: TestResult }) {
  const [expanded, setExpanded] = useState(false);
  const canExpand = r.status !== 'pass' || (r.logs && r.logs.length > 0);
  const logCount = r.logs?.length ?? 0;
  return (
    <div className="border-b border-slate-100 last:border-b-0">
      <button
        type="button"
        onClick={() => canExpand && setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <StatusBadge status={r.status} />
          <span className="text-sm font-mono">{r.name}</span>
          {logCount > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">
              📋 {logCount}
            </span>
          )}
        </div>
        <span className="text-xs text-slate-500 font-mono">{Math.round(r.durationMs)}ms</span>
      </button>
      {expanded && (
        <div className="px-3 pb-3 text-xs font-mono space-y-1 bg-slate-50">
          {r.error && <div className="text-red-700">error: {r.error}</div>}
          {r.expected !== undefined && (
            <div><span className="text-slate-500">expected:</span> <span className="text-slate-800 break-all">{JSON.stringify(r.expected)}</span></div>
          )}
          {r.actual !== undefined && (
            <div><span className="text-slate-500">actual:</span> <span className="text-slate-800 break-all">{JSON.stringify(r.actual)}</span></div>
          )}
        </div>
      )}
    </div>
  );
}

function ResultList({ results, emptyText }: { results: TestResult[] | null; emptyText: string }) {
  if (!results) return <div className="p-4 text-sm text-slate-500">{emptyText}</div>;
  if (results.length === 0) return <div className="p-4 text-sm text-slate-500">no tests</div>;
  return <div>{results.map((r, i) => <ResultRow key={i} r={r} />)}</div>;
}

function LogLine({ log }: { log: ConsoleLog }) {
  const color = {
    log: 'text-slate-700',
    info: 'text-sky-700',
    warn: 'text-amber-700',
    error: 'text-red-700',
  }[log.level];
  const prefix = { log: '', info: 'INFO ', warn: 'WARN ', error: 'ERROR ' }[log.level];
  return (
    <div className={`font-mono text-xs whitespace-pre-wrap break-all px-3 py-0.5 ${color}`}>
      <span className="text-slate-400 mr-2">{prefix}</span>
      {log.text}
    </div>
  );
}

function ConsoleView({
  exampleResults,
  submitCorrectness,
  submitPerformance,
}: {
  exampleResults: TestResult[] | null;
  submitCorrectness: TestResult[] | null;
  submitPerformance: TestResult[] | null;
}) {
  const sections: { title: string; results: TestResult[] | null }[] = [
    { title: 'Example Tests', results: exampleResults },
    { title: 'Submit · Correctness', results: submitCorrectness },
    { title: 'Submit · Performance', results: submitPerformance },
  ];

  // Show only the most recent populated source — typical user flow is one set at a time.
  const populated = sections.filter(s => s.results && s.results.length > 0);
  if (populated.length === 0) {
    return (
      <div className="p-4 text-sm text-slate-500">
        Run example tests or submit. Any <code className="bg-slate-100 px-1 rounded">console.log</code> from your solution will show up here.
        <div className="mt-2 text-xs text-slate-400">
          (Useful so you don't need to open browser DevTools, which on a real Codility assessment may trigger proctor alerts.)
        </div>
      </div>
    );
  }

  const totalLogs = populated.reduce(
    (sum, s) => sum + (s.results?.reduce((n, r) => n + (r.logs?.length ?? 0), 0) ?? 0),
    0,
  );
  const heavy = totalLogs > 50;

  return (
    <div className="text-xs">
      {heavy && (
        <div className="px-3 py-2 bg-amber-100 text-amber-800 border-b border-amber-200">
          ⚠ {totalLogs} log calls captured across this run. Heavy logging inside loops can dominate runtime
          — strip <code className="bg-amber-200 px-1 rounded">console.log</code> before Submit.
        </div>
      )}
      {populated.map(section => (
        <div key={section.title}>
          <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-slate-500 bg-slate-100 border-b border-slate-200 font-semibold">
            {section.title}
          </div>
          {section.results!.map((r, ri) => {
            const logs = r.logs ?? [];
            return (
              <div key={ri} className="border-b border-slate-100">
                <div className="px-3 py-1 flex items-center gap-2 bg-white">
                  <StatusBadge status={r.status} />
                  <span className="text-xs font-mono text-slate-700">{r.name}</span>
                  <span className="ml-auto text-[10px] text-slate-400 font-mono">
                    {logs.length} log{logs.length === 1 ? '' : 's'}
                  </span>
                </div>
                {logs.length === 0 ? (
                  <div className="px-3 py-1 text-[11px] text-slate-400 italic">no console output</div>
                ) : (
                  <div className="bg-slate-50 py-1">
                    {logs.map((log, li) => <LogLine key={li} log={log} />)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function OutputPane(props: OutputPaneProps) {
  const { exampleResults, submitCorrectness, submitPerformance, referenceSolution, referenceLanguage, referenceUnlocked, running, activeTab, onTabChange } = props;

  const consoleCount = [exampleResults, submitCorrectness, submitPerformance]
    .flatMap(rs => rs ?? [])
    .reduce((n, r) => n + (r.logs?.length ?? 0), 0);

  return (
    <div className="flex flex-col h-full bg-white border-t border-slate-200">
      <div className="flex border-b border-slate-200 bg-slate-50">
        <TabButton active={activeTab === 'example'} onClick={() => onTabChange('example')}>Example Tests</TabButton>
        <TabButton active={activeTab === 'submit'} onClick={() => onTabChange('submit')}>Submit Results</TabButton>
        <TabButton active={activeTab === 'console'} onClick={() => onTabChange('console')}>
          Console{consoleCount > 0 ? ` (${consoleCount})` : ''}
        </TabButton>
        <TabButton active={activeTab === 'reference'} onClick={() => onTabChange('reference')} disabled={!referenceUnlocked}>
          {referenceUnlocked ? 'Reference Solution' : 'Reference 🔒'}
        </TabButton>
        {running && <div className="ml-auto px-3 py-2 text-xs text-slate-500 italic">running…</div>}
      </div>
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'example' && (
          <ResultList results={exampleResults} emptyText="Click 'Run Example Tests' to see results." />
        )}
        {activeTab === 'submit' && (
          <div>
            <div className="px-3 py-2 text-xs uppercase tracking-wider text-slate-500 bg-slate-50 border-b border-slate-100">Correctness</div>
            <ResultList results={submitCorrectness} emptyText="No submit yet. Click Submit to grade." />
            <div className="px-3 py-2 text-xs uppercase tracking-wider text-slate-500 bg-slate-50 border-b border-slate-100 border-t">Performance</div>
            <ResultList results={submitPerformance} emptyText="No submit yet." />
          </div>
        )}
        {activeTab === 'console' && (
          <ConsoleView
            exampleResults={exampleResults}
            submitCorrectness={submitCorrectness}
            submitPerformance={submitPerformance}
          />
        )}
        {activeTab === 'reference' && referenceUnlocked && (
          <div className="h-full">
            <CodePane
              value={referenceSolution}
              language={referenceLanguage}
              readOnly
              onChange={() => { /* read-only */ }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, disabled, children }: { active: boolean; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`px-4 py-2 text-sm font-medium border-r border-slate-200 ${
        active ? 'bg-white text-slate-900 border-b-2 border-b-emerald-500' :
        disabled ? 'text-slate-400 cursor-not-allowed' :
        'text-slate-600 hover:bg-white'
      }`}
    >
      {children}
    </button>
  );
}
