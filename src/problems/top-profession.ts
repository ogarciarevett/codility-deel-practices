import { generate10kSqlRows } from '../lib/generators';
import type { SqlProblem } from './types';
import { DEEL_SCHEMA_DDL } from './types';

const statement = `# Top Profession by Period

Given the schema below, write a SQL query that returns the **single profession** with the highest total earnings from **paid** jobs whose \`payment_date\` falls within a given period.

The query must return **exactly one row** with columns \`profession\` and \`total_earned\`. If multiple professions tie, return the one whose name comes first alphabetically. If no rows match, return zero rows (do not return NULL).

You can reference the parameters as \`:start_date\` and \`:end_date\` — the runner will bind them.

## Schema

\`\`\`sql
profiles (
  id           SERIAL PRIMARY KEY,
  type         TEXT NOT NULL,   -- 'client' or 'contractor'
  first_name   TEXT NOT NULL,
  profession   TEXT,            -- NULL for clients
  balance      NUMERIC NOT NULL DEFAULT 0
);

contracts (
  id             SERIAL PRIMARY KEY,
  status         TEXT NOT NULL,   -- 'new' | 'in_progress' | 'terminated'
  client_id      INT NOT NULL REFERENCES profiles(id),
  contractor_id  INT NOT NULL REFERENCES profiles(id)
);

jobs (
  id            SERIAL PRIMARY KEY,
  description   TEXT NOT NULL,
  price         NUMERIC NOT NULL,
  paid          BOOLEAN NOT NULL DEFAULT FALSE,
  payment_date  TIMESTAMP,
  contract_id   INT NOT NULL REFERENCES contracts(id)
);
\`\`\`

## Notes
- Filter on \`payment_date\`, not on any other date column.
- Only \`paid = TRUE\` jobs count.
- \`payment_date BETWEEN :start_date AND :end_date\` is inclusive on both ends.
- The profession lives on the **contractor** profile of the contract, not the client.
`;

const schemaDDL = DEEL_SCHEMA_DDL;

const referenceSolution = `SELECT p.profession, SUM(j.price)::TEXT AS total_earned
FROM jobs j
JOIN contracts c ON c.id = j.contract_id
JOIN profiles p ON p.id = c.contractor_id
WHERE j.paid = TRUE
  AND j.payment_date BETWEEN :start_date AND :end_date
GROUP BY p.profession
ORDER BY SUM(j.price) DESC, p.profession ASC
LIMIT 1;`;

export const topProfession: SqlProblem = {
  id: 'top-profession',
  title: 'Top Profession by Period',
  kind: 'sql',
  language: 'sql-postgres',
  statement,
  stub: `-- Write your query below. Use :start_date and :end_date as parameters.
SELECT profession, total_earned
FROM ...`,
  schemaDDL,
  exampleTests: [
    {
      name: 'single profession wins clearly',
      params: { start_date: '2024-01-01', end_date: '2024-12-31' },
      seed: `
        INSERT INTO profiles (type, first_name, profession) VALUES
          ('client', 'Alice', NULL), ('contractor', 'Bob', 'Programmer'),
          ('contractor', 'Cara', 'Musician');
        INSERT INTO contracts (status, client_id, contractor_id) VALUES
          ('in_progress', 1, 2), ('in_progress', 1, 3);
        INSERT INTO jobs (description, price, paid, payment_date, contract_id) VALUES
          ('a', 500, true, '2024-06-01', 1),
          ('b', 300, true, '2024-07-01', 1),
          ('c', 200, true, '2024-08-01', 2);
      `,
      expected: [{ profession: 'Programmer', total_earned: '800' }],
    },
    {
      name: 'tie broken alphabetically',
      params: { start_date: '2024-01-01', end_date: '2024-12-31' },
      seed: `
        INSERT INTO profiles (type, first_name, profession) VALUES
          ('client', 'A', NULL),
          ('contractor', 'X', 'Zookeeper'),
          ('contractor', 'Y', 'Architect');
        INSERT INTO contracts (status, client_id, contractor_id) VALUES
          ('in_progress', 1, 2), ('in_progress', 1, 3);
        INSERT INTO jobs (description, price, paid, payment_date, contract_id) VALUES
          ('a', 100, true, '2024-06-01', 1),
          ('b', 100, true, '2024-06-01', 2);
      `,
      expected: [{ profession: 'Architect', total_earned: '100' }],
    },
    {
      name: 'empty range returns no rows',
      params: { start_date: '1999-01-01', end_date: '1999-12-31' },
      seed: `
        INSERT INTO profiles (type, first_name, profession) VALUES
          ('client', 'A', NULL), ('contractor', 'B', 'Programmer');
        INSERT INTO contracts (status, client_id, contractor_id) VALUES ('in_progress', 1, 2);
        INSERT INTO jobs (description, price, paid, payment_date, contract_id) VALUES
          ('a', 100, true, '2024-06-01', 1);
      `,
      expected: [],
    },
  ],
  hiddenCorrectnessTests: [
    {
      name: 'unpaid jobs in range are excluded',
      params: { start_date: '2024-01-01', end_date: '2024-12-31' },
      seed: `
        INSERT INTO profiles (type, first_name, profession) VALUES
          ('client', 'A', NULL),
          ('contractor', 'B', 'Programmer'),
          ('contractor', 'C', 'Musician');
        INSERT INTO contracts (status, client_id, contractor_id) VALUES
          ('in_progress', 1, 2), ('in_progress', 1, 3);
        INSERT INTO jobs (description, price, paid, payment_date, contract_id) VALUES
          ('a', 9999, false, '2024-06-01', 1),
          ('b', 100, true, '2024-06-01', 2);
      `,
      expected: [{ profession: 'Musician', total_earned: '100' }],
    },
    {
      name: 'boundary dates are inclusive',
      params: { start_date: '2024-06-01', end_date: '2024-08-31' },
      seed: `
        INSERT INTO profiles (type, first_name, profession) VALUES
          ('client', 'A', NULL),
          ('contractor', 'B', 'Programmer');
        INSERT INTO contracts (status, client_id, contractor_id) VALUES
          ('in_progress', 1, 2);
        INSERT INTO jobs (description, price, paid, payment_date, contract_id) VALUES
          ('start-day', 100, true, '2024-06-01 00:00:00', 1),
          ('end-day',   200, true, '2024-08-31 00:00:00', 1),
          ('outside',   500, true, '2024-09-01', 1);
      `,
      expected: [{ profession: 'Programmer', total_earned: '300' }],
    },
    {
      name: 'paid jobs on terminated contracts still count',
      params: { start_date: '2024-01-01', end_date: '2024-12-31' },
      seed: `
        INSERT INTO profiles (type, first_name, profession) VALUES
          ('client', 'A', NULL),
          ('contractor', 'B', 'Programmer');
        INSERT INTO contracts (status, client_id, contractor_id) VALUES
          ('terminated', 1, 2);
        INSERT INTO jobs (description, price, paid, payment_date, contract_id) VALUES
          ('a', 700, true, '2024-06-01', 1);
      `,
      expected: [{ profession: 'Programmer', total_earned: '700' }],
    },
    {
      name: 'one contractor across multiple contracts aggregates',
      params: { start_date: '2024-01-01', end_date: '2024-12-31' },
      seed: `
        INSERT INTO profiles (type, first_name, profession) VALUES
          ('client', 'Cl1', NULL),
          ('client', 'Cl2', NULL),
          ('contractor', 'B', 'Programmer'),
          ('contractor', 'D', 'Musician');
        INSERT INTO contracts (status, client_id, contractor_id) VALUES
          ('in_progress', 1, 3),
          ('in_progress', 2, 3),
          ('in_progress', 1, 4);
        INSERT INTO jobs (description, price, paid, payment_date, contract_id) VALUES
          ('p1', 100, true, '2024-03-01', 1),
          ('p2', 150, true, '2024-04-01', 2),
          ('m1', 200, true, '2024-05-01', 3);
      `,
      expected: [{ profession: 'Programmer', total_earned: '250' }],
    },
    {
      name: 'NULL payment_date excluded even if paid is true',
      params: { start_date: '2024-01-01', end_date: '2024-12-31' },
      seed: `
        INSERT INTO profiles (type, first_name, profession) VALUES
          ('client', 'A', NULL),
          ('contractor', 'B', 'Programmer'),
          ('contractor', 'C', 'Musician');
        INSERT INTO contracts (status, client_id, contractor_id) VALUES
          ('in_progress', 1, 2),
          ('in_progress', 1, 3);
        INSERT INTO jobs (description, price, paid, payment_date, contract_id) VALUES
          ('null-paid', 9999, true, NULL, 1),
          ('valid',     100,  true, '2024-06-01', 2);
      `,
      expected: [{ profession: 'Musician', total_earned: '100' }],
    },
  ],
  performanceTests: [
    {
      name: '10k jobs over 3 years',
      buildSeed: () => generate10kSqlRows().sql,
      params: { start_date: '2022-01-01', end_date: '2024-12-31' },
      validate: (rows) => {
        const expected = generate10kSqlRows().expectedTopProfession;
        if (rows.length !== 1) return `expected 1 row, got ${rows.length}`;
        if (String(rows[0].profession) !== expected) {
          return `expected profession=${expected}, got ${String(rows[0].profession)}`;
        }
        return null;
      },
      maxDurationMs: 1500,
    },
  ],
  referenceSolution,
  tutorial: {
    steps: [
      {
        title: 'Paso 1 — FROM jobs + los dos JOINs',
        why: `Empezamos por la tabla "gorda" (\`jobs\`) y vamos uniendo lo que necesitamos. Para llegar al \`profession\` del contractor: **jobs → contracts → profiles**.

⚠️ La trampa: la profesión vive en el **contractor**, no en el client. Si joineas \`profiles\` por \`client_id\` el query "funciona" (no da error de SQL) pero devuelve resultados sin sentido.

Aún no filtramos ni agrupamos — primero el shape de la query.`,
        codeAfter: `SELECT p.profession, j.price
FROM jobs j
JOIN contracts c ON c.id = j.contract_id
JOIN profiles p ON p.id = c.contractor_id;`,
      },
      {
        title: 'Paso 2 — WHERE: dos filtros estrictos',
        why: `Filtramos **antes** de agrupar. Dos condiciones:

1. \`j.paid = TRUE\` — los jobs no pagados no cuentan, ni siquiera si su \`payment_date\` cae en rango.
2. \`j.payment_date BETWEEN :start_date AND :end_date\` — inclusivo en ambos extremos.

⚠️ Trampa: la spec dice explícitamente "Filter on \`payment_date\`, not on any other date column". Es facilísimo equivocarse y filtrar por algún otro campo si la tabla tuviera \`created_at\` o similar.`,
        codeAfter: `SELECT p.profession, j.price
FROM jobs j
JOIN contracts c ON c.id = j.contract_id
JOIN profiles p ON p.id = c.contractor_id
WHERE j.paid = TRUE
  AND j.payment_date BETWEEN :start_date AND :end_date;`,
      },
      {
        title: 'Paso 3 — GROUP BY profession + SUM',
        why: `Una fila por profession. \`SUM(j.price)\` agrega todos los pagos de esa profession en el rango.

\`::TEXT\` castea el numérico a string. Los engines de Postgres (incluido PGlite) devuelven \`NUMERIC\` como string, y la spec lo espera como string en el resultado (\`'800'\` no \`800\`). Castear explícitamente evita ambigüedad cross-engine.

El SELECT cambia: ya no devolvemos \`j.price\` por fila, sino \`SUM(j.price)\` agregado.`,
        codeAfter: `SELECT p.profession, SUM(j.price)::TEXT AS total_earned
FROM jobs j
JOIN contracts c ON c.id = j.contract_id
JOIN profiles p ON p.id = c.contractor_id
WHERE j.paid = TRUE
  AND j.payment_date BETWEEN :start_date AND :end_date
GROUP BY p.profession;`,
      },
      {
        title: 'Paso 4 — ORDER BY: el tie-break alfabético',
        why: `Doble criterio:

1. \`SUM(j.price) DESC\` — primero, la profession con más ingresos arriba.
2. \`p.profession ASC\` — desempate alfabético.

⚠️ La spec exige el tie-break ASC. Sin él, dos professions con el mismo total devolverían cualquiera (depende del plan del engine), y un test oculto va a fallar.

Truco: puedes usar \`ORDER BY 2 DESC, 1 ASC\` (referencias por posición) — más corto pero menos legible. Para una entrevista, mejor usa los nombres.`,
        codeAfter: `SELECT p.profession, SUM(j.price)::TEXT AS total_earned
FROM jobs j
JOIN contracts c ON c.id = j.contract_id
JOIN profiles p ON p.id = c.contractor_id
WHERE j.paid = TRUE
  AND j.payment_date BETWEEN :start_date AND :end_date
GROUP BY p.profession
ORDER BY SUM(j.price) DESC, p.profession ASC;`,
      },
      {
        title: 'Paso 5 — LIMIT 1',
        why: `Solo queremos UNA fila. Sin \`LIMIT\`, devolveríamos todas las professions ordenadas.

Bonus: si no hay matches (período vacío, todos los jobs no pagados, etc.) el query devuelve **0 filas** — exactamente lo que la spec pide ("return zero rows, do not return NULL"). No necesitas un \`COALESCE\` ni un \`CASE\` extra.

Caso extremo: ¿y si \`profession\` es NULL para algún contractor? El \`GROUP BY profession\` los agrupa en una fila con \`profession = NULL\`, y si esa fila gana el ORDER BY... la devolverías. La spec no es explícita aquí — depende de si los clients (con profession NULL) pueden tener contratos como contractor. En este caso particular no pueden, así que estás a salvo.`,
        codeAfter: `SELECT p.profession, SUM(j.price)::TEXT AS total_earned
FROM jobs j
JOIN contracts c ON c.id = j.contract_id
JOIN profiles p ON p.id = c.contractor_id
WHERE j.paid = TRUE
  AND j.payment_date BETWEEN :start_date AND :end_date
GROUP BY p.profession
ORDER BY SUM(j.price) DESC, p.profession ASC
LIMIT 1;`,
      },
    ],
  },
};
