// Web Worker — evaluates user code against an input, captures console.* output.

interface WorkerRequest {
  code: string;
  input: unknown;
}

export type LogLevel = 'log' | 'warn' | 'error' | 'info';
export interface ConsoleLog {
  level: LogLevel;
  text: string;
}

interface WorkerResponse {
  status: 'pass' | 'fail' | 'error';
  actual?: unknown;
  durationMs: number;
  error?: string;
  logs: ConsoleLog[];
}

const MAX_LOGS = 200;
const MAX_LOG_LEN = 500;

function serializeArg(v: unknown): string {
  if (v === null) return 'null';
  if (v === undefined) return 'undefined';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'bigint') return String(v);
  if (typeof v === 'function') return `[Function ${(v as { name?: string }).name || 'anonymous'}]`;
  try {
    const seen = new WeakSet();
    return JSON.stringify(v, (_k, val) => {
      if (typeof val === 'object' && val !== null) {
        if (seen.has(val)) return '[Circular]';
        seen.add(val);
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

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const { code, input } = event.data;
  const logs: ConsoleLog[] = [];
  let dropped = 0;
  const push = (level: LogLevel, args: unknown[]) => {
    if (logs.length >= MAX_LOGS) { dropped++; return; }
    logs.push({ level, text: formatArgs(args) });
  };

  const origConsole = {
    log: console.log, warn: console.warn, error: console.error, info: console.info,
  };
  console.log = (...args) => push('log', args);
  console.warn = (...args) => push('warn', args);
  console.error = (...args) => push('error', args);
  console.info = (...args) => push('info', args);

  const start = performance.now();
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const fn = new Function('input', `${code}\nreturn solution(input);`);
    const actual = fn(input);
    const durationMs = performance.now() - start;
    if (dropped > 0) logs.push({ level: 'warn', text: `(+${dropped} more logs dropped — exceeded ${MAX_LOGS} cap)` });
    const response: WorkerResponse = { status: 'pass', actual, durationMs, logs };
    (self as unknown as Worker).postMessage(response);
  } catch (err) {
    const durationMs = performance.now() - start;
    const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    if (dropped > 0) logs.push({ level: 'warn', text: `(+${dropped} more logs dropped — exceeded ${MAX_LOGS} cap)` });
    const response: WorkerResponse = { status: 'error', durationMs, error: message, logs };
    (self as unknown as Worker).postMessage(response);
  } finally {
    console.log = origConsole.log;
    console.warn = origConsole.warn;
    console.error = origConsole.error;
    console.info = origConsole.info;
  }
};

export {};
