import type { JsProblem } from './types';
import { makeRng } from '../lib/generators';

// ============================================================================
// 1) TIME TRACKER
// ============================================================================
//   Given clock_in/clock_out events for contractors, compute total hours each
//   contractor worked. Open (no matching clock_out) sessions are discarded.

const timeTracker: JsProblem = {
  id: 'time-tracker',
  title: 'Time Tracker',
  kind: 'js',
  language: 'javascript',
  expectedComplexity: 'O(N)',
  statement: `# Time Tracker

You receive a chronologically-ordered stream of clock events for contractors at Deel:

\`\`\`
{ type: 'CLOCK_IN',  contractorId: string, ts: number }   // ts is a unix millis epoch
{ type: 'CLOCK_OUT', contractorId: string, ts: number }
\`\`\`

Implement \`solution(events)\` returning an object mapping each contractor's id to the **total milliseconds they worked**, computed as the sum of all (clock_out.ts − matching_clock_in.ts) deltas.

## Rules
- A \`CLOCK_OUT\` matches the **most recent unmatched** \`CLOCK_IN\` for the same contractor.
- An unmatched \`CLOCK_OUT\` (no prior CLOCK_IN, or the contractor already clocked out) is **ignored**.
- An unmatched \`CLOCK_IN\` at end-of-stream is **discarded** — that shift never closed.
- A contractor with zero closed sessions should **not** appear in the output.

## Constraints
- 0 <= N <= 100,000
- contractor ids are strings, length <= 16
`,
  stub: `function solution(events) {
  // your code here
}`,
  exampleTests: [
    {
      name: 'one closed session',
      input: [
        { type: 'CLOCK_IN', contractorId: 'c1', ts: 1000 },
        { type: 'CLOCK_OUT', contractorId: 'c1', ts: 4000 },
      ],
      expected: { c1: 3000 },
    },
    {
      name: 'two contractors, multiple sessions',
      input: [
        { type: 'CLOCK_IN', contractorId: 'cA', ts: 0 },
        { type: 'CLOCK_OUT', contractorId: 'cA', ts: 100 },
        { type: 'CLOCK_IN', contractorId: 'cB', ts: 50 },
        { type: 'CLOCK_OUT', contractorId: 'cB', ts: 250 },
        { type: 'CLOCK_IN', contractorId: 'cA', ts: 300 },
        { type: 'CLOCK_OUT', contractorId: 'cA', ts: 350 },
      ],
      expected: { cA: 150, cB: 200 },
    },
    {
      name: 'orphan clock_out ignored, orphan clock_in discarded',
      input: [
        { type: 'CLOCK_OUT', contractorId: 'c1', ts: 100 },
        { type: 'CLOCK_IN', contractorId: 'c1', ts: 200 },
      ],
      expected: {},
    },
  ],
  hiddenCorrectnessTests: [
    {
      name: 'empty stream',
      input: [],
      expected: {},
    },
    {
      name: 'second clock_in before matching clock_out is a no-op',
      input: [
        { type: 'CLOCK_IN', contractorId: 'c1', ts: 0 },
        { type: 'CLOCK_IN', contractorId: 'c1', ts: 100 },
        { type: 'CLOCK_OUT', contractorId: 'c1', ts: 500 },
      ],
      expected: { c1: 500 },
    },
    {
      name: 'duplicate clock_out is ignored',
      input: [
        { type: 'CLOCK_IN', contractorId: 'c1', ts: 0 },
        { type: 'CLOCK_OUT', contractorId: 'c1', ts: 100 },
        { type: 'CLOCK_OUT', contractorId: 'c1', ts: 200 },
      ],
      expected: { c1: 100 },
    },
    {
      name: 'contractor never closes a session',
      input: [
        { type: 'CLOCK_IN', contractorId: 'cA', ts: 0 },
        { type: 'CLOCK_IN', contractorId: 'cB', ts: 10 },
        { type: 'CLOCK_OUT', contractorId: 'cB', ts: 20 },
      ],
      expected: { cB: 10 },
    },
    {
      name: 'zero-duration session still counts',
      input: [
        { type: 'CLOCK_IN', contractorId: 'c1', ts: 1000 },
        { type: 'CLOCK_OUT', contractorId: 'c1', ts: 1000 },
      ],
      expected: { c1: 0 },
    },
  ],
  performanceTests: [
    {
      name: '100k mixed clock events',
      buildInput: () => {
        const rng = makeRng(42);
        const events: Array<{ type: string; contractorId: string; ts: number }> = [];
        const open = new Map<string, boolean>();
        let ts = 1_700_000_000_000;
        for (let i = 0; i < 100_000; i++) {
          ts += Math.floor(rng() * 3600 * 1000);
          const cid = `c${Math.floor(rng() * 1000)}`;
          if (open.get(cid)) {
            events.push({ type: 'CLOCK_OUT', contractorId: cid, ts });
            open.set(cid, false);
          } else {
            events.push({ type: 'CLOCK_IN', contractorId: cid, ts });
            open.set(cid, true);
          }
        }
        return events;
      },
      maxDurationMs: 800,
    },
  ],
  referenceSolution: `function solution(events) {
  const open = new Map();   // contractorId -> last unmatched clock_in ts
  const totals = new Map();  // contractorId -> total ms

  for (const e of events) {
    if (e.type === 'CLOCK_IN') {
      if (!open.has(e.contractorId)) {
        open.set(e.contractorId, e.ts);
      }
    } else if (e.type === 'CLOCK_OUT') {
      const start = open.get(e.contractorId);
      if (start !== undefined) {
        totals.set(e.contractorId, (totals.get(e.contractorId) || 0) + (e.ts - start));
        open.delete(e.contractorId);
      }
    }
  }
  return Object.fromEntries(totals);
}`,
};

// ============================================================================
// 2) SUBSCRIPTION MRR
// ============================================================================

const subscriptionMrr: JsProblem = {
  id: 'subscription-mrr',
  title: 'Subscription MRR',
  kind: 'js',
  language: 'javascript',
  expectedComplexity: 'O(N)',
  statement: `# Subscription MRR

You receive a chronologically-ordered stream of subscription events:

\`\`\`
{ type: 'SUB_CREATED',   subId: string, plan: number }   // plan = monthly $ amount
{ type: 'SUB_UPGRADED',  subId: string, plan: number }   // new monthly $ amount
{ type: 'SUB_DOWNGRADED', subId: string, plan: number }
{ type: 'SUB_CANCELLED', subId: string }
\`\`\`

Implement \`solution(events)\` returning the **current Monthly Recurring Revenue (MRR)** — the sum of \`plan\` values across all subscriptions that are currently active at the end of the stream.

## Rules
- A subscription starts at the plan from its \`SUB_CREATED\`.
- \`SUB_UPGRADED\` / \`SUB_DOWNGRADED\` overwrite the plan amount.
- \`SUB_CANCELLED\` removes the subscription from MRR.
- Events for unknown \`subId\`s (no prior CREATED) are **ignored**.
- A second \`SUB_CREATED\` for the same id is **ignored** (first wins).

## Constraints
- 0 <= N <= 100,000
- plan is an integer in [1, 10_000]
`,
  stub: `function solution(events) {
  // your code here
}`,
  exampleTests: [
    {
      name: 'simple',
      input: [
        { type: 'SUB_CREATED', subId: 's1', plan: 100 },
        { type: 'SUB_CREATED', subId: 's2', plan: 50 },
      ],
      expected: 150,
    },
    {
      name: 'upgrade then cancel',
      input: [
        { type: 'SUB_CREATED', subId: 's1', plan: 100 },
        { type: 'SUB_UPGRADED', subId: 's1', plan: 200 },
        { type: 'SUB_CANCELLED', subId: 's1' },
      ],
      expected: 0,
    },
    {
      name: 'empty stream',
      input: [],
      expected: 0,
    },
  ],
  hiddenCorrectnessTests: [
    {
      name: 'upgrade after downgrade',
      input: [
        { type: 'SUB_CREATED', subId: 's1', plan: 100 },
        { type: 'SUB_DOWNGRADED', subId: 's1', plan: 50 },
        { type: 'SUB_UPGRADED', subId: 's1', plan: 300 },
      ],
      expected: 300,
    },
    {
      name: 'cancel of unknown sub is ignored',
      input: [
        { type: 'SUB_CANCELLED', subId: 'never-existed' },
        { type: 'SUB_CREATED', subId: 's1', plan: 75 },
      ],
      expected: 75,
    },
    {
      name: 'upgrade of unknown sub is ignored',
      input: [
        { type: 'SUB_UPGRADED', subId: 'ghost', plan: 999 },
      ],
      expected: 0,
    },
    {
      name: 'duplicate created keeps first plan',
      input: [
        { type: 'SUB_CREATED', subId: 's1', plan: 100 },
        { type: 'SUB_CREATED', subId: 's1', plan: 9999 },
      ],
      expected: 100,
    },
    {
      name: 'cancel then re-create stays cancelled',
      input: [
        { type: 'SUB_CREATED', subId: 's1', plan: 100 },
        { type: 'SUB_CANCELLED', subId: 's1' },
        { type: 'SUB_CREATED', subId: 's1', plan: 500 },
      ],
      expected: 0,
    },
  ],
  performanceTests: [
    {
      name: '100k mixed events',
      buildInput: () => {
        const rng = makeRng(7);
        const events: Array<Record<string, unknown>> = [];
        const created = new Set<string>();
        const cancelled = new Set<string>();
        for (let i = 0; i < 100_000; i++) {
          const r = rng();
          if (r < 0.4 || created.size === 0) {
            const id = `s${i}`;
            created.add(id);
            events.push({ type: 'SUB_CREATED', subId: id, plan: 10 + Math.floor(rng() * 990) });
          } else {
            const arr = [...created];
            const id = arr[Math.floor(rng() * arr.length)];
            if (cancelled.has(id)) { events.push({ type: 'SUB_CREATED', subId: `s${i}`, plan: 100 }); continue; }
            if (r < 0.65) events.push({ type: 'SUB_UPGRADED', subId: id, plan: 10 + Math.floor(rng() * 990) });
            else if (r < 0.85) events.push({ type: 'SUB_DOWNGRADED', subId: id, plan: 10 + Math.floor(rng() * 990) });
            else { events.push({ type: 'SUB_CANCELLED', subId: id }); cancelled.add(id); }
          }
        }
        return events;
      },
      maxDurationMs: 800,
    },
  ],
  referenceSolution: `function solution(events) {
  const subs = new Map();    // subId -> current plan
  const cancelled = new Set();
  for (const e of events) {
    if (e.type === 'SUB_CREATED') {
      if (!subs.has(e.subId) && !cancelled.has(e.subId)) {
        subs.set(e.subId, e.plan);
      }
    } else if (e.type === 'SUB_UPGRADED' || e.type === 'SUB_DOWNGRADED') {
      if (subs.has(e.subId)) subs.set(e.subId, e.plan);
    } else if (e.type === 'SUB_CANCELLED') {
      if (subs.has(e.subId)) {
        subs.delete(e.subId);
        cancelled.add(e.subId);
      }
    }
  }
  let mrr = 0;
  for (const plan of subs.values()) mrr += plan;
  return mrr;
}`,
};

// ============================================================================
// 3) IDEMPOTENT PAYMENTS
// ============================================================================

const idempotentPayments: JsProblem = {
  id: 'idempotent-payments',
  title: 'Idempotent Payments',
  kind: 'js',
  language: 'javascript',
  expectedComplexity: 'O(N)',
  statement: `# Idempotent Payments

A payment processor sometimes retries the same charge. Each event has a \`requestId\` — if you see the same \`requestId\` twice, the **second event is a retry and must NOT be counted again**.

\`\`\`
{ requestId: string, amount: number, currency: string }
\`\`\`

Implement \`solution(payments)\` returning an object mapping each currency to the **total of unique amounts** in that currency.

## Rules
- Dedup by \`requestId\` globally (across currencies — same \`requestId\` in different currencies is impossible per spec, so just dedup).
- Currencies are 3-letter uppercase strings (\`USD\`, \`EUR\`, \`GBP\`, \`JPY\`, etc.).
- A currency with zero unique payments should **not** appear in the result.

## Constraints
- 0 <= N <= 100,000
- requestId length <= 32
- amount is an integer in [1, 1_000_000]
`,
  stub: `function solution(payments) {
  // your code here
}`,
  exampleTests: [
    {
      name: 'simple',
      input: [
        { requestId: 'r1', amount: 100, currency: 'USD' },
        { requestId: 'r2', amount: 50, currency: 'EUR' },
      ],
      expected: { USD: 100, EUR: 50 },
    },
    {
      name: 'retry not double-counted',
      input: [
        { requestId: 'r1', amount: 100, currency: 'USD' },
        { requestId: 'r1', amount: 100, currency: 'USD' },
      ],
      expected: { USD: 100 },
    },
    {
      name: 'empty',
      input: [],
      expected: {},
    },
  ],
  hiddenCorrectnessTests: [
    {
      name: 'many retries',
      input: [
        { requestId: 'r1', amount: 10, currency: 'USD' },
        { requestId: 'r1', amount: 10, currency: 'USD' },
        { requestId: 'r1', amount: 10, currency: 'USD' },
        { requestId: 'r2', amount: 20, currency: 'USD' },
      ],
      expected: { USD: 30 },
    },
    {
      name: 'three currencies',
      input: [
        { requestId: 'r1', amount: 100, currency: 'USD' },
        { requestId: 'r2', amount: 200, currency: 'EUR' },
        { requestId: 'r3', amount: 30000, currency: 'JPY' },
      ],
      expected: { USD: 100, EUR: 200, JPY: 30000 },
    },
    {
      name: 'distinct requestIds same amount same currency',
      input: [
        { requestId: 'r1', amount: 50, currency: 'USD' },
        { requestId: 'r2', amount: 50, currency: 'USD' },
      ],
      expected: { USD: 100 },
    },
    {
      name: 'retry uses amount from FIRST occurrence',
      input: [
        { requestId: 'r1', amount: 100, currency: 'USD' },
        { requestId: 'r1', amount: 9999, currency: 'USD' },
      ],
      expected: { USD: 100 },
    },
    {
      name: 'single payment',
      input: [
        { requestId: 'r1', amount: 42, currency: 'GBP' },
      ],
      expected: { GBP: 42 },
    },
  ],
  performanceTests: [
    {
      name: '100k payments, ~30% retries',
      buildInput: () => {
        const rng = makeRng(99);
        const currencies = ['USD', 'EUR', 'GBP', 'JPY'];
        const issued: string[] = [];
        const out: Array<Record<string, unknown>> = [];
        for (let i = 0; i < 100_000; i++) {
          if (rng() < 0.3 && issued.length > 0) {
            const rid = issued[Math.floor(rng() * issued.length)];
            out.push({ requestId: rid, amount: 1 + Math.floor(rng() * 1000), currency: currencies[Math.floor(rng() * 4)] });
          } else {
            const rid = `r${i}`;
            issued.push(rid);
            out.push({ requestId: rid, amount: 1 + Math.floor(rng() * 1000), currency: currencies[Math.floor(rng() * 4)] });
          }
        }
        return out;
      },
      maxDurationMs: 800,
    },
  ],
  referenceSolution: `function solution(payments) {
  const seen = new Set();
  const totals = new Map();
  for (const p of payments) {
    if (seen.has(p.requestId)) continue;
    seen.add(p.requestId);
    totals.set(p.currency, (totals.get(p.currency) || 0) + p.amount);
  }
  return Object.fromEntries(totals);
}`,
};

// ============================================================================
// 4) APPROVAL WORKFLOW
// ============================================================================

const approvals: JsProblem = {
  id: 'approval-workflow',
  title: 'Approval Workflow',
  kind: 'js',
  language: 'javascript',
  expectedComplexity: 'O(N)',
  statement: `# Approval Workflow

Documents go through multi-reviewer approval. Events:

\`\`\`
{ type: 'DOC_OPENED',   docId: string, requiredApprovers: number }
{ type: 'DOC_APPROVED', docId: string, reviewerId: string }
{ type: 'DOC_REJECTED', docId: string, reviewerId: string }
\`\`\`

A doc becomes **APPROVED** the moment it accumulates \`requiredApprovers\` distinct approvals.
A doc becomes **REJECTED** the moment any reviewer rejects.
Once a doc has a final state (APPROVED or REJECTED), **further events for it are ignored**.

Implement \`solution(events)\` returning:
\`\`\`
{
  approved: string[],   // docIds that reached APPROVED, sorted ASC
  rejected: string[],   // docIds that reached REJECTED, sorted ASC
  pending:  string[]    // opened docs that never reached either, sorted ASC
}
\`\`\`

## Constraints
- 0 <= N <= 100,000
- docId / reviewerId are strings, length <= 16
- requiredApprovers is an integer in [1, 100]
`,
  stub: `function solution(events) {
  // your code here
}`,
  exampleTests: [
    {
      name: 'one approval one reject one pending',
      input: [
        { type: 'DOC_OPENED', docId: 'd1', requiredApprovers: 1 },
        { type: 'DOC_OPENED', docId: 'd2', requiredApprovers: 1 },
        { type: 'DOC_OPENED', docId: 'd3', requiredApprovers: 1 },
        { type: 'DOC_APPROVED', docId: 'd1', reviewerId: 'r1' },
        { type: 'DOC_REJECTED', docId: 'd2', reviewerId: 'r2' },
      ],
      expected: { approved: ['d1'], rejected: ['d2'], pending: ['d3'] },
    },
    {
      name: 'needs 2 approvers',
      input: [
        { type: 'DOC_OPENED', docId: 'd1', requiredApprovers: 2 },
        { type: 'DOC_APPROVED', docId: 'd1', reviewerId: 'r1' },
      ],
      expected: { approved: [], rejected: [], pending: ['d1'] },
    },
    {
      name: 'empty',
      input: [],
      expected: { approved: [], rejected: [], pending: [] },
    },
  ],
  hiddenCorrectnessTests: [
    {
      name: 'same reviewer approves twice counts once',
      input: [
        { type: 'DOC_OPENED', docId: 'd1', requiredApprovers: 2 },
        { type: 'DOC_APPROVED', docId: 'd1', reviewerId: 'r1' },
        { type: 'DOC_APPROVED', docId: 'd1', reviewerId: 'r1' },
        { type: 'DOC_APPROVED', docId: 'd1', reviewerId: 'r2' },
      ],
      expected: { approved: ['d1'], rejected: [], pending: [] },
    },
    {
      name: 'reject after one approve still rejects',
      input: [
        { type: 'DOC_OPENED', docId: 'd1', requiredApprovers: 3 },
        { type: 'DOC_APPROVED', docId: 'd1', reviewerId: 'r1' },
        { type: 'DOC_REJECTED', docId: 'd1', reviewerId: 'r2' },
        { type: 'DOC_APPROVED', docId: 'd1', reviewerId: 'r3' },
      ],
      expected: { approved: [], rejected: ['d1'], pending: [] },
    },
    {
      name: 'events for unknown docs are ignored',
      input: [
        { type: 'DOC_APPROVED', docId: 'ghost', reviewerId: 'r1' },
      ],
      expected: { approved: [], rejected: [], pending: [] },
    },
    {
      name: 'events after final state ignored',
      input: [
        { type: 'DOC_OPENED', docId: 'd1', requiredApprovers: 1 },
        { type: 'DOC_APPROVED', docId: 'd1', reviewerId: 'r1' },
        { type: 'DOC_REJECTED', docId: 'd1', reviewerId: 'r2' },
      ],
      expected: { approved: ['d1'], rejected: [], pending: [] },
    },
    {
      name: 'sorted output',
      input: [
        { type: 'DOC_OPENED', docId: 'dZ', requiredApprovers: 1 },
        { type: 'DOC_OPENED', docId: 'dA', requiredApprovers: 1 },
        { type: 'DOC_OPENED', docId: 'dM', requiredApprovers: 1 },
        { type: 'DOC_APPROVED', docId: 'dZ', reviewerId: 'r1' },
        { type: 'DOC_APPROVED', docId: 'dA', reviewerId: 'r1' },
      ],
      expected: { approved: ['dA', 'dZ'], rejected: [], pending: ['dM'] },
    },
  ],
  performanceTests: [
    {
      name: '100k workflow events',
      buildInput: () => {
        const rng = makeRng(11);
        const events: Array<Record<string, unknown>> = [];
        const docs: string[] = [];
        for (let i = 0; i < 5000; i++) {
          const id = `d${i}`;
          docs.push(id);
          events.push({ type: 'DOC_OPENED', docId: id, requiredApprovers: 1 + Math.floor(rng() * 3) });
        }
        for (let i = 0; i < 95_000; i++) {
          const docId = docs[Math.floor(rng() * docs.length)];
          const reviewerId = `r${Math.floor(rng() * 100)}`;
          events.push({ type: rng() < 0.85 ? 'DOC_APPROVED' : 'DOC_REJECTED', docId, reviewerId });
        }
        return events;
      },
      maxDurationMs: 900,
    },
  ],
  referenceSolution: `function solution(events) {
  const docs = new Map();  // docId -> { required, approvers: Set, state: 'pending'|'approved'|'rejected' }
  for (const e of events) {
    if (e.type === 'DOC_OPENED') {
      if (!docs.has(e.docId)) {
        docs.set(e.docId, { required: e.requiredApprovers, approvers: new Set(), state: 'pending' });
      }
      continue;
    }
    const d = docs.get(e.docId);
    if (!d || d.state !== 'pending') continue;
    if (e.type === 'DOC_REJECTED') {
      d.state = 'rejected';
    } else if (e.type === 'DOC_APPROVED') {
      d.approvers.add(e.reviewerId);
      if (d.approvers.size >= d.required) d.state = 'approved';
    }
  }
  const approved = [], rejected = [], pending = [];
  for (const [id, d] of docs) {
    if (d.state === 'approved') approved.push(id);
    else if (d.state === 'rejected') rejected.push(id);
    else pending.push(id);
  }
  approved.sort(); rejected.sort(); pending.sort();
  return { approved, rejected, pending };
}`,
};

// ============================================================================
// 5) LATE PAYMENTS
// ============================================================================

const latePayments: JsProblem = {
  id: 'late-payments',
  title: 'Late Payments',
  kind: 'js',
  language: 'javascript',
  expectedComplexity: 'O(N)',
  statement: `# Late Payments

You receive an array of payment records:

\`\`\`
{ contractorId: string, dueTs: number, paidTs: number | null }
\`\`\`

A payment is **late** if \`paidTs !== null\` AND \`paidTs > dueTs\`. An unpaid record (\`paidTs === null\`) is NOT considered late.

Implement \`solution(records)\` returning an array of contractorIds with **at least 3 late payments**, sorted alphabetically.

## Constraints
- 0 <= N <= 100,000
- timestamps are unix millis
- contractorId length <= 16
`,
  stub: `function solution(records) {
  // your code here
}`,
  exampleTests: [
    {
      name: 'one contractor with 3 late',
      input: [
        { contractorId: 'c1', dueTs: 100, paidTs: 200 },
        { contractorId: 'c1', dueTs: 300, paidTs: 400 },
        { contractorId: 'c1', dueTs: 500, paidTs: 600 },
      ],
      expected: ['c1'],
    },
    {
      name: 'mix of on-time and late',
      input: [
        { contractorId: 'c1', dueTs: 100, paidTs: 50 },
        { contractorId: 'c1', dueTs: 200, paidTs: 250 },
        { contractorId: 'c1', dueTs: 300, paidTs: 350 },
      ],
      expected: [],
    },
    {
      name: 'empty',
      input: [],
      expected: [],
    },
  ],
  hiddenCorrectnessTests: [
    {
      name: 'unpaid does not count as late',
      input: [
        { contractorId: 'c1', dueTs: 100, paidTs: 200 },
        { contractorId: 'c1', dueTs: 100, paidTs: null },
        { contractorId: 'c1', dueTs: 100, paidTs: null },
        { contractorId: 'c1', dueTs: 100, paidTs: null },
      ],
      expected: [],
    },
    {
      name: 'paid exactly on dueTs is on-time',
      input: [
        { contractorId: 'c1', dueTs: 100, paidTs: 100 },
        { contractorId: 'c1', dueTs: 100, paidTs: 100 },
        { contractorId: 'c1', dueTs: 100, paidTs: 100 },
      ],
      expected: [],
    },
    {
      name: 'multiple contractors, sorted',
      input: [
        { contractorId: 'cZ', dueTs: 1, paidTs: 2 },
        { contractorId: 'cZ', dueTs: 1, paidTs: 2 },
        { contractorId: 'cZ', dueTs: 1, paidTs: 2 },
        { contractorId: 'cA', dueTs: 1, paidTs: 2 },
        { contractorId: 'cA', dueTs: 1, paidTs: 2 },
        { contractorId: 'cA', dueTs: 1, paidTs: 2 },
      ],
      expected: ['cA', 'cZ'],
    },
    {
      name: 'exactly 2 late does NOT qualify',
      input: [
        { contractorId: 'c1', dueTs: 1, paidTs: 2 },
        { contractorId: 'c1', dueTs: 1, paidTs: 2 },
      ],
      expected: [],
    },
    {
      name: 'exactly 3 late qualifies',
      input: [
        { contractorId: 'c1', dueTs: 1, paidTs: 2 },
        { contractorId: 'c1', dueTs: 1, paidTs: 2 },
        { contractorId: 'c1', dueTs: 1, paidTs: 2 },
      ],
      expected: ['c1'],
    },
  ],
  performanceTests: [
    {
      name: '100k payment records',
      buildInput: () => {
        const rng = makeRng(17);
        const recs: Array<Record<string, unknown>> = [];
        for (let i = 0; i < 100_000; i++) {
          const cid = `c${Math.floor(rng() * 1000)}`;
          const dueTs = 1_700_000_000_000 + Math.floor(rng() * 365 * 86400 * 1000);
          const r = rng();
          let paidTs: number | null = null;
          if (r < 0.7) paidTs = dueTs - Math.floor(rng() * 86400 * 1000); // on-time-ish
          else if (r < 0.95) paidTs = dueTs + Math.floor(rng() * 30 * 86400 * 1000); // late
          recs.push({ contractorId: cid, dueTs, paidTs });
        }
        return recs;
      },
      maxDurationMs: 800,
    },
  ],
  referenceSolution: `function solution(records) {
  const counts = new Map();
  for (const r of records) {
    if (r.paidTs !== null && r.paidTs > r.dueTs) {
      counts.set(r.contractorId, (counts.get(r.contractorId) || 0) + 1);
    }
  }
  const out = [];
  for (const [id, c] of counts) if (c >= 3) out.push(id);
  return out.sort();
}`,
};

// ============================================================================
// 6) CURRENCY BEST PAIR
// ============================================================================

const currencyBestPair: JsProblem = {
  id: 'currency-best-pair',
  title: 'Currency Best Pair',
  kind: 'js',
  language: 'javascript',
  expectedComplexity: 'O(N)',
  statement: `# Currency Best Pair

You receive an array of FX rate snapshots:

\`\`\`
{ pair: string, rate: number, ts: number }
// pair is "FROM_TO", e.g. "USD_EUR"
\`\`\`

For a given \`targetPair\` and a time window \`[startTs, endTs]\` (inclusive), implement \`solution({ snapshots, targetPair, startTs, endTs })\` returning:

\`\`\`
{
  best: { rate: number, ts: number } | null,   // highest rate within window
  worst: { rate: number, ts: number } | null   // lowest rate within window
}
\`\`\`

If no snapshots for the pair fall in the window, return \`{ best: null, worst: null }\`.

## Tie-breaks
- If multiple snapshots tie for best (or worst), return the one with the **lowest \`ts\`** (earliest).

## Constraints
- 0 <= N <= 100,000
- rate is a positive number
- pair length <= 16
`,
  stub: `function solution(input) {
  // your code here
}`,
  exampleTests: [
    {
      name: 'simple window',
      input: {
        snapshots: [
          { pair: 'USD_EUR', rate: 0.9, ts: 100 },
          { pair: 'USD_EUR', rate: 0.95, ts: 200 },
          { pair: 'USD_EUR', rate: 0.85, ts: 300 },
        ],
        targetPair: 'USD_EUR',
        startTs: 100,
        endTs: 300,
      },
      expected: { best: { rate: 0.95, ts: 200 }, worst: { rate: 0.85, ts: 300 } },
    },
    {
      name: 'filters other pairs',
      input: {
        snapshots: [
          { pair: 'USD_EUR', rate: 0.9, ts: 100 },
          { pair: 'EUR_GBP', rate: 100, ts: 100 },
        ],
        targetPair: 'USD_EUR',
        startTs: 0,
        endTs: 200,
      },
      expected: { best: { rate: 0.9, ts: 100 }, worst: { rate: 0.9, ts: 100 } },
    },
    {
      name: 'no matches',
      input: {
        snapshots: [{ pair: 'USD_EUR', rate: 0.9, ts: 100 }],
        targetPair: 'USD_EUR',
        startTs: 200,
        endTs: 300,
      },
      expected: { best: null, worst: null },
    },
  ],
  hiddenCorrectnessTests: [
    {
      name: 'empty snapshots',
      input: { snapshots: [], targetPair: 'USD_EUR', startTs: 0, endTs: 1000 },
      expected: { best: null, worst: null },
    },
    {
      name: 'boundaries inclusive',
      input: {
        snapshots: [
          { pair: 'USD_EUR', rate: 1.0, ts: 100 },
          { pair: 'USD_EUR', rate: 2.0, ts: 200 },
        ],
        targetPair: 'USD_EUR',
        startTs: 100,
        endTs: 200,
      },
      expected: { best: { rate: 2.0, ts: 200 }, worst: { rate: 1.0, ts: 100 } },
    },
    {
      name: 'tie-break: earliest ts for best',
      input: {
        snapshots: [
          { pair: 'USD_EUR', rate: 2.0, ts: 100 },
          { pair: 'USD_EUR', rate: 2.0, ts: 50 },
          { pair: 'USD_EUR', rate: 1.0, ts: 200 },
        ],
        targetPair: 'USD_EUR',
        startTs: 0,
        endTs: 200,
      },
      expected: { best: { rate: 2.0, ts: 50 }, worst: { rate: 1.0, ts: 200 } },
    },
    {
      name: 'single point',
      input: {
        snapshots: [{ pair: 'USD_EUR', rate: 0.95, ts: 150 }],
        targetPair: 'USD_EUR',
        startTs: 100,
        endTs: 200,
      },
      expected: { best: { rate: 0.95, ts: 150 }, worst: { rate: 0.95, ts: 150 } },
    },
    {
      name: 'unordered input',
      input: {
        snapshots: [
          { pair: 'USD_EUR', rate: 0.85, ts: 300 },
          { pair: 'USD_EUR', rate: 0.95, ts: 200 },
          { pair: 'USD_EUR', rate: 0.9, ts: 100 },
        ],
        targetPair: 'USD_EUR',
        startTs: 100,
        endTs: 300,
      },
      expected: { best: { rate: 0.95, ts: 200 }, worst: { rate: 0.85, ts: 300 } },
    },
  ],
  performanceTests: [
    {
      name: '100k snapshots',
      buildInput: () => {
        const rng = makeRng(31);
        const pairs = ['USD_EUR', 'EUR_GBP', 'USD_JPY', 'GBP_USD'];
        const snapshots: Array<Record<string, unknown>> = [];
        for (let i = 0; i < 100_000; i++) {
          snapshots.push({
            pair: pairs[Math.floor(rng() * pairs.length)],
            rate: 0.5 + rng() * 1.5,
            ts: i * 1000,
          });
        }
        return { snapshots, targetPair: 'USD_EUR', startTs: 10_000_000, endTs: 90_000_000 };
      },
      maxDurationMs: 800,
    },
  ],
  referenceSolution: `function solution(input) {
  const { snapshots, targetPair, startTs, endTs } = input;
  let best = null;
  let worst = null;
  for (const s of snapshots) {
    if (s.pair !== targetPair) continue;
    if (s.ts < startTs || s.ts > endTs) continue;
    if (best === null || s.rate > best.rate || (s.rate === best.rate && s.ts < best.ts)) {
      best = { rate: s.rate, ts: s.ts };
    }
    if (worst === null || s.rate < worst.rate || (s.rate === worst.rate && s.ts < worst.ts)) {
      worst = { rate: s.rate, ts: s.ts };
    }
  }
  return { best, worst };
}`,
};

export const extraJsProblems: JsProblem[] = [
  timeTracker,
  subscriptionMrr,
  idempotentPayments,
  approvals,
  latePayments,
  currencyBestPair,
];
