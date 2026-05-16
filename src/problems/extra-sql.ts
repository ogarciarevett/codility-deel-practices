import type { SqlProblem, SqlPerfTest } from './types';
import { DEEL_SCHEMA_DDL } from './types';
import { makeRng } from '../lib/generators';

// Re-usable helper to build a moderately large seed.
function buildLargeSeed(seed: number, opts: { profiles: number; contracts: number; jobs: number }): string {
  const rng = makeRng(seed);
  const PROFS = ['Programmer', 'Musician', 'Designer', 'Writer', 'Architect'];
  const lines: string[] = [];
  for (let i = 1; i <= opts.profiles; i++) {
    if (i % 2 === 0) {
      const prof = PROFS[Math.floor(rng() * PROFS.length)];
      lines.push(`INSERT INTO profiles (id,type,first_name,profession) VALUES (${i},'contractor','C${i}','${prof}');`);
    } else {
      lines.push(`INSERT INTO profiles (id,type,first_name) VALUES (${i},'client','Cl${i}');`);
    }
  }
  for (let i = 1; i <= opts.contracts; i++) {
    const client = 1 + 2 * Math.floor(rng() * (opts.profiles / 2));
    const contractor = 2 + 2 * Math.floor(rng() * (opts.profiles / 2));
    const statuses = ['new', 'in_progress', 'terminated'];
    const status = statuses[Math.floor(rng() * 3)];
    lines.push(`INSERT INTO contracts (id,status,client_id,contractor_id) VALUES (${i},'${status}',${client},${contractor});`);
  }
  const start = Date.UTC(2022, 0, 1);
  const end = Date.UTC(2024, 11, 31);
  for (let i = 1; i <= opts.jobs; i++) {
    const cid = 1 + Math.floor(rng() * opts.contracts);
    const price = 10 + Math.floor(rng() * 990);
    const paid = rng() > 0.2;
    const ts = start + Math.floor(rng() * (end - start));
    const pd = paid ? `'${new Date(ts).toISOString().slice(0, 19).replace('T', ' ')}'` : 'NULL';
    lines.push(`INSERT INTO jobs (id,description,price,paid,payment_date,contract_id) VALUES (${i},'j${i}',${price},${paid},${pd},${cid});`);
  }
  return lines.join('\n');
}

function perfShape(maxDurationMs: number, expectedColumns: string[]): SqlPerfTest {
  return {
    name: '10k+ jobs perf',
    buildSeed: () => buildLargeSeed(123, { profiles: 5000, contracts: 3000, jobs: 10_000 }),
    params: { start_date: '2022-01-01', end_date: '2024-12-31' },
    validate: (rows) => {
      if (rows.length === 0) return 'expected at least 1 row';
      const cols = Object.keys(rows[0]).sort();
      const want = [...expectedColumns].sort();
      if (cols.length !== want.length || !cols.every((c, i) => c === want[i])) {
        return `expected columns ${want.join(',')}, got ${cols.join(',')}`;
      }
      return null;
    },
    maxDurationMs,
  };
}

// ============================================================================
// 1) Highest-paid contractor per profession
// ============================================================================
const highestPaidContractor: SqlProblem = {
  id: 'highest-paid-contractor',
  title: 'Highest-Paid Contractor per Profession',
  kind: 'sql',
  language: 'sql-postgres',
  statement: `# Highest-Paid Contractor per Profession

For each \`profession\`, return the contractor (their \`first_name\`) with the **maximum total earnings** from paid jobs whose \`payment_date\` is within \`[:start_date, :end_date]\`.

Columns: \`profession\`, \`first_name\`, \`total_earned\` (as text or numeric).

Tie-break: if multiple contractors of the same profession tie, return the one with the **lowest \`profiles.id\`**. Order the result by \`profession ASC\`.

If no rows match, return zero rows.
`,
  stub: `SELECT profession, first_name, total_earned
FROM ...`,
  schemaDDL: DEEL_SCHEMA_DDL,
  exampleTests: [
    {
      name: 'two professions, distinct winners',
      params: { start_date: '2024-01-01', end_date: '2024-12-31' },
      seed: `
        INSERT INTO profiles (id,type,first_name,profession) VALUES
          (1,'client','A',NULL),
          (2,'contractor','Bob','Programmer'),
          (3,'contractor','Cara','Programmer'),
          (4,'contractor','Dee','Musician');
        INSERT INTO contracts (id,status,client_id,contractor_id) VALUES
          (1,'in_progress',1,2),(2,'in_progress',1,3),(3,'in_progress',1,4);
        INSERT INTO jobs (id,description,price,paid,payment_date,contract_id) VALUES
          (1,'a',100,true,'2024-06-01',1),
          (2,'b',300,true,'2024-06-01',2),
          (3,'c',200,true,'2024-06-01',3);
      `,
      expected: [
        { profession: 'Musician', first_name: 'Dee', total_earned: '200' },
        { profession: 'Programmer', first_name: 'Cara', total_earned: '300' },
      ],
    },
    {
      name: 'tie within profession → lowest id wins',
      params: { start_date: '2024-01-01', end_date: '2024-12-31' },
      seed: `
        INSERT INTO profiles (id,type,first_name,profession) VALUES
          (1,'client','A',NULL),
          (2,'contractor','Bob','Programmer'),
          (3,'contractor','Cara','Programmer');
        INSERT INTO contracts (id,status,client_id,contractor_id) VALUES
          (1,'in_progress',1,2),(2,'in_progress',1,3);
        INSERT INTO jobs (id,description,price,paid,payment_date,contract_id) VALUES
          (1,'a',100,true,'2024-06-01',1),
          (2,'b',100,true,'2024-06-01',2);
      `,
      expected: [{ profession: 'Programmer', first_name: 'Bob', total_earned: '100' }],
    },
    {
      name: 'no rows',
      params: { start_date: '1990-01-01', end_date: '1990-12-31' },
      seed: `INSERT INTO profiles (id,type,first_name) VALUES (1,'client','x');`,
      expected: [],
    },
  ],
  hiddenCorrectnessTests: [
    {
      name: 'unpaid excluded',
      params: { start_date: '2024-01-01', end_date: '2024-12-31' },
      seed: `
        INSERT INTO profiles (id,type,first_name,profession) VALUES
          (1,'client','A',NULL),(2,'contractor','Bob','Programmer');
        INSERT INTO contracts (id,status,client_id,contractor_id) VALUES (1,'in_progress',1,2);
        INSERT INTO jobs (id,description,price,paid,payment_date,contract_id) VALUES
          (1,'unpaid',9999,false,'2024-06-01',1),(2,'paid',50,true,'2024-06-01',1);`,
      expected: [{ profession: 'Programmer', first_name: 'Bob', total_earned: '50' }],
    },
    {
      name: 'date boundaries inclusive',
      params: { start_date: '2024-06-01', end_date: '2024-08-31' },
      seed: `
        INSERT INTO profiles (id,type,first_name,profession) VALUES
          (1,'client','A',NULL),(2,'contractor','Bob','Programmer');
        INSERT INTO contracts (id,status,client_id,contractor_id) VALUES (1,'in_progress',1,2);
        INSERT INTO jobs (id,description,price,paid,payment_date,contract_id) VALUES
          (1,'start',100,true,'2024-06-01',1),(2,'end',200,true,'2024-08-31',1),(3,'outside',500,true,'2024-09-01',1);`,
      expected: [{ profession: 'Programmer', first_name: 'Bob', total_earned: '300' }],
    },
    {
      name: 'multiple professions sorted',
      params: { start_date: '2024-01-01', end_date: '2024-12-31' },
      seed: `
        INSERT INTO profiles (id,type,first_name,profession) VALUES
          (1,'client','A',NULL),
          (2,'contractor','B','Zookeeper'),
          (3,'contractor','C','Architect'),
          (4,'contractor','D','Musician');
        INSERT INTO contracts (id,status,client_id,contractor_id) VALUES
          (1,'in_progress',1,2),(2,'in_progress',1,3),(3,'in_progress',1,4);
        INSERT INTO jobs (id,description,price,paid,payment_date,contract_id) VALUES
          (1,'a',10,true,'2024-06-01',1),(2,'b',20,true,'2024-06-01',2),(3,'c',30,true,'2024-06-01',3);`,
      expected: [
        { profession: 'Architect', first_name: 'C', total_earned: '20' },
        { profession: 'Musician', first_name: 'D', total_earned: '30' },
        { profession: 'Zookeeper', first_name: 'B', total_earned: '10' },
      ],
    },
    {
      name: 'one contractor across multiple contracts aggregates',
      params: { start_date: '2024-01-01', end_date: '2024-12-31' },
      seed: `
        INSERT INTO profiles (id,type,first_name,profession) VALUES
          (1,'client','A',NULL),(2,'client','B',NULL),(3,'contractor','Bob','Programmer');
        INSERT INTO contracts (id,status,client_id,contractor_id) VALUES
          (1,'in_progress',1,3),(2,'in_progress',2,3);
        INSERT INTO jobs (id,description,price,paid,payment_date,contract_id) VALUES
          (1,'a',100,true,'2024-03-01',1),(2,'b',200,true,'2024-04-01',2);`,
      expected: [{ profession: 'Programmer', first_name: 'Bob', total_earned: '300' }],
    },
    {
      name: 'terminated contracts still count if paid',
      params: { start_date: '2024-01-01', end_date: '2024-12-31' },
      seed: `
        INSERT INTO profiles (id,type,first_name,profession) VALUES
          (1,'client','A',NULL),(2,'contractor','Bob','Programmer');
        INSERT INTO contracts (id,status,client_id,contractor_id) VALUES (1,'terminated',1,2);
        INSERT INTO jobs (id,description,price,paid,payment_date,contract_id) VALUES
          (1,'a',700,true,'2024-06-01',1);`,
      expected: [{ profession: 'Programmer', first_name: 'Bob', total_earned: '700' }],
    },
  ],
  performanceTests: [perfShape(2500, ['profession', 'first_name', 'total_earned'])],
  referenceSolution: `WITH totals AS (
  SELECT p.id, p.first_name, p.profession, SUM(j.price) AS total
  FROM jobs j
  JOIN contracts c ON c.id = j.contract_id
  JOIN profiles p ON p.id = c.contractor_id
  WHERE j.paid = TRUE
    AND j.payment_date BETWEEN :start_date AND :end_date
    AND p.profession IS NOT NULL
  GROUP BY p.id, p.first_name, p.profession
),
ranked AS (
  SELECT profession, first_name, total,
         ROW_NUMBER() OVER (PARTITION BY profession ORDER BY total DESC, id ASC) AS rn
  FROM totals
)
SELECT profession, first_name, total::TEXT AS total_earned
FROM ranked
WHERE rn = 1
ORDER BY profession ASC;`,
};

// ============================================================================
// 2) Months with no payments
// ============================================================================
const monthsNoPayments: SqlProblem = {
  id: 'months-no-payments',
  title: 'Months With No Payments',
  kind: 'sql',
  language: 'sql-postgres',
  statement: `# Months With No Payments

Given a range \`[:start_date, :end_date]\` (each is a date on the first day of a month), return every calendar month in that range that has **zero paid jobs** whose \`payment_date\` falls inside the month.

Columns: \`month\` (formatted as \`YYYY-MM\`).

Order by \`month ASC\`.

## Notes
- The range is inclusive on both ends. \`:start_date = '2024-01-01'\`, \`:end_date = '2024-12-01'\` covers Jan..Dec 2024 (12 months).
- A month is "with no payments" if no row in \`jobs\` with \`paid=TRUE\` has \`payment_date\` in that month.

Hint: \`generate_series\` makes this clean.
`,
  stub: `SELECT month FROM ...`,
  schemaDDL: DEEL_SCHEMA_DDL,
  exampleTests: [
    {
      name: 'one missing month',
      params: { start_date: '2024-01-01', end_date: '2024-03-01' },
      seed: `
        INSERT INTO profiles (id,type,first_name) VALUES (1,'client','A'),(2,'contractor','B');
        INSERT INTO contracts (id,status,client_id,contractor_id) VALUES (1,'in_progress',1,2);
        INSERT INTO jobs (id,description,price,paid,payment_date,contract_id) VALUES
          (1,'a',10,true,'2024-01-10',1),
          (2,'b',10,true,'2024-03-15',1);`,
      expected: [{ month: '2024-02' }],
    },
    {
      name: 'all months missing',
      params: { start_date: '2024-01-01', end_date: '2024-03-01' },
      seed: `INSERT INTO profiles (id,type,first_name) VALUES (1,'client','A');`,
      expected: [{ month: '2024-01' }, { month: '2024-02' }, { month: '2024-03' }],
    },
    {
      name: 'no months missing',
      params: { start_date: '2024-01-01', end_date: '2024-02-01' },
      seed: `
        INSERT INTO profiles (id,type,first_name) VALUES (1,'client','A'),(2,'contractor','B');
        INSERT INTO contracts (id,status,client_id,contractor_id) VALUES (1,'in_progress',1,2);
        INSERT INTO jobs (id,description,price,paid,payment_date,contract_id) VALUES
          (1,'a',10,true,'2024-01-10',1),
          (2,'b',10,true,'2024-02-10',1);`,
      expected: [],
    },
  ],
  hiddenCorrectnessTests: [
    {
      name: 'unpaid in a month does NOT cover it',
      params: { start_date: '2024-01-01', end_date: '2024-02-01' },
      seed: `
        INSERT INTO profiles (id,type,first_name) VALUES (1,'client','A'),(2,'contractor','B');
        INSERT INTO contracts (id,status,client_id,contractor_id) VALUES (1,'in_progress',1,2);
        INSERT INTO jobs (id,description,price,paid,payment_date,contract_id) VALUES
          (1,'a',10,false,'2024-01-10',1),
          (2,'b',10,true,'2024-02-15',1);`,
      expected: [{ month: '2024-01' }],
    },
    {
      name: 'single month range',
      params: { start_date: '2024-06-01', end_date: '2024-06-01' },
      seed: `INSERT INTO profiles (id,type,first_name) VALUES (1,'client','A');`,
      expected: [{ month: '2024-06' }],
    },
    {
      name: 'last day of month counts toward that month',
      params: { start_date: '2024-01-01', end_date: '2024-02-01' },
      seed: `
        INSERT INTO profiles (id,type,first_name) VALUES (1,'client','A'),(2,'contractor','B');
        INSERT INTO contracts (id,status,client_id,contractor_id) VALUES (1,'in_progress',1,2);
        INSERT INTO jobs (id,description,price,paid,payment_date,contract_id) VALUES
          (1,'a',10,true,'2024-01-31',1);`,
      expected: [{ month: '2024-02' }],
    },
    {
      name: 'cross-year range',
      params: { start_date: '2023-12-01', end_date: '2024-01-01' },
      seed: `
        INSERT INTO profiles (id,type,first_name) VALUES (1,'client','A'),(2,'contractor','B');
        INSERT INTO contracts (id,status,client_id,contractor_id) VALUES (1,'in_progress',1,2);
        INSERT INTO jobs (id,description,price,paid,payment_date,contract_id) VALUES
          (1,'a',10,true,'2023-12-10',1);`,
      expected: [{ month: '2024-01' }],
    },
  ],
  performanceTests: [
    {
      name: '36-month range over 10k jobs',
      buildSeed: () => buildLargeSeed(7, { profiles: 100, contracts: 100, jobs: 10_000 }),
      params: { start_date: '2022-01-01', end_date: '2024-12-01' },
      validate: (rows) => {
        for (const r of rows) {
          if (!/^\d{4}-\d{2}$/.test(String(r.month))) return `bad month format: ${r.month}`;
        }
        return null;
      },
      maxDurationMs: 1500,
    },
  ],
  referenceSolution: `WITH months AS (
  SELECT TO_CHAR(d, 'YYYY-MM') AS month
  FROM generate_series(:start_date::date, :end_date::date, '1 month') AS d
)
SELECT month
FROM months
WHERE month NOT IN (
  SELECT TO_CHAR(payment_date, 'YYYY-MM')
  FROM jobs
  WHERE paid = TRUE AND payment_date IS NOT NULL
)
ORDER BY month ASC;`,
};

// ============================================================================
// 3) Cancellation rate per contractor
// ============================================================================
const cancellationRate: SqlProblem = {
  id: 'cancellation-rate',
  title: 'High-Cancellation Contractors',
  kind: 'sql',
  language: 'sql-postgres',
  statement: `# High-Cancellation Contractors

Return contractors whose **cancellation rate** is **strictly greater than 30%**.

For a contractor, the cancellation rate = (count of contracts with \`status = 'terminated'\`) / (total contracts), considering **all contracts** they appear on as \`contractor_id\`.

Columns: \`contractor_id\`, \`first_name\`, \`cancellation_pct\` (rounded to 1 decimal, **as text**, e.g. \`'42.9'\`).

Filter: only contractors with at least 3 total contracts.

Order by \`cancellation_pct DESC, contractor_id ASC\`.
`,
  stub: `SELECT contractor_id, first_name, cancellation_pct FROM ...`,
  schemaDDL: DEEL_SCHEMA_DDL,
  exampleTests: [
    {
      name: '50% rate',
      params: {},
      seed: `
        INSERT INTO profiles (id,type,first_name) VALUES (1,'client','A'),(2,'contractor','Bob');
        INSERT INTO contracts (id,status,client_id,contractor_id) VALUES
          (1,'terminated',1,2),(2,'in_progress',1,2),(3,'terminated',1,2),(4,'in_progress',1,2);`,
      expected: [{ contractor_id: 2, first_name: 'Bob', cancellation_pct: '50.0' }],
    },
    {
      name: 'below threshold filtered',
      params: {},
      seed: `
        INSERT INTO profiles (id,type,first_name) VALUES (1,'client','A'),(2,'contractor','Bob');
        INSERT INTO contracts (id,status,client_id,contractor_id) VALUES
          (1,'in_progress',1,2),(2,'in_progress',1,2),(3,'terminated',1,2);`,
      expected: [],
    },
    {
      name: 'less than 3 contracts filtered',
      params: {},
      seed: `
        INSERT INTO profiles (id,type,first_name) VALUES (1,'client','A'),(2,'contractor','Bob');
        INSERT INTO contracts (id,status,client_id,contractor_id) VALUES
          (1,'terminated',1,2),(2,'terminated',1,2);`,
      expected: [],
    },
  ],
  hiddenCorrectnessTests: [
    {
      name: 'exactly 30% does NOT qualify',
      params: {},
      seed: `
        INSERT INTO profiles (id,type,first_name) VALUES (1,'client','A'),(2,'contractor','Bob');
        INSERT INTO contracts (id,status,client_id,contractor_id) VALUES
          (1,'terminated',1,2),(2,'terminated',1,2),(3,'terminated',1,2),
          (4,'in_progress',1,2),(5,'in_progress',1,2),(6,'in_progress',1,2),
          (7,'in_progress',1,2),(8,'in_progress',1,2),(9,'in_progress',1,2),
          (10,'in_progress',1,2);`,
      expected: [],
    },
    {
      name: 'two contractors sorted by rate desc',
      params: {},
      seed: `
        INSERT INTO profiles (id,type,first_name) VALUES (1,'client','A'),(2,'contractor','Bob'),(3,'contractor','Cara');
        INSERT INTO contracts (id,status,client_id,contractor_id) VALUES
          (1,'terminated',1,2),(2,'terminated',1,2),(3,'in_progress',1,2),(4,'in_progress',1,2),
          (5,'terminated',1,3),(6,'terminated',1,3),(7,'terminated',1,3),(8,'in_progress',1,3);`,
      expected: [
        { contractor_id: 3, first_name: 'Cara', cancellation_pct: '75.0' },
        { contractor_id: 2, first_name: 'Bob', cancellation_pct: '50.0' },
      ],
    },
    {
      name: 'all terminated = 100%',
      params: {},
      seed: `
        INSERT INTO profiles (id,type,first_name) VALUES (1,'client','A'),(2,'contractor','Bob');
        INSERT INTO contracts (id,status,client_id,contractor_id) VALUES
          (1,'terminated',1,2),(2,'terminated',1,2),(3,'terminated',1,2);`,
      expected: [{ contractor_id: 2, first_name: 'Bob', cancellation_pct: '100.0' }],
    },
    {
      name: 'tie-break by contractor_id asc',
      params: {},
      seed: `
        INSERT INTO profiles (id,type,first_name) VALUES (1,'client','A'),(2,'contractor','Bob'),(3,'contractor','Cara');
        INSERT INTO contracts (id,status,client_id,contractor_id) VALUES
          (1,'terminated',1,2),(2,'terminated',1,2),(3,'in_progress',1,2),(4,'in_progress',1,2),
          (5,'terminated',1,3),(6,'terminated',1,3),(7,'in_progress',1,3),(8,'in_progress',1,3);`,
      expected: [
        { contractor_id: 2, first_name: 'Bob', cancellation_pct: '50.0' },
        { contractor_id: 3, first_name: 'Cara', cancellation_pct: '50.0' },
      ],
    },
  ],
  performanceTests: [perfShape(2500, ['contractor_id', 'first_name', 'cancellation_pct'])],
  referenceSolution: `SELECT c.contractor_id,
       p.first_name,
       ROUND(SUM(CASE WHEN c.status = 'terminated' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 1)::TEXT AS cancellation_pct
FROM contracts c
JOIN profiles p ON p.id = c.contractor_id
GROUP BY c.contractor_id, p.first_name
HAVING COUNT(*) >= 3
   AND SUM(CASE WHEN c.status = 'terminated' THEN 1 ELSE 0 END) * 100.0 / COUNT(*) > 30
ORDER BY cancellation_pct DESC, c.contractor_id ASC;`,
};

// ============================================================================
// 4) Average days to payment
// ============================================================================
const avgDaysToPayment: SqlProblem = {
  id: 'avg-days-to-payment',
  title: 'Average Days to Payment',
  kind: 'sql',
  language: 'sql-postgres',
  statement: `# Average Days to Payment

For each contractor (\`type = 'contractor'\`), compute the **average number of days** between \`contracts.created_at\` and \`jobs.payment_date\`, considering **only paid jobs**.

Columns: \`contractor_id\`, \`first_name\`, \`avg_days\` (numeric, rounded to 1 decimal, **as text** e.g. \`'12.5'\`).

Filter: only contractors with at least 1 paid job.

Order by \`avg_days ASC, contractor_id ASC\`.
`,
  stub: `SELECT contractor_id, first_name, avg_days FROM ...`,
  schemaDDL: DEEL_SCHEMA_DDL,
  exampleTests: [
    {
      name: 'two contractors',
      params: {},
      seed: `
        INSERT INTO profiles (id,type,first_name) VALUES (1,'client','A'),(2,'contractor','Bob'),(3,'contractor','Cara');
        INSERT INTO contracts (id,status,client_id,contractor_id,created_at) VALUES
          (1,'in_progress',1,2,'2024-01-01'),(2,'in_progress',1,3,'2024-01-01');
        INSERT INTO jobs (id,description,price,paid,payment_date,contract_id) VALUES
          (1,'a',100,true,'2024-01-11',1),
          (2,'b',100,true,'2024-01-21',2);`,
      expected: [
        { contractor_id: 2, first_name: 'Bob', avg_days: '10.0' },
        { contractor_id: 3, first_name: 'Cara', avg_days: '20.0' },
      ],
    },
    {
      name: 'unpaid excluded',
      params: {},
      seed: `
        INSERT INTO profiles (id,type,first_name) VALUES (1,'client','A'),(2,'contractor','Bob');
        INSERT INTO contracts (id,status,client_id,contractor_id,created_at) VALUES (1,'in_progress',1,2,'2024-01-01');
        INSERT INTO jobs (id,description,price,paid,payment_date,contract_id) VALUES
          (1,'unpaid',100,false,NULL,1),
          (2,'paid',100,true,'2024-01-06',1);`,
      expected: [{ contractor_id: 2, first_name: 'Bob', avg_days: '5.0' }],
    },
    {
      name: 'no paid jobs → no rows',
      params: {},
      seed: `INSERT INTO profiles (id,type,first_name) VALUES (1,'contractor','x');`,
      expected: [],
    },
  ],
  hiddenCorrectnessTests: [
    {
      name: 'multiple jobs averaged',
      params: {},
      seed: `
        INSERT INTO profiles (id,type,first_name) VALUES (1,'client','A'),(2,'contractor','Bob');
        INSERT INTO contracts (id,status,client_id,contractor_id,created_at) VALUES (1,'in_progress',1,2,'2024-01-01');
        INSERT INTO jobs (id,description,price,paid,payment_date,contract_id) VALUES
          (1,'a',1,true,'2024-01-11',1),
          (2,'b',1,true,'2024-01-21',1),
          (3,'c',1,true,'2024-01-31',1);`,
      expected: [{ contractor_id: 2, first_name: 'Bob', avg_days: '20.0' }],
    },
    {
      name: 'across multiple contracts',
      params: {},
      seed: `
        INSERT INTO profiles (id,type,first_name) VALUES (1,'client','A'),(2,'contractor','Bob');
        INSERT INTO contracts (id,status,client_id,contractor_id,created_at) VALUES
          (1,'in_progress',1,2,'2024-01-01'),
          (2,'in_progress',1,2,'2024-06-01');
        INSERT INTO jobs (id,description,price,paid,payment_date,contract_id) VALUES
          (1,'a',1,true,'2024-01-11',1),
          (2,'b',1,true,'2024-06-21',2);`,
      expected: [{ contractor_id: 2, first_name: 'Bob', avg_days: '15.0' }],
    },
    {
      name: 'same-day payment = 0 days',
      params: {},
      seed: `
        INSERT INTO profiles (id,type,first_name) VALUES (1,'client','A'),(2,'contractor','Bob');
        INSERT INTO contracts (id,status,client_id,contractor_id,created_at) VALUES (1,'in_progress',1,2,'2024-01-01');
        INSERT INTO jobs (id,description,price,paid,payment_date,contract_id) VALUES
          (1,'a',1,true,'2024-01-01',1);`,
      expected: [{ contractor_id: 2, first_name: 'Bob', avg_days: '0.0' }],
    },
    {
      name: 'sort by avg_days asc',
      params: {},
      seed: `
        INSERT INTO profiles (id,type,first_name) VALUES (1,'client','A'),(2,'contractor','Bob'),(3,'contractor','Cara');
        INSERT INTO contracts (id,status,client_id,contractor_id,created_at) VALUES
          (1,'in_progress',1,2,'2024-01-01'),(2,'in_progress',1,3,'2024-01-01');
        INSERT INTO jobs (id,description,price,paid,payment_date,contract_id) VALUES
          (1,'a',1,true,'2024-01-31',1),
          (2,'b',1,true,'2024-01-06',2);`,
      expected: [
        { contractor_id: 3, first_name: 'Cara', avg_days: '5.0' },
        { contractor_id: 2, first_name: 'Bob', avg_days: '30.0' },
      ],
    },
  ],
  performanceTests: [perfShape(2500, ['contractor_id', 'first_name', 'avg_days'])],
  referenceSolution: `SELECT p.id AS contractor_id,
       p.first_name,
       ROUND(AVG(EXTRACT(EPOCH FROM (j.payment_date - c.created_at)) / 86400.0)::numeric, 1)::TEXT AS avg_days
FROM jobs j
JOIN contracts c ON c.id = j.contract_id
JOIN profiles p ON p.id = c.contractor_id
WHERE j.paid = TRUE
  AND p.type = 'contractor'
GROUP BY p.id, p.first_name
ORDER BY (AVG(EXTRACT(EPOCH FROM (j.payment_date - c.created_at)) / 86400.0)) ASC, p.id ASC;`,
};

// ============================================================================
// 5) Clients without active contracts
// ============================================================================
const clientsWithoutActive: SqlProblem = {
  id: 'clients-without-active',
  title: 'Clients With No Active Contracts',
  kind: 'sql',
  language: 'sql-postgres',
  statement: `# Clients With No Active Contracts

Return all clients (\`profiles.type = 'client'\`) who have **at least 1 historical contract** but **zero \`in_progress\` contracts** right now.

Columns: \`client_id\`, \`first_name\`.

Order by \`client_id ASC\`.

A client with no contracts at all should NOT appear (they need at least 1 contract in history).
`,
  stub: `SELECT client_id, first_name FROM ...`,
  schemaDDL: DEEL_SCHEMA_DDL,
  exampleTests: [
    {
      name: 'one client lost their only active',
      params: {},
      seed: `
        INSERT INTO profiles (id,type,first_name) VALUES (1,'client','Alice'),(2,'contractor','B');
        INSERT INTO contracts (id,status,client_id,contractor_id) VALUES
          (1,'terminated',1,2);`,
      expected: [{ client_id: 1, first_name: 'Alice' }],
    },
    {
      name: 'still active → excluded',
      params: {},
      seed: `
        INSERT INTO profiles (id,type,first_name) VALUES (1,'client','Alice'),(2,'contractor','B');
        INSERT INTO contracts (id,status,client_id,contractor_id) VALUES
          (1,'terminated',1,2),(2,'in_progress',1,2);`,
      expected: [],
    },
    {
      name: 'client with no contracts at all → excluded',
      params: {},
      seed: `INSERT INTO profiles (id,type,first_name) VALUES (1,'client','Alice');`,
      expected: [],
    },
  ],
  hiddenCorrectnessTests: [
    {
      name: 'new status does not count as active',
      params: {},
      seed: `
        INSERT INTO profiles (id,type,first_name) VALUES (1,'client','Alice'),(2,'contractor','B');
        INSERT INTO contracts (id,status,client_id,contractor_id) VALUES
          (1,'new',1,2),(2,'terminated',1,2);`,
      expected: [{ client_id: 1, first_name: 'Alice' }],
    },
    {
      name: 'multiple clients sorted',
      params: {},
      seed: `
        INSERT INTO profiles (id,type,first_name) VALUES
          (1,'client','Alice'),(2,'client','Bob'),(3,'contractor','C');
        INSERT INTO contracts (id,status,client_id,contractor_id) VALUES
          (1,'terminated',1,3),(2,'terminated',2,3);`,
      expected: [
        { client_id: 1, first_name: 'Alice' },
        { client_id: 2, first_name: 'Bob' },
      ],
    },
    {
      name: 'contractors are not clients',
      params: {},
      seed: `
        INSERT INTO profiles (id,type,first_name) VALUES (1,'contractor','C1'),(2,'contractor','C2');
        INSERT INTO contracts (id,status,client_id,contractor_id) VALUES
          (1,'terminated',1,2);`,
      expected: [],
    },
    {
      name: 'mix of statuses but none in_progress',
      params: {},
      seed: `
        INSERT INTO profiles (id,type,first_name) VALUES (1,'client','Alice'),(2,'contractor','B');
        INSERT INTO contracts (id,status,client_id,contractor_id) VALUES
          (1,'terminated',1,2),(2,'new',1,2);`,
      expected: [{ client_id: 1, first_name: 'Alice' }],
    },
  ],
  performanceTests: [perfShape(2000, ['client_id', 'first_name'])],
  referenceSolution: `SELECT p.id AS client_id, p.first_name
FROM profiles p
WHERE p.type = 'client'
  AND EXISTS (SELECT 1 FROM contracts c WHERE c.client_id = p.id)
  AND NOT EXISTS (SELECT 1 FROM contracts c WHERE c.client_id = p.id AND c.status = 'in_progress')
ORDER BY p.id ASC;`,
};

// ============================================================================
// 6) Top earner per year
// ============================================================================
const topEarnerPerYear: SqlProblem = {
  id: 'top-earner-per-year',
  title: 'Top Earner per Year',
  kind: 'sql',
  language: 'sql-postgres',
  statement: `# Top Earner per Year

For each calendar year present in \`payment_date\` (paid jobs only), return the contractor with the **highest total earnings** in that year.

Columns: \`year\` (integer), \`contractor_id\`, \`first_name\`, \`total_earned\` (as text).

Tie-break: lowest \`contractor_id\`.

Order by \`year ASC\`.
`,
  stub: `SELECT year, contractor_id, first_name, total_earned FROM ...`,
  schemaDDL: DEEL_SCHEMA_DDL,
  exampleTests: [
    {
      name: 'one winner per year',
      params: {},
      seed: `
        INSERT INTO profiles (id,type,first_name) VALUES (1,'client','A'),(2,'contractor','Bob'),(3,'contractor','Cara');
        INSERT INTO contracts (id,status,client_id,contractor_id) VALUES (1,'in_progress',1,2),(2,'in_progress',1,3);
        INSERT INTO jobs (id,description,price,paid,payment_date,contract_id) VALUES
          (1,'a',500,true,'2023-06-01',1),
          (2,'b',300,true,'2024-06-01',2);`,
      expected: [
        { year: 2023, contractor_id: 2, first_name: 'Bob', total_earned: '500' },
        { year: 2024, contractor_id: 3, first_name: 'Cara', total_earned: '300' },
      ],
    },
    {
      name: 'tie by lowest id',
      params: {},
      seed: `
        INSERT INTO profiles (id,type,first_name) VALUES (1,'client','A'),(2,'contractor','Bob'),(3,'contractor','Cara');
        INSERT INTO contracts (id,status,client_id,contractor_id) VALUES (1,'in_progress',1,2),(2,'in_progress',1,3);
        INSERT INTO jobs (id,description,price,paid,payment_date,contract_id) VALUES
          (1,'a',100,true,'2024-06-01',1),
          (2,'b',100,true,'2024-06-01',2);`,
      expected: [{ year: 2024, contractor_id: 2, first_name: 'Bob', total_earned: '100' }],
    },
    {
      name: 'no paid jobs',
      params: {},
      seed: `INSERT INTO profiles (id,type,first_name) VALUES (1,'client','A');`,
      expected: [],
    },
  ],
  hiddenCorrectnessTests: [
    {
      name: 'aggregates across contracts',
      params: {},
      seed: `
        INSERT INTO profiles (id,type,first_name) VALUES (1,'client','A'),(2,'client','B'),(3,'contractor','Bob');
        INSERT INTO contracts (id,status,client_id,contractor_id) VALUES (1,'in_progress',1,3),(2,'in_progress',2,3);
        INSERT INTO jobs (id,description,price,paid,payment_date,contract_id) VALUES
          (1,'a',100,true,'2024-03-01',1),
          (2,'b',150,true,'2024-04-01',2);`,
      expected: [{ year: 2024, contractor_id: 3, first_name: 'Bob', total_earned: '250' }],
    },
    {
      name: 'unpaid excluded',
      params: {},
      seed: `
        INSERT INTO profiles (id,type,first_name) VALUES (1,'client','A'),(2,'contractor','Bob');
        INSERT INTO contracts (id,status,client_id,contractor_id) VALUES (1,'in_progress',1,2);
        INSERT INTO jobs (id,description,price,paid,payment_date,contract_id) VALUES
          (1,'unpaid',9999,false,'2024-06-01',1),(2,'paid',50,true,'2024-06-01',1);`,
      expected: [{ year: 2024, contractor_id: 2, first_name: 'Bob', total_earned: '50' }],
    },
    {
      name: 'cross-year same contractor',
      params: {},
      seed: `
        INSERT INTO profiles (id,type,first_name) VALUES (1,'client','A'),(2,'contractor','Bob');
        INSERT INTO contracts (id,status,client_id,contractor_id) VALUES (1,'in_progress',1,2);
        INSERT INTO jobs (id,description,price,paid,payment_date,contract_id) VALUES
          (1,'a',100,true,'2023-06-01',1),
          (2,'b',200,true,'2024-06-01',1);`,
      expected: [
        { year: 2023, contractor_id: 2, first_name: 'Bob', total_earned: '100' },
        { year: 2024, contractor_id: 2, first_name: 'Bob', total_earned: '200' },
      ],
    },
    {
      name: 'three years sorted',
      params: {},
      seed: `
        INSERT INTO profiles (id,type,first_name) VALUES (1,'client','A'),(2,'contractor','Bob');
        INSERT INTO contracts (id,status,client_id,contractor_id) VALUES (1,'in_progress',1,2);
        INSERT INTO jobs (id,description,price,paid,payment_date,contract_id) VALUES
          (1,'a',1,true,'2022-06-01',1),
          (2,'b',2,true,'2023-06-01',1),
          (3,'c',3,true,'2024-06-01',1);`,
      expected: [
        { year: 2022, contractor_id: 2, first_name: 'Bob', total_earned: '1' },
        { year: 2023, contractor_id: 2, first_name: 'Bob', total_earned: '2' },
        { year: 2024, contractor_id: 2, first_name: 'Bob', total_earned: '3' },
      ],
    },
  ],
  performanceTests: [perfShape(2500, ['year', 'contractor_id', 'first_name', 'total_earned'])],
  referenceSolution: `WITH yearly AS (
  SELECT EXTRACT(YEAR FROM j.payment_date)::int AS year,
         p.id AS contractor_id,
         p.first_name,
         SUM(j.price) AS total
  FROM jobs j
  JOIN contracts c ON c.id = j.contract_id
  JOIN profiles p ON p.id = c.contractor_id
  WHERE j.paid = TRUE
  GROUP BY year, p.id, p.first_name
),
ranked AS (
  SELECT year, contractor_id, first_name, total,
         ROW_NUMBER() OVER (PARTITION BY year ORDER BY total DESC, contractor_id ASC) AS rn
  FROM yearly
)
SELECT year, contractor_id, first_name, total::TEXT AS total_earned
FROM ranked
WHERE rn = 1
ORDER BY year ASC;`,
};

export const extraSqlProblems: SqlProblem[] = [
  highestPaidContractor,
  monthsNoPayments,
  cancellationRate,
  avgDaysToPayment,
  clientsWithoutActive,
  topEarnerPerYear,
];
