// Deterministic-ish generators for performance tests.
// Use a tiny LCG so runs are reproducible per call.

export function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

export interface PayoutEvent {
  type: 'JOB_CREATED' | 'JOB_PAID' | 'JOB_CANCELLED';
  jobId: string;
  contractId?: string;
  amount?: number;
}

export function generate100kEvents(): PayoutEvent[] {
  const rng = makeRng(42);
  const totalEvents = 100_000;
  const contractCount = 1000;
  const events: PayoutEvent[] = [];
  const createdJobs: string[] = [];

  for (let i = 0; i < totalEvents; i++) {
    const roll = rng();
    if (roll < 0.6 || createdJobs.length === 0) {
      const jobId = `j${i}`;
      const contractId = `c${Math.floor(rng() * contractCount)}`;
      const amount = 1 + Math.floor(rng() * 1000);
      createdJobs.push(jobId);
      events.push({ type: 'JOB_CREATED', jobId, contractId, amount });
    } else if (roll < 0.9) {
      const idx = Math.floor(rng() * createdJobs.length);
      events.push({ type: 'JOB_PAID', jobId: createdJobs[idx] });
    } else {
      const idx = Math.floor(rng() * createdJobs.length);
      events.push({ type: 'JOB_CANCELLED', jobId: createdJobs[idx] });
    }
  }
  return events;
}

export interface SqlSeedRow {
  table: 'profiles' | 'contracts' | 'jobs';
  values: unknown[];
}

const PROFESSIONS = [
  'Programmer', 'Musician', 'Architect', 'Designer', 'Writer',
  'Photographer', 'Translator', 'Accountant', 'Lawyer', 'Consultant',
];

export function generate10kSqlRows(): { sql: string; expectedTopProfession: string } {
  const rng = makeRng(123);
  const NUM_PROFILES = 10_000;
  const NUM_CONTRACTS = 5_000;
  const NUM_JOBS = 10_000;

  const lines: string[] = [];
  const totalsByProfession: Record<string, number> = {};
  PROFESSIONS.forEach(p => { totalsByProfession[p] = 0; });

  // ~half clients, half contractors
  for (let i = 1; i <= NUM_PROFILES; i++) {
    const isContractor = i % 2 === 0;
    if (isContractor) {
      const prof = PROFESSIONS[Math.floor(rng() * PROFESSIONS.length)];
      lines.push(`INSERT INTO profiles (id, type, first_name, profession) VALUES (${i}, 'contractor', 'C${i}', '${prof}');`);
    } else {
      lines.push(`INSERT INTO profiles (id, type, first_name, profession) VALUES (${i}, 'client', 'Cl${i}', NULL);`);
    }
  }

  // contracts: random client + contractor pair
  for (let i = 1; i <= NUM_CONTRACTS; i++) {
    // client ids are odd: 1,3,5,...   contractor ids are even: 2,4,6,...
    const client = 1 + 2 * Math.floor(rng() * (NUM_PROFILES / 2));
    const contractor = 2 + 2 * Math.floor(rng() * (NUM_PROFILES / 2));
    lines.push(`INSERT INTO contracts (id, status, client_id, contractor_id) VALUES (${i}, 'in_progress', ${client}, ${contractor});`);
  }

  // pre-compute contractor profession per contract by re-running same rng sequence is too messy;
  // instead, fetch contractor profession via JS by mirroring above. Simpler: rebuild map.
  const contractorProfession: Record<number, string> = {};
  const rng2 = makeRng(123);
  for (let i = 1; i <= NUM_PROFILES; i++) {
    const isContractor = i % 2 === 0;
    if (isContractor) {
      const prof = PROFESSIONS[Math.floor(rng2() * PROFESSIONS.length)];
      contractorProfession[i] = prof;
    }
  }
  // ...and re-walk contracts:
  const contractContractor: Record<number, number> = {};
  for (let i = 1; i <= NUM_CONTRACTS; i++) {
    const _client = 1 + 2 * Math.floor(rng2() * (NUM_PROFILES / 2));
    void _client;
    const contractor = 2 + 2 * Math.floor(rng2() * (NUM_PROFILES / 2));
    contractContractor[i] = contractor;
  }

  // jobs spread over 2022-01-01 to 2024-12-31
  const startMs = Date.UTC(2022, 0, 1);
  const endMs = Date.UTC(2024, 11, 31);
  for (let i = 1; i <= NUM_JOBS; i++) {
    const contractId = 1 + Math.floor(rng() * NUM_CONTRACTS);
    const price = 10 + Math.floor(rng() * 990);
    const paid = rng() > 0.2; // 80% paid
    const ts = startMs + Math.floor(rng() * (endMs - startMs));
    const paymentDate = new Date(ts).toISOString().slice(0, 19).replace('T', ' ');
    if (paid) {
      const contractor = contractContractor[contractId];
      const prof = contractorProfession[contractor];
      totalsByProfession[prof] += price;
    }
    lines.push(
      `INSERT INTO jobs (id, description, price, paid, payment_date, contract_id) VALUES ` +
      `(${i}, 'job ${i}', ${price}, ${paid}, ${paid ? `'${paymentDate}'` : 'NULL'}, ${contractId});`
    );
  }

  // pick the expected top profession (max total, tie-break alphabetical)
  let topProf = PROFESSIONS[0];
  let topVal = totalsByProfession[topProf];
  for (const p of PROFESSIONS) {
    if (totalsByProfession[p] > topVal ||
        (totalsByProfession[p] === topVal && p < topProf)) {
      topProf = p;
      topVal = totalsByProfession[p];
    }
  }

  return { sql: lines.join('\n'), expectedTopProfession: topProf };
}
