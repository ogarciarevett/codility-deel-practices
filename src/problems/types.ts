// Shared problem types used by JS and SQL problems.

export interface TutorialStep {
  title: string;
  why: string;
  codeAfter: string;
}

export interface JsTestCase {
  name: string;
  input: unknown;
  expected: unknown;
}

export interface JsPerfTest {
  name: string;
  buildInput: () => unknown;
  maxDurationMs: number;
}

export interface JsProblem {
  id: string;
  title: string;
  kind: 'js';
  language: 'javascript';
  expectedComplexity: string;
  statement: string;
  stub: string;
  exampleTests: JsTestCase[];
  hiddenCorrectnessTests: JsTestCase[];
  performanceTests: JsPerfTest[];
  referenceSolution: string;
  tutorial?: { steps: TutorialStep[] };
}

export interface SqlTestCase {
  name: string;
  params: Record<string, string>;
  seed: string;
  expected: Array<Record<string, string | number>>;
}

export interface SqlPerfTest {
  name: string;
  buildSeed: () => string;
  params: Record<string, string>;
  validate: (rows: Array<Record<string, unknown>>) => string | null; // returns error message or null
  maxDurationMs: number;
}

export interface SqlProblem {
  id: string;
  title: string;
  kind: 'sql';
  language: 'sql-postgres';
  statement: string;
  stub: string;
  schemaDDL: string;
  exampleTests: SqlTestCase[];
  hiddenCorrectnessTests: SqlTestCase[];
  performanceTests: SqlPerfTest[];
  referenceSolution: string;
  tutorial?: { steps: TutorialStep[] };
}

// ============================================================================
// API problem types (Express-style endpoint exercises)
// ============================================================================

export interface ProblemFile {
  path: string;
  content: string;
  language: 'javascript' | 'sql' | 'markdown' | 'plaintext';
  readOnly?: boolean;
}

export type ApiMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export interface ApiRequest {
  method: ApiMethod;
  path: string;
  body?: unknown;
  currentUser?: unknown;
}

export interface ApiResponse {
  status: number;
  body?: unknown;
}

export interface ApiDb {
  profiles: Array<Record<string, unknown>>;
  contracts: Array<Record<string, unknown>>;
  jobs: Array<Record<string, unknown>>;
}

export interface ApiTestCase {
  name: string;
  setup?: (db: ApiDb) => void;
  request: ApiRequest;
  expected: ApiResponse;
  postCheck?: (db: ApiDb) => string | null;
}

export interface ApiPerfTest {
  name: string;
  setup: (db: ApiDb) => void;
  request: ApiRequest;
  validate: (response: ApiResponse, db: ApiDb) => string | null;
  maxDurationMs: number;
}

export interface ApiProblem {
  id: string;
  title: string;
  kind: 'api';
  language: 'javascript';
  statement: string;
  files: ProblemFile[];
  entryFile: string;
  exampleTests: ApiTestCase[];
  hiddenCorrectnessTests: ApiTestCase[];
  performanceTests: ApiPerfTest[];
  referenceSolution: string;
  tutorial?: { steps: TutorialStep[] };
}

// Shared schema for all SQL problems in the Deel domain.
export const DEEL_SCHEMA_DDL = `
  CREATE TABLE profiles (
    id SERIAL PRIMARY KEY,
    type TEXT NOT NULL,
    first_name TEXT NOT NULL,
    profession TEXT,
    balance NUMERIC NOT NULL DEFAULT 0
  );
  CREATE TABLE contracts (
    id SERIAL PRIMARY KEY,
    status TEXT NOT NULL,
    client_id INT NOT NULL REFERENCES profiles(id),
    contractor_id INT NOT NULL REFERENCES profiles(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE jobs (
    id SERIAL PRIMARY KEY,
    description TEXT NOT NULL,
    price NUMERIC NOT NULL,
    paid BOOLEAN NOT NULL DEFAULT FALSE,
    payment_date TIMESTAMP,
    contract_id INT NOT NULL REFERENCES contracts(id)
  );
`;
