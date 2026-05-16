import { PGlite } from '@electric-sql/pglite';
import type { SqlProblem, SqlTestCase, SqlPerfTest } from '../problems/types';
import type { TestResult } from './js-runner';

let dbInstance: PGlite | null = null;
let initPromise: Promise<PGlite> | null = null;

async function getDb(): Promise<PGlite> {
  if (dbInstance) return dbInstance;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const db = new PGlite();
    await db.waitReady;
    dbInstance = db;
    return db;
  })();
  return initPromise;
}

async function resetSchema(db: PGlite, ddl: string): Promise<void> {
  await db.exec(`DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;`);
  await db.exec(ddl);
}

function substituteParams(sql: string): { sql: string; paramOrder: string[] } {
  // Convert :name parameters to $1, $2 ... preserving the order encountered.
  const paramOrder: string[] = [];
  const seen = new Map<string, number>();
  const out = sql.replace(/(?<!:):([a-zA-Z_][a-zA-Z0-9_]*)/g, (_match, name: string) => {
    let idx = seen.get(name);
    if (idx === undefined) {
      paramOrder.push(name);
      idx = paramOrder.length;
      seen.set(name, idx);
    }
    return `$${idx}`;
  });
  return { sql: out, paramOrder };
}

function sortRows(rows: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  return [...rows].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

function rowsEqual(actual: Array<Record<string, unknown>>, expected: Array<Record<string, unknown>>): boolean {
  if (actual.length !== expected.length) return false;
  const a = sortRows(actual);
  const e = sortRows(expected);
  for (let i = 0; i < a.length; i++) {
    const ka = Object.keys(a[i]).sort();
    const ke = Object.keys(e[i]).sort();
    if (ka.length !== ke.length) return false;
    for (const k of ka) {
      if (!ke.includes(k)) return false;
      // PGlite returns NUMERIC as string; expected uses string. Compare loosely.
      const av = a[i][k];
      const ev = e[i][k];
      if (String(av) !== String(ev)) return false;
    }
  }
  return true;
}

async function runSqlCase(
  db: PGlite,
  ddl: string,
  seed: string,
  userSql: string,
  params: Record<string, string>,
  deadlineMs: number,
): Promise<{ status: 'pass' | 'fail' | 'timeout' | 'error'; actual?: unknown; durationMs: number; error?: string }> {
  await resetSchema(db, ddl);
  if (seed.trim()) await db.exec(seed);

  const { sql, paramOrder } = substituteParams(userSql);
  const boundParams = paramOrder.map(n => params[n]);

  const start = performance.now();
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve({ status: 'timeout', durationMs: performance.now() - start });
    }, deadlineMs);

    db.query(sql, boundParams)
      .then((result) => {
        clearTimeout(timer);
        const durationMs = performance.now() - start;
        resolve({ status: 'pass', actual: result.rows, durationMs });
      })
      .catch((err) => {
        clearTimeout(timer);
        const durationMs = performance.now() - start;
        const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
        resolve({ status: 'error', durationMs, error: message });
      });
  });
}

async function evaluateSqlCorrectness(
  problem: SqlProblem,
  userSql: string,
  cases: SqlTestCase[],
): Promise<TestResult[]> {
  const db = await getDb();
  const results: TestResult[] = [];
  for (const tc of cases) {
    const resp = await runSqlCase(db, problem.schemaDDL, tc.seed, userSql, tc.params, 5000);
    if (resp.status === 'timeout' || resp.status === 'error') {
      results.push({
        name: tc.name,
        status: resp.status,
        durationMs: resp.durationMs,
        error: resp.error,
        expected: tc.expected,
      });
      continue;
    }
    const actualRows = (resp.actual as Array<Record<string, unknown>>) ?? [];
    const ok = rowsEqual(actualRows, tc.expected as Array<Record<string, unknown>>);
    results.push({
      name: tc.name,
      status: ok ? 'pass' : 'fail',
      durationMs: resp.durationMs,
      actual: actualRows,
      expected: tc.expected,
    });
  }
  return results;
}

async function evaluateSqlPerformance(
  problem: SqlProblem,
  userSql: string,
  tests: SqlPerfTest[],
): Promise<TestResult[]> {
  const db = await getDb();
  const results: TestResult[] = [];
  for (const t of tests) {
    const seed = t.buildSeed();
    const resp = await runSqlCase(db, problem.schemaDDL, seed, userSql, t.params, Math.max(t.maxDurationMs * 4, 6000));
    if (resp.status === 'timeout' || resp.status === 'error') {
      results.push({ name: t.name, status: resp.status, durationMs: resp.durationMs, error: resp.error });
      continue;
    }
    const actualRows = (resp.actual as Array<Record<string, unknown>>) ?? [];
    const validationError = t.validate(actualRows);
    const tooSlow = resp.durationMs > t.maxDurationMs;
    let status: TestResult['status'] = 'pass';
    let error: string | undefined;
    if (validationError) { status = 'fail'; error = validationError; }
    else if (tooSlow) { status = 'fail'; error = `exceeded ${t.maxDurationMs}ms budget`; }
    results.push({ name: t.name, status, durationMs: resp.durationMs, error });
  }
  return results;
}

export async function runSqlExamples(problem: SqlProblem, userSql: string): Promise<TestResult[]> {
  return evaluateSqlCorrectness(problem, userSql, problem.exampleTests);
}

export interface SqlSubmitResults {
  correctness: TestResult[];
  performance: TestResult[];
}

export async function runSqlSubmit(problem: SqlProblem, userSql: string): Promise<SqlSubmitResults> {
  const correctness = await evaluateSqlCorrectness(problem, userSql, [
    ...problem.exampleTests,
    ...problem.hiddenCorrectnessTests,
  ]);
  const performance = await evaluateSqlPerformance(problem, userSql, problem.performanceTests);
  return { correctness, performance };
}
