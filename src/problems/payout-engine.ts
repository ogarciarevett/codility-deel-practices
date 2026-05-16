import { generate100kEvents, type PayoutEvent } from '../lib/generators';
import type { JsProblem } from './types';

const statement = `# Payout Engine

You are building the settlement core for a payments platform. You receive a chronologically-ordered stream of events describing the lifecycle of jobs between clients and contractors.

Each event has a \`type\` field, one of: \`JOB_CREATED\`, \`JOB_PAID\`, \`JOB_CANCELLED\`.

\`\`\`
{ type: 'JOB_CREATED',   jobId: string, contractId: string, amount: number }
{ type: 'JOB_PAID',      jobId: string }
{ type: 'JOB_CANCELLED', jobId: string }
\`\`\`

Implement \`solution(events)\` returning an object:

\`\`\`
{
  totalPaid: number,                  // sum of amounts of valid JOB_PAID events
  jobsPaidCount: number,              // count of valid JOB_PAID events
  contractsWithUnpaidJobs: string[]   // contractIds with >=1 created-but-not-paid job
                                      //   that wasn't cancelled, sorted ASC
}
\`\`\`

## Rules
- A \`JOB_PAID\` is **valid** only if the corresponding \`JOB_CREATED\` was seen first and the job has not been cancelled.
- \`JOB_CANCELLED\` removes the job from all subsequent considerations (a later \`JOB_PAID\` for it is ignored).
- Duplicate \`JOB_PAID\` events for the same job count only once.
- \`contractsWithUnpaidJobs\` must be sorted alphabetically and contain no duplicates.

## Constraints
- 0 <= N <= 100,000
- All ids are strings of length <= 16
- amount is an integer in [1, 10^6]
`;

const referenceSolution = `function solution(events) {
  const jobs = new Map();        // jobId -> { contractId, amount, state }
  const paidJobIds = new Set();

  for (const e of events) {
    if (e.type === 'JOB_CREATED') {
      if (!jobs.has(e.jobId)) {
        jobs.set(e.jobId, { contractId: e.contractId, amount: e.amount, state: 'created' });
      }
    } else if (e.type === 'JOB_CANCELLED') {
      const job = jobs.get(e.jobId);
      if (job && job.state === 'created') job.state = 'cancelled';
    } else if (e.type === 'JOB_PAID') {
      const job = jobs.get(e.jobId);
      if (job && job.state === 'created' && !paidJobIds.has(e.jobId)) {
        paidJobIds.add(e.jobId);
        job.state = 'paid';
      }
    }
  }

  let totalPaid = 0;
  const unpaidContracts = new Set();
  for (const [, job] of jobs) {
    if (job.state === 'paid') totalPaid += job.amount;
    else if (job.state === 'created') unpaidContracts.add(job.contractId);
  }

  return {
    totalPaid,
    jobsPaidCount: paidJobIds.size,
    contractsWithUnpaidJobs: [...unpaidContracts].sort(),
  };
}`;

export const payoutEngine: JsProblem = {
  id: 'payout-engine',
  title: 'Payout Engine',
  kind: 'js',
  language: 'javascript',
  expectedComplexity: 'O(N) average',
  statement,
  stub: `function solution(events) {
  // your code here
}`,
  exampleTests: [
    {
      name: 'simple flow',
      input: [
        { type: 'JOB_CREATED', jobId: 'j1', contractId: 'cA', amount: 100 },
        { type: 'JOB_CREATED', jobId: 'j2', contractId: 'cA', amount: 50 },
        { type: 'JOB_PAID', jobId: 'j1' },
      ] satisfies PayoutEvent[],
      expected: { totalPaid: 100, jobsPaidCount: 1, contractsWithUnpaidJobs: ['cA'] },
    },
    {
      name: 'cancellation overrides later pay',
      input: [
        { type: 'JOB_CREATED', jobId: 'j1', contractId: 'cA', amount: 100 },
        { type: 'JOB_CANCELLED', jobId: 'j1' },
        { type: 'JOB_PAID', jobId: 'j1' },
      ] satisfies PayoutEvent[],
      expected: { totalPaid: 0, jobsPaidCount: 0, contractsWithUnpaidJobs: [] },
    },
    {
      name: 'empty input',
      input: [],
      expected: { totalPaid: 0, jobsPaidCount: 0, contractsWithUnpaidJobs: [] },
    },
  ],
  hiddenCorrectnessTests: [
    {
      name: 'duplicate paid events',
      input: [
        { type: 'JOB_CREATED', jobId: 'j1', contractId: 'cA', amount: 200 },
        { type: 'JOB_PAID', jobId: 'j1' },
        { type: 'JOB_PAID', jobId: 'j1' },
      ] satisfies PayoutEvent[],
      expected: { totalPaid: 200, jobsPaidCount: 1, contractsWithUnpaidJobs: [] },
    },
    {
      name: 'pay before create is ignored',
      input: [
        { type: 'JOB_PAID', jobId: 'j1' },
        { type: 'JOB_CREATED', jobId: 'j1', contractId: 'cA', amount: 100 },
      ] satisfies PayoutEvent[],
      expected: { totalPaid: 0, jobsPaidCount: 0, contractsWithUnpaidJobs: ['cA'] },
    },
    {
      name: 'multiple contracts mixed states',
      input: [
        { type: 'JOB_CREATED', jobId: 'j1', contractId: 'cZ', amount: 10 },
        { type: 'JOB_CREATED', jobId: 'j2', contractId: 'cA', amount: 20 },
        { type: 'JOB_CREATED', jobId: 'j3', contractId: 'cM', amount: 30 },
        { type: 'JOB_PAID', jobId: 'j1' },
        { type: 'JOB_PAID', jobId: 'j2' },
      ] satisfies PayoutEvent[],
      expected: { totalPaid: 30, jobsPaidCount: 2, contractsWithUnpaidJobs: ['cM'] },
    },
    {
      name: 'contract with both paid and unpaid jobs',
      input: [
        { type: 'JOB_CREATED', jobId: 'j1', contractId: 'cA', amount: 10 },
        { type: 'JOB_CREATED', jobId: 'j2', contractId: 'cA', amount: 20 },
        { type: 'JOB_PAID', jobId: 'j1' },
      ] satisfies PayoutEvent[],
      expected: { totalPaid: 10, jobsPaidCount: 1, contractsWithUnpaidJobs: ['cA'] },
    },
    {
      name: 'all cancelled',
      input: [
        { type: 'JOB_CREATED', jobId: 'j1', contractId: 'cA', amount: 10 },
        { type: 'JOB_CANCELLED', jobId: 'j1' },
      ] satisfies PayoutEvent[],
      expected: { totalPaid: 0, jobsPaidCount: 0, contractsWithUnpaidJobs: [] },
    },
    {
      name: 'cancel after pay does not refund',
      input: [
        { type: 'JOB_CREATED', jobId: 'j1', contractId: 'cA', amount: 100 },
        { type: 'JOB_PAID', jobId: 'j1' },
        { type: 'JOB_CANCELLED', jobId: 'j1' },
      ] satisfies PayoutEvent[],
      expected: { totalPaid: 100, jobsPaidCount: 1, contractsWithUnpaidJobs: [] },
    },
    {
      name: 'duplicate created keeps first',
      input: [
        { type: 'JOB_CREATED', jobId: 'j1', contractId: 'cA', amount: 100 },
        { type: 'JOB_CREATED', jobId: 'j1', contractId: 'cB', amount: 999 },
        { type: 'JOB_PAID', jobId: 'j1' },
      ] satisfies PayoutEvent[],
      expected: { totalPaid: 100, jobsPaidCount: 1, contractsWithUnpaidJobs: [] },
    },
    {
      name: 'unpaid contracts are unique and sorted',
      input: [
        { type: 'JOB_CREATED', jobId: 'j1', contractId: 'cB', amount: 1 },
        { type: 'JOB_CREATED', jobId: 'j2', contractId: 'cA', amount: 1 },
        { type: 'JOB_CREATED', jobId: 'j3', contractId: 'cB', amount: 1 },
      ] satisfies PayoutEvent[],
      expected: { totalPaid: 0, jobsPaidCount: 0, contractsWithUnpaidJobs: ['cA', 'cB'] },
    },
  ],
  performanceTests: [
    {
      name: '100k mixed events',
      buildInput: () => generate100kEvents(),
      maxDurationMs: 800,
    },
  ],
  referenceSolution,
  tutorial: {
    steps: [
      {
        title: 'Paso 1 — Estructuras de datos',
        why: `Antes de tocar el loop, decidimos cómo almacenamos los jobs.

- \`Map<jobId, …>\` permite mirar un job por id en **O(1)**. Usar \`Array.find\` aquí es la trampa clásica que vuelve el algoritmo O(N²).
- \`Set<jobId>\` para detectar duplicados de \`JOB_PAID\` también en O(1).

El \`return\` con placeholders te permite ejecutar "Run Example Tests" en cualquier paso del tutorial — todo compila aunque aún falten reglas.`,
        codeAfter: `function solution(events) {
  const jobs = new Map();        // jobId -> { contractId, amount, state }
  const paidJobIds = new Set();  // jobIds que ya pagamos (dedup)

  return { totalPaid: 0, jobsPaidCount: 0, contractsWithUnpaidJobs: [] };
}`,
      },
      {
        title: 'Paso 2 — Loop sobre los eventos',
        why: `Procesamos el stream **una sola vez** y ramificamos por \`type\`. El orden importa: cada evento se aplica en el orden que llega y puede ser ignorado si la transición no es legal.

Aún no hacemos nada dentro de las ramas — eso viene en los siguientes pasos.`,
        codeAfter: `function solution(events) {
  const jobs = new Map();
  const paidJobIds = new Set();

  for (const e of events) {
    if (e.type === 'JOB_CREATED') {
      // TODO
    } else if (e.type === 'JOB_CANCELLED') {
      // TODO
    } else if (e.type === 'JOB_PAID') {
      // TODO
    }
  }

  return { totalPaid: 0, jobsPaidCount: 0, contractsWithUnpaidJobs: [] };
}`,
      },
      {
        title: 'Paso 3 — JOB_CREATED: el primero gana',
        why: `Cuando llega un \`CREATED\`, guardamos el job en el \`Map\` con estado \`'created'\`.

¿Por qué la guarda \`!jobs.has(e.jobId)\`? Porque si llega un segundo \`CREATED\` para el mismo \`jobId\`, **el primero gana** — no queremos sobreescribir un job que pudo haber sido pagado o cancelado. Esto es la convención más segura cuando la spec no es explícita.`,
        codeAfter: `function solution(events) {
  const jobs = new Map();
  const paidJobIds = new Set();

  for (const e of events) {
    if (e.type === 'JOB_CREATED') {
      if (!jobs.has(e.jobId)) {
        jobs.set(e.jobId, {
          contractId: e.contractId,
          amount: e.amount,
          state: 'created',
        });
      }
    } else if (e.type === 'JOB_CANCELLED') {
      // TODO
    } else if (e.type === 'JOB_PAID') {
      // TODO
    }
  }

  return { totalPaid: 0, jobsPaidCount: 0, contractsWithUnpaidJobs: [] };
}`,
      },
      {
        title: 'Paso 4 — JOB_CANCELLED: solo si sigue "created"',
        why: `Esta es **la trampa sutil** del problema.

La spec dice "JOB_CANCELLED remueve el job de consideraciones subsiguientes". NO dice "reembolsa". Si el job ya está \`'paid'\`, el dinero se movió y un cancel tardío no lo deshace.

Por eso la guarda \`job.state === 'created'\`: solo cancelamos jobs que aún no se han pagado. Si el job no existe (nunca vimos su CREATED), también ignoramos.

Sin esta guarda, el test oculto "cancel after pay does not refund" falla y pierdes ~9% del score.`,
        codeAfter: `function solution(events) {
  const jobs = new Map();
  const paidJobIds = new Set();

  for (const e of events) {
    if (e.type === 'JOB_CREATED') {
      if (!jobs.has(e.jobId)) {
        jobs.set(e.jobId, {
          contractId: e.contractId,
          amount: e.amount,
          state: 'created',
        });
      }
    } else if (e.type === 'JOB_CANCELLED') {
      const job = jobs.get(e.jobId);
      if (job && job.state === 'created') {
        job.state = 'cancelled';
      }
    } else if (e.type === 'JOB_PAID') {
      // TODO
    }
  }

  return { totalPaid: 0, jobsPaidCount: 0, contractsWithUnpaidJobs: [] };
}`,
      },
      {
        title: 'Paso 5 — JOB_PAID: tres condiciones tienen que pasar',
        why: `Tres guardas en una sola línea:

1. \`job\` existe — vimos su \`CREATED\` antes (ignora PAID huérfanos).
2. \`job.state === 'created'\` — ni cancelado ni ya pagado.
3. \`!paidJobIds.has(e.jobId)\` — dedup en O(1) (usar \`Array.includes\` aquí es el típico O(N²)).

Si las tres pasan: añadimos al \`Set\` y marcamos el job como \`'paid'\`. El Set sirve doble función: dedup y count final.`,
        codeAfter: `function solution(events) {
  const jobs = new Map();
  const paidJobIds = new Set();

  for (const e of events) {
    if (e.type === 'JOB_CREATED') {
      if (!jobs.has(e.jobId)) {
        jobs.set(e.jobId, {
          contractId: e.contractId,
          amount: e.amount,
          state: 'created',
        });
      }
    } else if (e.type === 'JOB_CANCELLED') {
      const job = jobs.get(e.jobId);
      if (job && job.state === 'created') {
        job.state = 'cancelled';
      }
    } else if (e.type === 'JOB_PAID') {
      const job = jobs.get(e.jobId);
      if (job && job.state === 'created' && !paidJobIds.has(e.jobId)) {
        paidJobIds.add(e.jobId);
        job.state = 'paid';
      }
    }
  }

  return { totalPaid: 0, jobsPaidCount: 0, contractsWithUnpaidJobs: [] };
}`,
      },
      {
        title: 'Paso 6 — Tally final: una pasada sobre el Map',
        why: `Después del loop, cada job está en uno de tres estados finales: \`'paid'\`, \`'created'\` (nunca pagado y nunca cancelado), o \`'cancelled'\`.

- \`'paid'\` → suma su \`amount\` a \`totalPaid\`
- \`'created'\` → su \`contractId\` va al \`Set\` de contratos con jobs pendientes
- \`'cancelled'\` → no contribuye

Usamos \`Set\` para los contratos: deduplica automáticamente en O(1). Es la SEGUNDA pasada (una sobre eventos, una sobre el Map de jobs) — sigue siendo O(N) total.`,
        codeAfter: `function solution(events) {
  const jobs = new Map();
  const paidJobIds = new Set();

  for (const e of events) {
    if (e.type === 'JOB_CREATED') {
      if (!jobs.has(e.jobId)) {
        jobs.set(e.jobId, {
          contractId: e.contractId,
          amount: e.amount,
          state: 'created',
        });
      }
    } else if (e.type === 'JOB_CANCELLED') {
      const job = jobs.get(e.jobId);
      if (job && job.state === 'created') {
        job.state = 'cancelled';
      }
    } else if (e.type === 'JOB_PAID') {
      const job = jobs.get(e.jobId);
      if (job && job.state === 'created' && !paidJobIds.has(e.jobId)) {
        paidJobIds.add(e.jobId);
        job.state = 'paid';
      }
    }
  }

  let totalPaid = 0;
  const unpaidContracts = new Set();
  for (const [, job] of jobs) {
    if (job.state === 'paid') {
      totalPaid += job.amount;
    } else if (job.state === 'created') {
      unpaidContracts.add(job.contractId);
    }
  }

  return { totalPaid: 0, jobsPaidCount: 0, contractsWithUnpaidJobs: [] };
}`,
      },
      {
        title: 'Paso 7 — Return con sort final',
        why: `\`paidJobIds.size\` ya es el count exacto — el \`Set\` se encargó del dedup.

\`[...unpaidContracts].sort()\` convierte el \`Set\` a array y ordena alfabéticamente. Los Sets son únicos por construcción, así que no hay duplicados que filtrar.

**Por qué el sort va aquí y no dentro del loop**: \`K log K\` donde K = contratos únicos ≤ N. Hacerlo dentro del loop principal sería O(N · K log K) — un O(N²) garantizado.`,
        codeAfter: `function solution(events) {
  const jobs = new Map();
  const paidJobIds = new Set();

  for (const e of events) {
    if (e.type === 'JOB_CREATED') {
      if (!jobs.has(e.jobId)) {
        jobs.set(e.jobId, {
          contractId: e.contractId,
          amount: e.amount,
          state: 'created',
        });
      }
    } else if (e.type === 'JOB_CANCELLED') {
      const job = jobs.get(e.jobId);
      if (job && job.state === 'created') {
        job.state = 'cancelled';
      }
    } else if (e.type === 'JOB_PAID') {
      const job = jobs.get(e.jobId);
      if (job && job.state === 'created' && !paidJobIds.has(e.jobId)) {
        paidJobIds.add(e.jobId);
        job.state = 'paid';
      }
    }
  }

  let totalPaid = 0;
  const unpaidContracts = new Set();
  for (const [, job] of jobs) {
    if (job.state === 'paid') {
      totalPaid += job.amount;
    } else if (job.state === 'created') {
      unpaidContracts.add(job.contractId);
    }
  }

  return {
    totalPaid,
    jobsPaidCount: paidJobIds.size,
    contractsWithUnpaidJobs: [...unpaidContracts].sort(),
  };
}`,
      },
    ],
  },
};
