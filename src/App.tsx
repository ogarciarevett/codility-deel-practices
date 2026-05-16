import { useCallback, useEffect, useRef, useState } from 'react';
import { ProblemPane } from './components/ProblemPane';
import { CodePane } from './components/CodePane';
import { OutputPane, type OutputTab } from './components/OutputPane';
import { Timer } from './components/Timer';
import { ProctorIndicator } from './components/ProctorIndicator';
import { ResultsModal } from './components/ResultsModal';
import { TutorialDrawer } from './components/TutorialDrawer';
import { FileTree } from './components/FileTree';
import { problems, type Problem } from './problems';
import { runJsExamples, runJsSubmit, type TestResult } from './runners/js-runner';
import { runSqlExamples, runSqlSubmit } from './runners/sql-runner';
import { runApiExamples, runApiSubmit } from './runners/api-runner';
import { computeScore, type Scorecard } from './lib/score';
import type { OnMount } from '@monaco-editor/react';
import type { ProblemFile, JsProblem, SqlProblem, ApiProblem } from './problems/types';

const TIMER_KEY = 'codility-sim-timer-deadline';
const SUBMITTED_KEY = 'codility-sim-submitted';
const CODE_KEY_PREFIX = 'codility-sim-code-';
const TOTAL_SECONDS = 120 * 60;

interface PerTaskState {
  files: Record<string, string>;
  activeFile: string;
  exampleResults: TestResult[] | null;
  submitCorrectness: TestResult[] | null;
  submitPerformance: TestResult[] | null;
  activeTab: OutputTab;
  running: boolean;
}

function defaultPath(problem: Problem): string {
  if (problem.kind === 'api') return problem.entryFile;
  return problem.kind === 'sql' ? 'query.sql' : 'solution.js';
}

function getProblemFiles(problem: Problem): ProblemFile[] {
  if (problem.kind === 'api') return problem.files;
  const path = defaultPath(problem);
  const language: ProblemFile['language'] = problem.kind === 'sql' ? 'sql' : 'javascript';
  return [{ path, content: problem.stub, language }];
}

function makeInitialState(problem: Problem): PerTaskState {
  const filesArr = getProblemFiles(problem);
  const files: Record<string, string> = {};
  for (const f of filesArr) {
    const key = CODE_KEY_PREFIX + problem.id + ':' + f.path;
    const stored = sessionStorage.getItem(key);
    files[f.path] = stored ?? f.content;
  }
  return {
    files,
    activeFile: defaultPath(problem),
    exampleResults: null,
    submitCorrectness: null,
    submitPerformance: null,
    activeTab: 'example',
    running: false,
  };
}

function useCountdown(): { remaining: number; paused: boolean } {
  const [remaining, setRemaining] = useState(() => {
    const stored = sessionStorage.getItem(TIMER_KEY);
    if (stored) {
      const deadline = Number(stored);
      return Math.max(0, Math.floor((deadline - Date.now()) / 1000));
    }
    const deadline = Date.now() + TOTAL_SECONDS * 1000;
    sessionStorage.setItem(TIMER_KEY, String(deadline));
    return TOTAL_SECONDS;
  });
  const [paused, setPaused] = useState(false);
  const blurredAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (paused) return;
    const tick = () => {
      const stored = sessionStorage.getItem(TIMER_KEY);
      if (!stored) return;
      const r = Math.max(0, Math.floor((Number(stored) - Date.now()) / 1000));
      setRemaining(r);
    };
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [paused]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        blurredAtRef.current = Date.now();
      } else {
        const blurredAt = blurredAtRef.current;
        if (blurredAt !== null && paused) {
          const stored = sessionStorage.getItem(TIMER_KEY);
          if (stored) {
            const pausedMs = Date.now() - blurredAt;
            sessionStorage.setItem(TIMER_KEY, String(Number(stored) + pausedMs));
          }
          setPaused(false);
        }
        blurredAtRef.current = null;
      }
    };
    const pauseCheckInterval = setInterval(() => {
      const b = blurredAtRef.current;
      if (b !== null && Date.now() - b > 60_000 && !paused) setPaused(true);
    }, 1000);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      clearInterval(pauseCheckInterval);
    };
  }, [paused]);

  return { remaining, paused };
}

function languageOf(activeFilePath: string, problem: Problem): 'javascript' | 'sql' {
  if (activeFilePath.endsWith('.sql')) return 'sql';
  if (problem.kind === 'sql') return 'sql';
  return 'javascript';
}

function fileMeta(problem: Problem, path: string): ProblemFile | null {
  const files = getProblemFiles(problem);
  return files.find(f => f.path === path) ?? null;
}

function entryCodeOf(problem: Problem, files: Record<string, string>): string {
  const entry = problem.kind === 'api' ? problem.entryFile : defaultPath(problem);
  return files[entry] ?? '';
}

export function App() {
  const [activeIdx, setActiveIdx] = useState(0);
  const [states, setStates] = useState<PerTaskState[]>(() => problems.map(makeInitialState));
  const [hasSubmitted, setHasSubmitted] = useState<boolean>(() => sessionStorage.getItem(SUBMITTED_KEY) === '1');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState<{ title: string; scorecard: Scorecard; correctness: TestResult[]; performance: TestResult[] } | null>(null);
  const [keystrokes, setKeystrokes] = useState(0);
  const [pastes, setPastes] = useState(0);
  const [clicks, setClicks] = useState(0);
  const [pasteFlash, setPasteFlash] = useState(false);
  const autoSubmittedRef = useRef(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const monacoRef = useRef<Parameters<OnMount>[1] | null>(null);

  const { remaining, paused } = useCountdown();
  const locked = remaining <= 0;

  const activeProblem = problems[activeIdx];
  const activeState = states[activeIdx];
  const showTutorial = tutorialOpen && !!activeProblem.tutorial;

  const activeFileMeta = fileMeta(activeProblem, activeState.activeFile);
  const editorReadOnly = locked || activeFileMeta?.readOnly === true;
  const codeLanguage = languageOf(activeState.activeFile, activeProblem);
  const problemFiles = getProblemFiles(activeProblem);
  const hasMultiFile = problemFiles.length > 1;

  const updateActive = useCallback((patch: Partial<PerTaskState>) => {
    setStates(prev => prev.map((s, i) => (i === activeIdx ? { ...s, ...patch } : s)));
  }, [activeIdx]);

  const onCodeChange = useCallback((code: string) => {
    sessionStorage.setItem(CODE_KEY_PREFIX + activeProblem.id + ':' + activeState.activeFile, code);
    setStates(prev => prev.map((s, i) => {
      if (i !== activeIdx) return s;
      return { ...s, files: { ...s.files, [s.activeFile]: code } };
    }));
  }, [activeProblem.id, activeState.activeFile, activeIdx]);

  const onSelectFile = useCallback((path: string) => {
    updateActive({ activeFile: path });
  }, [updateActive]);

  const onPaste = useCallback(() => {
    setPastes(p => p + 1);
    setPasteFlash(true);
    setTimeout(() => setPasteFlash(false), 500);
  }, []);

  const onKeystroke = useCallback(() => setKeystrokes(k => k + 1), []);

  useEffect(() => {
    const onClick = () => setClicks(c => c + 1);
    window.addEventListener('click', onClick);
    return () => window.removeEventListener('click', onClick);
  }, []);

  const onEditorReady: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
  }, []);

  const applyTutorialStep = useCallback(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    const tutorial = activeProblem.tutorial;
    if (!editor || !monaco || !tutorial) return;
    const newCode = tutorial.steps[tutorialStep].codeAfter;
    const oldCode = editor.getValue();
    const oldLineSet = new Set(oldCode.split('\n').map(l => l.trim()));
    const newLines = newCode.split('\n');
    editor.setValue(newCode);
    sessionStorage.setItem(CODE_KEY_PREFIX + activeProblem.id + ':' + activeState.activeFile, newCode);
    setStates(prev => prev.map((s, i) => {
      if (i !== activeIdx) return s;
      return { ...s, files: { ...s.files, [s.activeFile]: newCode } };
    }));
    const newLineNumbers: number[] = [];
    newLines.forEach((line, i) => {
      if (line.trim() === '') return;
      if (!oldLineSet.has(line.trim())) newLineNumbers.push(i + 1);
    });
    if (newLineNumbers.length === 0) return;
    const decorations = newLineNumbers.map(lineNum => ({
      range: new monaco.Range(lineNum, 1, lineNum, 1),
      options: {
        isWholeLine: true,
        className: 'tutorial-new-line',
        linesDecorationsClassName: 'tutorial-new-line-gutter',
      },
    }));
    const ids = editor.deltaDecorations([], decorations);
    setTimeout(() => {
      editor.deltaDecorations(ids, []);
    }, 1800);
    editor.revealLineInCenter(newLineNumbers[0]);
  }, [activeProblem.id, activeProblem.tutorial, activeState.activeFile, tutorialStep, activeIdx]);

  const openTutorial = useCallback(() => {
    setTutorialStep(0);
    setTutorialOpen(true);
  }, []);

  const dispatchExamples = useCallback(async (problem: Problem, code: string): Promise<TestResult[]> => {
    if (problem.kind === 'js') return runJsExamples(problem as JsProblem, code);
    if (problem.kind === 'sql') return runSqlExamples(problem as SqlProblem, code);
    return runApiExamples(problem as ApiProblem, code);
  }, []);

  const dispatchSubmit = useCallback(async (problem: Problem, code: string) => {
    if (problem.kind === 'js') return runJsSubmit(problem as JsProblem, code);
    if (problem.kind === 'sql') return runSqlSubmit(problem as SqlProblem, code);
    return runApiSubmit(problem as ApiProblem, code);
  }, []);

  const runExamples = useCallback(async () => {
    const entryCode = entryCodeOf(activeProblem, activeState.files);
    updateActive({ running: true, activeTab: 'example' });
    try {
      const results = await dispatchExamples(activeProblem, entryCode);
      updateActive({ exampleResults: results, running: false });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      updateActive({
        exampleResults: [{ name: 'runner', status: 'error', durationMs: 0, error: errMsg }],
        running: false,
      });
    }
  }, [activeProblem, activeState.files, updateActive, dispatchExamples]);

  const markSubmitted = useCallback(() => {
    sessionStorage.setItem(SUBMITTED_KEY, '1');
    setHasSubmitted(true);
  }, []);

  const submitTask = useCallback(async (idx: number, openModal: boolean) => {
    const problem = problems[idx];
    const entryCode = entryCodeOf(problem, states[idx].files);
    setStates(prev => prev.map((s, i) => (i === idx ? { ...s, running: true, activeTab: 'submit' } : s)));
    try {
      const res = await dispatchSubmit(problem, entryCode);
      setStates(prev => prev.map((s, i) => (i === idx ? {
        ...s,
        submitCorrectness: res.correctness,
        submitPerformance: res.performance,
        running: false,
      } : s)));
      if (openModal) {
        const scorecard = computeScore(res.correctness, res.performance);
        setModalData({ title: problem.title, scorecard, correctness: res.correctness, performance: res.performance });
        setModalOpen(true);
      }
      markSubmitted();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setStates(prev => prev.map((s, i) => (i === idx ? {
        ...s,
        running: false,
        submitCorrectness: [{ name: 'runner', status: 'error', durationMs: 0, error: errMsg }],
      } : s)));
    }
  }, [states, markSubmitted, dispatchSubmit]);

  useEffect(() => {
    if (locked && !autoSubmittedRef.current) {
      autoSubmittedRef.current = true;
      (async () => {
        for (let i = 0; i < problems.length; i++) {
          await submitTask(i, false);
        }
      })();
    }
  }, [locked, submitTask]);

  const activeContent = activeState.files[activeState.activeFile] ?? '';

  const referenceLanguage: 'javascript' | 'sql' = activeProblem.kind === 'sql' ? 'sql' : 'javascript';

  return (
    <div className="h-screen flex flex-col">
      <header className="flex items-center justify-between px-4 py-2 bg-white border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="font-semibold text-slate-900 text-sm whitespace-nowrap">Deel · Codility Simulator</div>
          <select
            value={activeIdx}
            onChange={(e) => {
              setActiveIdx(Number(e.target.value));
              setTutorialStep(0);
            }}
            className="px-2 py-1 text-xs border border-slate-300 rounded bg-white text-slate-800 max-w-[480px]"
          >
            {problems.map((p, i) => {
              const kindLabel = p.kind === 'js' ? 'JS' : p.kind === 'sql' ? 'SQL' : 'API';
              return (
                <option key={p.id} value={i}>
                  Task {i + 1} · {p.title} ({kindLabel}){p.tutorial ? ' · 🎓' : ''}
                </option>
              );
            })}
          </select>
          <span className="text-xs text-slate-400 font-mono">{activeIdx + 1}/{problems.length}</span>
        </div>
        <div className="flex items-center gap-3">
          {activeProblem.tutorial && (
            <button
              type="button"
              onClick={tutorialOpen ? () => setTutorialOpen(false) : openTutorial}
              className={`px-3 py-1 text-xs font-medium rounded ${
                tutorialOpen
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
              }`}
            >
              🎓 Tutorial {tutorialOpen ? '(close)' : ''}
            </button>
          )}
          <span className="text-xs font-mono text-slate-500">{codeLanguage}</span>
          <Timer remainingSeconds={remaining} paused={paused} />
        </div>
      </header>

      <main className="flex-1 flex min-h-0">
        <div className="flex-1 min-w-0">
          <ProblemPane problem={activeProblem} />
        </div>
        <div className="flex-1 min-w-0 flex flex-col bg-white">
          <div className="flex-1 min-h-0 flex border-b border-slate-200">
            {hasMultiFile && (
              <FileTree
                files={problemFiles}
                activeFile={activeState.activeFile}
                onSelect={onSelectFile}
              />
            )}
            <div className="flex-1 min-w-0 flex flex-col">
              {hasMultiFile && (
                <div className="px-3 py-1 text-[11px] text-slate-500 bg-slate-50 border-b border-slate-200 font-mono">
                  {activeState.activeFile}
                  {activeFileMeta?.readOnly && <span className="ml-2 text-slate-400">[read-only]</span>}
                </div>
              )}
              <div className="flex-1 min-h-0">
                <CodePane
                  value={activeContent}
                  language={codeLanguage}
                  readOnly={editorReadOnly}
                  onChange={onCodeChange}
                  onPaste={onPaste}
                  onKeystroke={onKeystroke}
                  onEditorReady={onEditorReady}
                />
              </div>
            </div>
          </div>
          <div className="h-[40%] min-h-0">
            <OutputPane
              exampleResults={activeState.exampleResults}
              submitCorrectness={activeState.submitCorrectness}
              submitPerformance={activeState.submitPerformance}
              referenceSolution={activeProblem.referenceSolution}
              referenceLanguage={referenceLanguage}
              referenceUnlocked={hasSubmitted}
              running={activeState.running}
              activeTab={activeState.activeTab}
              onTabChange={(t) => updateActive({ activeTab: t })}
            />
          </div>
        </div>
        {showTutorial && activeProblem.tutorial && (
          <TutorialDrawer
            steps={activeProblem.tutorial.steps}
            currentStep={tutorialStep}
            onPrev={() => setTutorialStep(s => Math.max(0, s - 1))}
            onNext={() => setTutorialStep(s => Math.min(activeProblem.tutorial!.steps.length - 1, s + 1))}
            onApply={applyTutorialStep}
            onClose={() => setTutorialOpen(false)}
          />
        )}
      </main>

      <ProctorIndicator
        keystrokes={keystrokes}
        pastes={pastes}
        clicks={clicks}
        pasteFlash={pasteFlash}
      />

      <div
        className="fixed bottom-10 flex gap-2 z-40 transition-[right] duration-200"
        style={{ right: showTutorial ? '440px' : '24px' }}
      >
        <button
          type="button"
          onClick={runExamples}
          disabled={activeState.running || locked}
          className="px-4 py-2 text-sm font-medium bg-slate-200 text-slate-800 rounded shadow hover:bg-slate-300 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Run Example Tests
        </button>
        <button
          type="button"
          onClick={() => submitTask(activeIdx, true)}
          disabled={activeState.running || locked}
          className="px-4 py-2 text-sm font-medium bg-emerald-600 text-white rounded shadow hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Submit
        </button>
      </div>

      {modalOpen && modalData && (
        <ResultsModal
          open={modalOpen}
          taskTitle={modalData.title}
          scorecard={modalData.scorecard}
          correctness={modalData.correctness}
          performance={modalData.performance}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}
