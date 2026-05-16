import { deepEqual } from '../lib/deep-equal';
import type { ApiProblem, ApiTestCase, ApiPerfTest, ApiDb, ApiRequest, ApiResponse } from '../problems/types';
import type { TestResult, ConsoleLog, LogLevel } from './js-runner';

const MAX_LOGS = 200;
const MAX_LOG_LEN = 500;

function serializeArg(v: unknown): string {
  if (v === null) return 'null';
  if (v === undefined) return 'undefined';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'bigint') return String(v);
  if (typeof v === 'function') return `[Function ${(v as { name?: string }).name || 'anonymous'}]`;
  try {
    const seen = new WeakSet<object>();
    return JSON.stringify(v, (_k, val) => {
      if (typeof val === 'object' && val !== null) {
        if (seen.has(val as object)) return '[Circular]';
        seen.add(val as object);
      }
      if (typeof val === 'bigint') return String(val) + 'n';
      return val;
    });
  } catch {
    return String(v);
  }
}

function formatArgs(args: unknown[]): string {
  const out = args.map(serializeArg).join(' ');
  return out.length > MAX_LOG_LEN ? out.slice(0, MAX_LOG_LEN) + '… [truncated]' : out;
}

async function withConsoleCaptureAsync<T>(fn: () => T | Promise<T>): Promise<{ value: T; logs: ConsoleLog[] }> {
  const logs: ConsoleLog[] = [];
  let dropped = 0;
  const push = (level: LogLevel, args: unknown[]) => {
    if (logs.length >= MAX_LOGS) { dropped++; return; }
    logs.push({ level, text: formatArgs(args) });
  };
  const orig = { log: console.log, warn: console.warn, error: console.error, info: console.info };
  console.log = (...args: unknown[]) => push('log', args);
  console.warn = (...args: unknown[]) => push('warn', args);
  console.error = (...args: unknown[]) => push('error', args);
  console.info = (...args: unknown[]) => push('info', args);
  try {
    const value = await fn();
    if (dropped > 0) logs.push({ level: 'warn', text: `(+${dropped} more logs dropped — exceeded ${MAX_LOGS} cap)` });
    return { value, logs };
  } finally {
    console.log = orig.log;
    console.warn = orig.warn;
    console.error = orig.error;
    console.info = orig.info;
  }
}

function freshDb(): ApiDb {
  return { profiles: [], contracts: [], jobs: [] };
}

interface ExtractedHandler {
  handle: (req: ApiRequest, db: ApiDb) => ApiResponse | Promise<ApiResponse>;
}

function compileHandler(code: string): ExtractedHandler {
  // The user's code defines a top-level `handle` function. We wrap with Function
  // ctor and return the symbol.
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const factory = new Function(`${code}\nreturn typeof handle === 'function' ? handle : null;`);
  const handle = factory();
  if (!handle) {
    throw new Error('Your code must define a function named `handle(request, db)`.');
  }
  return { handle };
}

async function runApiCase(
  code: string,
  test: ApiTestCase,
  deadlineMs: number,
): Promise<{ status: 'pass' | 'fail' | 'timeout' | 'error'; actual?: ApiResponse; durationMs: number; error?: string; logs?: ConsoleLog[] }> {
  let handler: ExtractedHandler;
  try {
    handler = compileHandler(code);
  } catch (err) {
    return { status: 'error', durationMs: 0, error: err instanceof Error ? err.message : String(err) };
  }

  const db = freshDb();
  if (test.setup) test.setup(db);

  const start = performance.now();
  let actual: ApiResponse;
  let capturedLogs: ConsoleLog[] = [];
  try {
    const captured = await withConsoleCaptureAsync(() =>
      Promise.race([
        Promise.resolve().then(() => handler.handle(test.request, db)),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), deadlineMs)),
      ]),
    );
    actual = captured.value;
    capturedLogs = captured.logs;
  } catch (err) {
    const durationMs = performance.now() - start;
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === 'TIMEOUT') return { status: 'timeout', durationMs };
    return { status: 'error', durationMs, error: msg };
  }
  const durationMs = performance.now() - start;

  if (!actual || typeof actual !== 'object' || typeof (actual as ApiResponse).status !== 'number') {
    return { status: 'fail', durationMs, actual, error: 'handler must return { status, body }', logs: capturedLogs };
  }

  if (actual.status !== test.expected.status) {
    return {
      status: 'fail',
      durationMs,
      actual,
      error: `status mismatch: expected ${test.expected.status}, got ${actual.status}`,
      logs: capturedLogs,
    };
  }
  if (test.expected.body !== undefined) {
    if (!deepEqual(actual.body, test.expected.body)) {
      return { status: 'fail', durationMs, actual, error: 'body mismatch', logs: capturedLogs };
    }
  }
  if (test.postCheck) {
    const err = test.postCheck(db);
    if (err) return { status: 'fail', durationMs, actual, error: `post-check failed: ${err}`, logs: capturedLogs };
  }
  return { status: 'pass', durationMs, actual, logs: capturedLogs };
}

async function evaluateApiCorrectness(code: string, cases: ApiTestCase[]): Promise<TestResult[]> {
  const results: TestResult[] = [];
  for (const tc of cases) {
    const resp = await runApiCase(code, tc, 5000);
    results.push({
      name: tc.name,
      status: resp.status,
      durationMs: resp.durationMs,
      actual: resp.actual,
      expected: tc.expected,
      error: resp.error,
      logs: resp.logs,
    });
  }
  return results;
}

async function evaluateApiPerformance(code: string, tests: ApiPerfTest[]): Promise<TestResult[]> {
  const results: TestResult[] = [];
  let handler: ExtractedHandler;
  try {
    handler = compileHandler(code);
  } catch (err) {
    return tests.map(t => ({
      name: t.name,
      status: 'error',
      durationMs: 0,
      error: err instanceof Error ? err.message : String(err),
    }));
  }

  for (const t of tests) {
    const db = freshDb();
    t.setup(db);
    const start = performance.now();
    let resp: ApiResponse;
    let capturedLogs: ConsoleLog[] = [];
    try {
      const captured = await withConsoleCaptureAsync(() =>
        Promise.race([
          Promise.resolve().then(() => handler.handle(t.request, db)),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), Math.max(t.maxDurationMs * 4, 4000))),
        ]),
      );
      resp = captured.value;
      capturedLogs = captured.logs;
    } catch (err) {
      const durationMs = performance.now() - start;
      const msg = err instanceof Error ? err.message : String(err);
      results.push({
        name: t.name,
        status: msg === 'TIMEOUT' ? 'timeout' : 'error',
        durationMs,
        error: msg,
      });
      continue;
    }
    const durationMs = performance.now() - start;
    const validationError = t.validate(resp, db);
    const tooSlow = durationMs > t.maxDurationMs;
    let status: TestResult['status'] = 'pass';
    let error: string | undefined;
    if (validationError) { status = 'fail'; error = validationError; }
    else if (tooSlow) { status = 'fail'; error = `exceeded ${t.maxDurationMs}ms budget`; }
    results.push({ name: t.name, status, durationMs, error, logs: capturedLogs });
  }
  return results;
}

export async function runApiExamples(problem: ApiProblem, code: string): Promise<TestResult[]> {
  return evaluateApiCorrectness(code, problem.exampleTests);
}

export interface ApiSubmitResults {
  correctness: TestResult[];
  performance: TestResult[];
}

export async function runApiSubmit(problem: ApiProblem, code: string): Promise<ApiSubmitResults> {
  const correctness = await evaluateApiCorrectness(code, [
    ...problem.exampleTests,
    ...problem.hiddenCorrectnessTests,
  ]);
  const performance = await evaluateApiPerformance(code, problem.performanceTests);
  return { correctness, performance };
}
