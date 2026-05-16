import type { ApiProblem, ApiDb } from './types';

// ----- Shared content for the file tree (read-only docs visible per problem) -----

const SAMPLE_DB_FILE = `// db.js — READ ONLY
// The runner constructs a fresh \`db\` object and passes it to your handle().
// Shape of db:
//
//   db.profiles  : Array<{ id, type: 'client'|'contractor', first_name, profession?, balance }>
//   db.contracts : Array<{ id, status: 'new'|'in_progress'|'terminated', client_id, contractor_id }>
//   db.jobs      : Array<{ id, description, price, paid, payment_date, contract_id }>
//
// You can mutate db in-place. The runner re-seeds db per test.

// Example seed used in the "simple case" example test:
const sampleDb = {
  profiles: [
    { id: 1, type: 'client',     first_name: 'Alice', balance: 1000 },
    { id: 2, type: 'contractor', first_name: 'Bob',   profession: 'Programmer', balance: 0 },
    { id: 3, type: 'contractor', first_name: 'Cara',  profession: 'Designer',   balance: 0 },
  ],
  contracts: [
    { id: 1, status: 'in_progress', client_id: 1, contractor_id: 2 },
    { id: 2, status: 'terminated',  client_id: 1, contractor_id: 3 },
  ],
  jobs: [
    { id: 1, description: 'Build login',  price: 200, paid: false, payment_date: null, contract_id: 1 },
    { id: 2, description: 'Redesign nav', price: 150, paid: true,  payment_date: '2024-06-01', contract_id: 1 },
  ],
};`;

// ============================================================================
// 1) GET /contracts/:id  (with ownership check)
// ============================================================================
const getContractById: ApiProblem = {
  id: 'api-get-contract',
  title: 'GET /contracts/:id',
  kind: 'api',
  language: 'javascript',
  statement: `# GET /contracts/:id

Implement the handler so the route returns a contract only if the **currentUser** is either its \`client\` or its \`contractor\`.

## Spec
- \`200\` + body \`{ contract }\` if the user is the client or contractor of the contract.
- \`404\` + body \`{ error: 'not found' }\` if the contract doesn't exist OR the user is not associated with it. **Do NOT leak existence to non-owners** — same 404 for both cases.
- \`401\` + body \`{ error: 'unauthorized' }\` if \`currentUser\` is missing.

\`currentUser\` is supplied by the runner as \`request.currentUser\` and looks like \`{ id: number, type: 'client' | 'contractor' }\`.

Path format: \`/contracts/:id\` where \`:id\` is a positive integer.

Your handler signature (in \`routes.js\`):
\`\`\`js
function handle(request, db) {
  // request: { method, path, body?, currentUser? }
  // db: { profiles, contracts, jobs }
  return { status: 200, body: { ... } };
}
\`\`\`
`,
  files: [
    {
      path: 'routes.js',
      language: 'javascript',
      content: `function handle(request, db) {
  // your code here
}`,
    },
    {
      path: 'db.js',
      language: 'javascript',
      readOnly: true,
      content: SAMPLE_DB_FILE,
    },
    {
      path: 'README.md',
      language: 'markdown',
      readOnly: true,
      content: `# GET /contracts/:id

Return one contract IF currentUser owns it. 404 in every other case (including "exists but not yours" — don't leak).
401 if no currentUser at all.`,
    },
  ],
  entryFile: 'routes.js',
  exampleTests: [
    {
      name: 'client gets their own contract',
      setup: (db: ApiDb) => {
        db.profiles.push({ id: 1, type: 'client', first_name: 'A', balance: 0 });
        db.profiles.push({ id: 2, type: 'contractor', first_name: 'B', balance: 0 });
        db.contracts.push({ id: 5, status: 'in_progress', client_id: 1, contractor_id: 2 });
      },
      request: { method: 'GET', path: '/contracts/5', currentUser: { id: 1, type: 'client' } },
      expected: { status: 200, body: { contract: { id: 5, status: 'in_progress', client_id: 1, contractor_id: 2 } } },
    },
    {
      name: 'contractor gets their own contract',
      setup: (db: ApiDb) => {
        db.profiles.push({ id: 1, type: 'client', first_name: 'A', balance: 0 });
        db.profiles.push({ id: 2, type: 'contractor', first_name: 'B', balance: 0 });
        db.contracts.push({ id: 5, status: 'in_progress', client_id: 1, contractor_id: 2 });
      },
      request: { method: 'GET', path: '/contracts/5', currentUser: { id: 2, type: 'contractor' } },
      expected: { status: 200, body: { contract: { id: 5, status: 'in_progress', client_id: 1, contractor_id: 2 } } },
    },
    {
      name: 'no currentUser → 401',
      setup: (db: ApiDb) => {
        db.contracts.push({ id: 5, status: 'in_progress', client_id: 1, contractor_id: 2 });
      },
      request: { method: 'GET', path: '/contracts/5' },
      expected: { status: 401, body: { error: 'unauthorized' } },
    },
  ],
  hiddenCorrectnessTests: [
    {
      name: 'not-found contract → 404',
      setup: () => { /* empty db */ },
      request: { method: 'GET', path: '/contracts/999', currentUser: { id: 1, type: 'client' } },
      expected: { status: 404, body: { error: 'not found' } },
    },
    {
      name: 'exists but not yours → 404 (no leak)',
      setup: (db: ApiDb) => {
        db.contracts.push({ id: 5, status: 'in_progress', client_id: 1, contractor_id: 2 });
      },
      request: { method: 'GET', path: '/contracts/5', currentUser: { id: 99, type: 'client' } },
      expected: { status: 404, body: { error: 'not found' } },
    },
    {
      name: 'contractor of unrelated contract → 404',
      setup: (db: ApiDb) => {
        db.contracts.push({ id: 5, status: 'in_progress', client_id: 1, contractor_id: 2 });
      },
      request: { method: 'GET', path: '/contracts/5', currentUser: { id: 99, type: 'contractor' } },
      expected: { status: 404, body: { error: 'not found' } },
    },
    {
      name: 'terminated contracts still returned to their owner',
      setup: (db: ApiDb) => {
        db.contracts.push({ id: 5, status: 'terminated', client_id: 1, contractor_id: 2 });
      },
      request: { method: 'GET', path: '/contracts/5', currentUser: { id: 1, type: 'client' } },
      expected: { status: 200, body: { contract: { id: 5, status: 'terminated', client_id: 1, contractor_id: 2 } } },
    },
    {
      name: 'numeric id parsed from path',
      setup: (db: ApiDb) => {
        db.contracts.push({ id: 42, status: 'in_progress', client_id: 1, contractor_id: 2 });
      },
      request: { method: 'GET', path: '/contracts/42', currentUser: { id: 1, type: 'client' } },
      expected: { status: 200, body: { contract: { id: 42, status: 'in_progress', client_id: 1, contractor_id: 2 } } },
    },
  ],
  performanceTests: [
    {
      name: '10k contracts lookup',
      setup: (db: ApiDb) => {
        for (let i = 1; i <= 10_000; i++) {
          db.contracts.push({ id: i, status: 'in_progress', client_id: (i % 100) + 1, contractor_id: ((i + 1) % 100) + 1 });
        }
      },
      request: { method: 'GET', path: '/contracts/9999', currentUser: { id: ((9999 % 100) + 1), type: 'client' } },
      validate: (resp) => {
        if (resp.status !== 200) return `expected 200, got ${resp.status}`;
        return null;
      },
      maxDurationMs: 50,
    },
  ],
  referenceSolution: `function handle(request, db) {
  if (!request.currentUser) return { status: 401, body: { error: 'unauthorized' } };
  const m = request.path.match(/^\\/contracts\\/(\\d+)$/);
  if (!m) return { status: 404, body: { error: 'not found' } };
  const id = Number(m[1]);
  const contract = db.contracts.find(c => c.id === id);
  if (!contract) return { status: 404, body: { error: 'not found' } };
  const u = request.currentUser;
  const owns = (u.type === 'client' && contract.client_id === u.id)
            || (u.type === 'contractor' && contract.contractor_id === u.id);
  if (!owns) return { status: 404, body: { error: 'not found' } };
  return { status: 200, body: { contract } };
}`,
};

// ============================================================================
// 2) GET /jobs/unpaid
// ============================================================================
const getUnpaidJobs: ApiProblem = {
  id: 'api-unpaid-jobs',
  title: 'GET /jobs/unpaid',
  kind: 'api',
  language: 'javascript',
  statement: `# GET /jobs/unpaid

Return all **unpaid jobs** that belong to **in_progress** contracts of the current user.

## Spec
- \`200\` + body \`{ jobs: Array<Job> }\` on success.
- \`401\` if no currentUser.
- A job is included only if:
  - \`paid === false\`, AND
  - the job's \`contract.status === 'in_progress'\`, AND
  - the user is on that contract (either client or contractor).

Order: by ascending \`job.id\`.
`,
  files: [
    {
      path: 'routes.js',
      language: 'javascript',
      content: `function handle(request, db) {
  // your code here
}`,
    },
    {
      path: 'db.js',
      language: 'javascript',
      readOnly: true,
      content: SAMPLE_DB_FILE,
    },
    {
      path: 'README.md',
      language: 'markdown',
      readOnly: true,
      content: `# GET /jobs/unpaid

Unpaid jobs from in_progress contracts of current user. Sorted by job.id asc.`,
    },
  ],
  entryFile: 'routes.js',
  exampleTests: [
    {
      name: 'client sees their unpaid jobs',
      setup: (db: ApiDb) => {
        db.contracts.push({ id: 1, status: 'in_progress', client_id: 1, contractor_id: 2 });
        db.jobs.push({ id: 10, description: 'a', price: 100, paid: false, payment_date: null, contract_id: 1 });
        db.jobs.push({ id: 11, description: 'b', price: 200, paid: true, payment_date: '2024-01-01', contract_id: 1 });
      },
      request: { method: 'GET', path: '/jobs/unpaid', currentUser: { id: 1, type: 'client' } },
      expected: { status: 200, body: { jobs: [{ id: 10, description: 'a', price: 100, paid: false, payment_date: null, contract_id: 1 }] } },
    },
    {
      name: 'terminated contract → excluded',
      setup: (db: ApiDb) => {
        db.contracts.push({ id: 1, status: 'terminated', client_id: 1, contractor_id: 2 });
        db.jobs.push({ id: 10, description: 'a', price: 100, paid: false, payment_date: null, contract_id: 1 });
      },
      request: { method: 'GET', path: '/jobs/unpaid', currentUser: { id: 1, type: 'client' } },
      expected: { status: 200, body: { jobs: [] } },
    },
    {
      name: 'no auth → 401',
      setup: () => { /* */ },
      request: { method: 'GET', path: '/jobs/unpaid' },
      expected: { status: 401, body: { error: 'unauthorized' } },
    },
  ],
  hiddenCorrectnessTests: [
    {
      name: 'contractor view sees their unpaid jobs',
      setup: (db: ApiDb) => {
        db.contracts.push({ id: 1, status: 'in_progress', client_id: 1, contractor_id: 2 });
        db.jobs.push({ id: 10, description: 'a', price: 100, paid: false, payment_date: null, contract_id: 1 });
      },
      request: { method: 'GET', path: '/jobs/unpaid', currentUser: { id: 2, type: 'contractor' } },
      expected: { status: 200, body: { jobs: [{ id: 10, description: 'a', price: 100, paid: false, payment_date: null, contract_id: 1 }] } },
    },
    {
      name: 'others contracts → excluded',
      setup: (db: ApiDb) => {
        db.contracts.push({ id: 1, status: 'in_progress', client_id: 99, contractor_id: 2 });
        db.jobs.push({ id: 10, description: 'a', price: 100, paid: false, payment_date: null, contract_id: 1 });
      },
      request: { method: 'GET', path: '/jobs/unpaid', currentUser: { id: 1, type: 'client' } },
      expected: { status: 200, body: { jobs: [] } },
    },
    {
      name: 'sorted by id asc',
      setup: (db: ApiDb) => {
        db.contracts.push({ id: 1, status: 'in_progress', client_id: 1, contractor_id: 2 });
        db.jobs.push({ id: 30, description: 'c', price: 30, paid: false, payment_date: null, contract_id: 1 });
        db.jobs.push({ id: 10, description: 'a', price: 10, paid: false, payment_date: null, contract_id: 1 });
        db.jobs.push({ id: 20, description: 'b', price: 20, paid: false, payment_date: null, contract_id: 1 });
      },
      request: { method: 'GET', path: '/jobs/unpaid', currentUser: { id: 1, type: 'client' } },
      expected: {
        status: 200,
        body: { jobs: [
          { id: 10, description: 'a', price: 10, paid: false, payment_date: null, contract_id: 1 },
          { id: 20, description: 'b', price: 20, paid: false, payment_date: null, contract_id: 1 },
          { id: 30, description: 'c', price: 30, paid: false, payment_date: null, contract_id: 1 },
        ] },
      },
    },
    {
      name: 'empty result',
      setup: () => { /* */ },
      request: { method: 'GET', path: '/jobs/unpaid', currentUser: { id: 1, type: 'client' } },
      expected: { status: 200, body: { jobs: [] } },
    },
    {
      name: 'new (not in_progress) contract → excluded',
      setup: (db: ApiDb) => {
        db.contracts.push({ id: 1, status: 'new', client_id: 1, contractor_id: 2 });
        db.jobs.push({ id: 10, description: 'a', price: 100, paid: false, payment_date: null, contract_id: 1 });
      },
      request: { method: 'GET', path: '/jobs/unpaid', currentUser: { id: 1, type: 'client' } },
      expected: { status: 200, body: { jobs: [] } },
    },
  ],
  performanceTests: [
    {
      name: '10k jobs / 5k contracts',
      setup: (db: ApiDb) => {
        for (let i = 1; i <= 5000; i++) {
          db.contracts.push({ id: i, status: i % 2 ? 'in_progress' : 'terminated', client_id: 1, contractor_id: 2 });
        }
        for (let i = 1; i <= 10_000; i++) {
          db.jobs.push({ id: i, description: `j${i}`, price: 10, paid: i % 3 === 0, payment_date: null, contract_id: 1 + (i % 5000) });
        }
      },
      request: { method: 'GET', path: '/jobs/unpaid', currentUser: { id: 1, type: 'client' } },
      validate: (resp) => {
        if (resp.status !== 200) return `expected 200, got ${resp.status}`;
        const body = resp.body as { jobs?: unknown[] };
        if (!Array.isArray(body?.jobs)) return 'body.jobs not array';
        return null;
      },
      maxDurationMs: 100,
    },
  ],
  referenceSolution: `function handle(request, db) {
  if (!request.currentUser) return { status: 401, body: { error: 'unauthorized' } };
  if (request.path !== '/jobs/unpaid' || request.method !== 'GET') {
    return { status: 404, body: { error: 'not found' } };
  }
  const u = request.currentUser;
  const myContractIds = new Set(
    db.contracts
      .filter(c => c.status === 'in_progress')
      .filter(c => (u.type === 'client' && c.client_id === u.id) || (u.type === 'contractor' && c.contractor_id === u.id))
      .map(c => c.id)
  );
  const jobs = db.jobs
    .filter(j => !j.paid && myContractIds.has(j.contract_id))
    .sort((a, b) => a.id - b.id);
  return { status: 200, body: { jobs } };
}`,
};

// ============================================================================
// 3) POST /jobs/:id/pay  (atomic balance transfer)
// ============================================================================
const payJob: ApiProblem = {
  id: 'api-pay-job',
  title: 'POST /jobs/:id/pay',
  kind: 'api',
  language: 'javascript',
  statement: `# POST /jobs/:id/pay

Pay a job. Transfer money from the client's balance to the contractor's balance, mark the job as paid, and set its \`payment_date\`.

## Spec
- \`200\` + body \`{ job }\` on success.
- \`401\` if no currentUser.
- \`401\` + body \`{ error: 'forbidden' }\` if currentUser is **not the client** of the job's contract. (Only clients can pay.)
- \`404\` + body \`{ error: 'not found' }\` if job doesn't exist.
- \`400\` + body \`{ error: 'already paid' }\` if job.paid is already true.
- \`400\` + body \`{ error: 'insufficient funds' }\` if client.balance < job.price.

## Atomicity
If the payment cannot proceed (any error path), **no balance must change** and the job must stay unpaid.

## Side effects on success
- \`client.balance -= job.price\`
- \`contractor.balance += job.price\`
- \`job.paid = true\`
- \`job.payment_date = request.body.now || new Date().toISOString()\` (the runner passes a fixed timestamp in \`body.now\` for deterministic tests).
`,
  files: [
    {
      path: 'routes.js',
      language: 'javascript',
      content: `function handle(request, db) {
  // your code here
}`,
    },
    {
      path: 'db.js',
      language: 'javascript',
      readOnly: true,
      content: SAMPLE_DB_FILE,
    },
    {
      path: 'README.md',
      language: 'markdown',
      readOnly: true,
      content: `# POST /jobs/:id/pay

Atomic transfer. Validate ALL preconditions BEFORE mutating state.
Order of checks suggested:
  1. currentUser exists?  → 401 unauthorized
  2. parse job id, find job → 404 not found
  3. find contract → 404
  4. currentUser is the client of that contract → 401 forbidden
  5. !job.paid → 400 already paid
  6. client.balance >= job.price → 400 insufficient funds
  7. perform transfer (mutate balances + job)`,
    },
  ],
  entryFile: 'routes.js',
  exampleTests: [
    {
      name: 'happy path',
      setup: (db: ApiDb) => {
        db.profiles.push({ id: 1, type: 'client', first_name: 'A', balance: 500 });
        db.profiles.push({ id: 2, type: 'contractor', first_name: 'B', balance: 0 });
        db.contracts.push({ id: 10, status: 'in_progress', client_id: 1, contractor_id: 2 });
        db.jobs.push({ id: 100, description: 'j', price: 200, paid: false, payment_date: null, contract_id: 10 });
      },
      request: { method: 'POST', path: '/jobs/100/pay', body: { now: '2024-06-01T00:00:00Z' }, currentUser: { id: 1, type: 'client' } },
      expected: {
        status: 200,
        body: { job: { id: 100, description: 'j', price: 200, paid: true, payment_date: '2024-06-01T00:00:00Z', contract_id: 10 } },
      },
      postCheck: (db) => {
        const client = db.profiles.find(p => p.id === 1);
        const contractor = db.profiles.find(p => p.id === 2);
        if (client?.balance !== 300) return `client balance expected 300, got ${client?.balance}`;
        if (contractor?.balance !== 200) return `contractor balance expected 200, got ${contractor?.balance}`;
        return null;
      },
    },
    {
      name: 'insufficient funds → 400, balances unchanged',
      setup: (db: ApiDb) => {
        db.profiles.push({ id: 1, type: 'client', first_name: 'A', balance: 50 });
        db.profiles.push({ id: 2, type: 'contractor', first_name: 'B', balance: 0 });
        db.contracts.push({ id: 10, status: 'in_progress', client_id: 1, contractor_id: 2 });
        db.jobs.push({ id: 100, description: 'j', price: 200, paid: false, payment_date: null, contract_id: 10 });
      },
      request: { method: 'POST', path: '/jobs/100/pay', body: { now: 't' }, currentUser: { id: 1, type: 'client' } },
      expected: { status: 400, body: { error: 'insufficient funds' } },
      postCheck: (db) => {
        const client = db.profiles.find(p => p.id === 1);
        const contractor = db.profiles.find(p => p.id === 2);
        const job = db.jobs.find(j => j.id === 100);
        if (client?.balance !== 50) return `client balance changed: ${client?.balance}`;
        if (contractor?.balance !== 0) return `contractor balance changed: ${contractor?.balance}`;
        if (job?.paid) return 'job became paid';
        return null;
      },
    },
    {
      name: 'no currentUser → 401',
      setup: (db: ApiDb) => {
        db.jobs.push({ id: 100, description: 'j', price: 10, paid: false, payment_date: null, contract_id: 1 });
      },
      request: { method: 'POST', path: '/jobs/100/pay', body: { now: 't' } },
      expected: { status: 401, body: { error: 'unauthorized' } },
    },
  ],
  hiddenCorrectnessTests: [
    {
      name: 'contractor cannot pay → 401 forbidden',
      setup: (db: ApiDb) => {
        db.profiles.push({ id: 1, type: 'client', first_name: 'A', balance: 500 });
        db.profiles.push({ id: 2, type: 'contractor', first_name: 'B', balance: 0 });
        db.contracts.push({ id: 10, status: 'in_progress', client_id: 1, contractor_id: 2 });
        db.jobs.push({ id: 100, description: 'j', price: 10, paid: false, payment_date: null, contract_id: 10 });
      },
      request: { method: 'POST', path: '/jobs/100/pay', body: { now: 't' }, currentUser: { id: 2, type: 'contractor' } },
      expected: { status: 401, body: { error: 'forbidden' } },
      postCheck: (db) => {
        const job = db.jobs.find(j => j.id === 100);
        return job?.paid ? 'job became paid by contractor' : null;
      },
    },
    {
      name: 'job not found → 404',
      setup: () => { /* */ },
      request: { method: 'POST', path: '/jobs/999/pay', body: { now: 't' }, currentUser: { id: 1, type: 'client' } },
      expected: { status: 404, body: { error: 'not found' } },
    },
    {
      name: 'already paid → 400 already paid',
      setup: (db: ApiDb) => {
        db.profiles.push({ id: 1, type: 'client', first_name: 'A', balance: 500 });
        db.profiles.push({ id: 2, type: 'contractor', first_name: 'B', balance: 0 });
        db.contracts.push({ id: 10, status: 'in_progress', client_id: 1, contractor_id: 2 });
        db.jobs.push({ id: 100, description: 'j', price: 200, paid: true, payment_date: '2024-01-01', contract_id: 10 });
      },
      request: { method: 'POST', path: '/jobs/100/pay', body: { now: 't' }, currentUser: { id: 1, type: 'client' } },
      expected: { status: 400, body: { error: 'already paid' } },
      postCheck: (db) => {
        const client = db.profiles.find(p => p.id === 1);
        return client?.balance !== 500 ? `client balance changed: ${client?.balance}` : null;
      },
    },
    {
      name: 'different client (not owner) → 401 forbidden',
      setup: (db: ApiDb) => {
        db.profiles.push({ id: 1, type: 'client', first_name: 'A', balance: 500 });
        db.profiles.push({ id: 99, type: 'client', first_name: 'Z', balance: 9999 });
        db.profiles.push({ id: 2, type: 'contractor', first_name: 'B', balance: 0 });
        db.contracts.push({ id: 10, status: 'in_progress', client_id: 1, contractor_id: 2 });
        db.jobs.push({ id: 100, description: 'j', price: 100, paid: false, payment_date: null, contract_id: 10 });
      },
      request: { method: 'POST', path: '/jobs/100/pay', body: { now: 't' }, currentUser: { id: 99, type: 'client' } },
      expected: { status: 401, body: { error: 'forbidden' } },
    },
    {
      name: 'exact-balance payment succeeds',
      setup: (db: ApiDb) => {
        db.profiles.push({ id: 1, type: 'client', first_name: 'A', balance: 100 });
        db.profiles.push({ id: 2, type: 'contractor', first_name: 'B', balance: 0 });
        db.contracts.push({ id: 10, status: 'in_progress', client_id: 1, contractor_id: 2 });
        db.jobs.push({ id: 100, description: 'j', price: 100, paid: false, payment_date: null, contract_id: 10 });
      },
      request: { method: 'POST', path: '/jobs/100/pay', body: { now: 'T' }, currentUser: { id: 1, type: 'client' } },
      expected: {
        status: 200,
        body: { job: { id: 100, description: 'j', price: 100, paid: true, payment_date: 'T', contract_id: 10 } },
      },
      postCheck: (db) => {
        const client = db.profiles.find(p => p.id === 1);
        return client?.balance !== 0 ? `expected 0, got ${client?.balance}` : null;
      },
    },
  ],
  performanceTests: [
    {
      name: '10k profiles / 10k jobs',
      setup: (db: ApiDb) => {
        for (let i = 1; i <= 10_000; i++) {
          db.profiles.push({ id: i, type: i % 2 ? 'client' : 'contractor', first_name: `p${i}`, balance: 10_000 });
        }
        for (let i = 1; i <= 5_000; i++) {
          db.contracts.push({ id: i, status: 'in_progress', client_id: 2 * i - 1, contractor_id: 2 * i });
        }
        for (let i = 1; i <= 10_000; i++) {
          db.jobs.push({ id: i, description: `j${i}`, price: 10, paid: false, payment_date: null, contract_id: 1 + (i % 5000) });
        }
      },
      request: { method: 'POST', path: '/jobs/9999/pay', body: { now: 'T' }, currentUser: { id: 2 * (1 + (9999 % 5000)) - 1, type: 'client' } },
      validate: (resp) => {
        if (resp.status !== 200) return `expected 200, got ${resp.status}`;
        return null;
      },
      maxDurationMs: 50,
    },
  ],
  referenceSolution: `function handle(request, db) {
  if (!request.currentUser) return { status: 401, body: { error: 'unauthorized' } };
  const m = request.path.match(/^\\/jobs\\/(\\d+)\\/pay$/);
  if (!m || request.method !== 'POST') return { status: 404, body: { error: 'not found' } };
  const id = Number(m[1]);
  const job = db.jobs.find(j => j.id === id);
  if (!job) return { status: 404, body: { error: 'not found' } };
  const contract = db.contracts.find(c => c.id === job.contract_id);
  if (!contract) return { status: 404, body: { error: 'not found' } };
  const u = request.currentUser;
  if (!(u.type === 'client' && contract.client_id === u.id)) {
    return { status: 401, body: { error: 'forbidden' } };
  }
  if (job.paid) return { status: 400, body: { error: 'already paid' } };
  const client = db.profiles.find(p => p.id === contract.client_id);
  const contractor = db.profiles.find(p => p.id === contract.contractor_id);
  if (!client || !contractor) return { status: 404, body: { error: 'not found' } };
  if (client.balance < job.price) {
    return { status: 400, body: { error: 'insufficient funds' } };
  }
  // All checks passed → mutate atomically.
  client.balance -= job.price;
  contractor.balance += job.price;
  job.paid = true;
  job.payment_date = (request.body && request.body.now) || new Date().toISOString();
  return { status: 200, body: { job } };
}`,
};

export const extraApiProblems: ApiProblem[] = [
  getContractById,
  getUnpaidJobs,
  payJob,
];
