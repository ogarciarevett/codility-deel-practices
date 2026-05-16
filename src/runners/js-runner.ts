import { deepEqual } from '../lib/deep-equal';
import type { JsProblem, JsTestCase, JsPerfTest } from '../problems/types';

export type LogLevel = 'log' | 'warn' | 'error' | 'info';
export interface ConsoleLog {
  level: LogLevel;
  text: string;
}

export interface TestResult {
  name: string;
  status: 'pass' | 'fail' | 'timeout' | 'error';
  durationMs: number;
  actual?: unknown;
  expected?: unknown;
  error?: string;
  logs?: ConsoleLog[];
}

interface WorkerResponse {
  status: 'pass' | 'fail' | 'error';
  actual?: unknown;
  durationMs: number;
  error?: string;
  logs?: ConsoleLog[];
}

function runCaseInWorker(code: string, input: unknown, timeoutMs: number): Promise<WorkerResponse | { status: 'timeout'; durationMs: number }> {
  return new Promise(resolve => {
    const worker = new Worker(new URL('./js-worker.ts', import.meta.url), { type: 'module' });
    const timer = setTimeout(() => {
      worker.terminate();
      resolve({ status: 'timeout', durationMs: timeoutMs });
    }, timeoutMs);

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      clearTimeout(timer);
      worker.terminate();
      resolve(event.data);
    };
    worker.onerror = (event) => {
      clearTimeout(timer);
      worker.terminate();
      resolve({ status: 'error', durationMs: 0, error: event.message || 'worker error' });
    };

    worker.postMessage({ code, input });
  });
}

async function evaluateCorrectness(code: string, cases: JsTestCase[]): Promise<TestResult[]> {
  const results: TestResult[] = [];
  for (const tc of cases) {
    const resp = await runCaseInWorker(code, tc.input, 2000);
    const logs = 'logs' in resp ? resp.logs : undefined;
    if (resp.status === 'timeout') {
      results.push({ name: tc.name, status: 'timeout', durationMs: resp.durationMs, expected: tc.expected, logs });
      continue;
    }
    if (resp.status === 'error') {
      results.push({ name: tc.name, status: 'error', durationMs: resp.durationMs, error: resp.error, expected: tc.expected, logs });
      continue;
    }
    const ok = deepEqual(resp.actual, tc.expected);
    results.push({
      name: tc.name,
      status: ok ? 'pass' : 'fail',
      durationMs: resp.durationMs,
      actual: resp.actual,
      expected: tc.expected,
      logs,
    });
  }
  return results;
}

async function evaluatePerformance(code: string, tests: JsPerfTest[]): Promise<TestResult[]> {
  const results: TestResult[] = [];
  for (const t of tests) {
    const input = t.buildInput();
    const resp = await runCaseInWorker(code, input, Math.max(t.maxDurationMs * 4, 4000));
    const logs = 'logs' in resp ? resp.logs : undefined;
    if (resp.status === 'timeout') {
      results.push({ name: t.name, status: 'timeout', durationMs: resp.durationMs, logs });
      continue;
    }
    if (resp.status === 'error') {
      results.push({ name: t.name, status: 'error', durationMs: resp.durationMs, error: resp.error, logs });
      continue;
    }
    const tooSlow = resp.durationMs > t.maxDurationMs;
    results.push({
      name: t.name,
      status: tooSlow ? 'fail' : 'pass',
      durationMs: resp.durationMs,
      error: tooSlow ? `exceeded ${t.maxDurationMs}ms budget` : undefined,
      logs,
    });
  }
  return results;
}

export async function runJsExamples(problem: JsProblem, code: string): Promise<TestResult[]> {
  return evaluateCorrectness(code, problem.exampleTests);
}

export interface JsSubmitResults {
  correctness: TestResult[];
  performance: TestResult[];
}

export async function runJsSubmit(problem: JsProblem, code: string): Promise<JsSubmitResults> {
  const correctness = await evaluateCorrectness(code, [...problem.exampleTests, ...problem.hiddenCorrectnessTests]);
  const performance = await evaluatePerformance(code, problem.performanceTests);
  return { correctness, performance };
}
