import type { TutorialStep } from './types';

// =============================================================================
// JS PROBLEMS — extra-js.ts
// =============================================================================

const timeTracker: TutorialStep[] = [
  {
    title: 'Paso 1 — Dos Maps, no Arrays',
    why: `Necesitamos buscar por \`contractorId\` en O(1). \`open\` guarda el timestamp del último \`CLOCK_IN\` no cerrado por contractor; \`totals\` acumula los milisegundos cerrados.

Devolver \`{}\` al final mantiene el código compilable mientras vas armando la lógica.`,
    codeAfter: `function solution(events) {
  const open = new Map();    // contractorId -> ts del último CLOCK_IN abierto
  const totals = new Map();  // contractorId -> total ms cerrados
  return Object.fromEntries(totals);
}`,
  },
  {
    title: 'Paso 2 — CLOCK_IN: el primero gana mientras no haya OUT',
    why: `Si ya hay un \`CLOCK_IN\` abierto para este contractor, ignoramos el nuevo. Esto cubre el test "second clock_in before matching clock_out is a no-op".

Más fácil con \`open.has\` que con cualquier flag — la presencia en el Map ya significa "hay sesión abierta".`,
    codeAfter: `function solution(events) {
  const open = new Map();
  const totals = new Map();
  for (const e of events) {
    if (e.type === 'CLOCK_IN') {
      if (!open.has(e.contractorId)) {
        open.set(e.contractorId, e.ts);
      }
    }
  }
  return Object.fromEntries(totals);
}`,
  },
  {
    title: 'Paso 3 — CLOCK_OUT: emparejar y sumar el delta',
    why: `Si hay un \`CLOCK_IN\` abierto, calculamos \`delta = ts - start\` y lo acumulamos en \`totals\`. \`open.delete\` cierra la sesión.

Si no hay open, ignoramos — cubre "orphan clock_out ignored".`,
    codeAfter: `function solution(events) {
  const open = new Map();
  const totals = new Map();
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
  },
  {
    title: 'Paso 4 — Sesiones abiertas al final se descartan solas',
    why: `\`totals\` solo contiene contractors con AL MENOS una sesión cerrada. \`Object.fromEntries(Map)\` ya lo serializa así.

Las sesiones huérfanas al final viven en \`open\` y nunca llegan a \`totals\` — exactamente lo que pide la spec.`,
    codeAfter: `function solution(events) {
  const open = new Map();
  const totals = new Map();
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
  },
];

const subscriptionMrr: TutorialStep[] = [
  {
    title: 'Paso 1 — Map de subs activos + Set de canceladas',
    why: `\`subs\` mapea \`subId → plan actual\`. \`cancelled\` recuerda quienes ya cancelaron para que un futuro \`SUB_CREATED\` con el mismo id NO los resucite.

Sin el \`Set\` de cancelados, un \`CREATED\` después de un \`CANCELLED\` re-añadiría la sub al MRR.`,
    codeAfter: `function solution(events) {
  const subs = new Map();
  const cancelled = new Set();
  return 0;
}`,
  },
  {
    title: 'Paso 2 — SUB_CREATED: el primero gana, los cancelados no resucitan',
    why: `Tres condiciones: el id no existe ya en \`subs\` Y no está en \`cancelled\`. La spec dice "duplicate created keeps first plan" y "cancel then re-create stays cancelled".`,
    codeAfter: `function solution(events) {
  const subs = new Map();
  const cancelled = new Set();
  for (const e of events) {
    if (e.type === 'SUB_CREATED') {
      if (!subs.has(e.subId) && !cancelled.has(e.subId)) {
        subs.set(e.subId, e.plan);
      }
    }
  }
  return 0;
}`,
  },
  {
    title: 'Paso 3 — UPGRADED / DOWNGRADED: solo si la sub existe',
    why: `\`subs.has\` garantiza que ignoramos updates sobre subs fantasma o ya canceladas. UPGRADE y DOWNGRADE son simétricos — ambos sobreescriben el plan.`,
    codeAfter: `function solution(events) {
  const subs = new Map();
  const cancelled = new Set();
  for (const e of events) {
    if (e.type === 'SUB_CREATED') {
      if (!subs.has(e.subId) && !cancelled.has(e.subId)) subs.set(e.subId, e.plan);
    } else if (e.type === 'SUB_UPGRADED' || e.type === 'SUB_DOWNGRADED') {
      if (subs.has(e.subId)) subs.set(e.subId, e.plan);
    }
  }
  return 0;
}`,
  },
  {
    title: 'Paso 4 — SUB_CANCELLED + suma final',
    why: `Cancelar es \`delete\` del Map + agregar al Set. Al final sumamos los planes que quedaron — esos son los activos.

Si no hubo cancelados, \`cancelled\` queda vacío y no afecta nada.`,
    codeAfter: `function solution(events) {
  const subs = new Map();
  const cancelled = new Set();
  for (const e of events) {
    if (e.type === 'SUB_CREATED') {
      if (!subs.has(e.subId) && !cancelled.has(e.subId)) subs.set(e.subId, e.plan);
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
  },
];

const idempotentPayments: TutorialStep[] = [
  {
    title: 'Paso 1 — Set de requestIds vistos + Map de totales',
    why: `Patrón clásico de dedup: \`Set\` para "ya vi este id", \`Map\` para acumular por categoría (en este caso, por currency).

\`Set.has\` es O(1) — usar \`Array.includes\` aquí es el típico O(N²) que te mata en perf.`,
    codeAfter: `function solution(payments) {
  const seen = new Set();
  const totals = new Map();
  return Object.fromEntries(totals);
}`,
  },
  {
    title: 'Paso 2 — Skip si retry, sino acumular',
    why: `\`seen.has(p.requestId)\` → \`continue\`. Esto descarta los retries. Cuando es la primera vez, registramos el id en \`seen\` Y sumamos al currency correspondiente.

Ojo con el orden: \`add\` antes (o después, no importa) de sumar — pero **el check tiene que ser ANTES**.`,
    codeAfter: `function solution(payments) {
  const seen = new Set();
  const totals = new Map();
  for (const p of payments) {
    if (seen.has(p.requestId)) continue;
    seen.add(p.requestId);
    totals.set(p.currency, (totals.get(p.currency) || 0) + p.amount);
  }
  return Object.fromEntries(totals);
}`,
  },
  {
    title: 'Paso 3 — La trampa: retry usa el amount del PRIMER evento',
    why: `Test oculto: "retry uses amount from FIRST occurrence". Si llega \`r1\` con \`amount=100\`, luego \`r1\` con \`amount=9999\`, el segundo se ignora completamente.

Esto sale gratis con el patrón actual — el \`continue\` descarta TODO el segundo evento (incluyendo su amount). Si hubieras hecho \`Math.max(totals.get(currency), p.amount)\` habrías roto este caso.`,
    codeAfter: `function solution(payments) {
  const seen = new Set();
  const totals = new Map();
  for (const p of payments) {
    if (seen.has(p.requestId)) continue;
    seen.add(p.requestId);
    totals.set(p.currency, (totals.get(p.currency) || 0) + p.amount);
  }
  return Object.fromEntries(totals);
}`,
  },
];

const approvals: TutorialStep[] = [
  {
    title: 'Paso 1 — Map de docs con estado machine',
    why: `Cada doc es un mini state machine: \`pending → approved\` o \`pending → rejected\`. Una vez en estado final, NO se acepta ningún evento más.

Guardamos: \`required\` (cuántos approvers se necesitan), \`approvers\` (Set para dedup por reviewerId), \`state\`.`,
    codeAfter: `function solution(events) {
  const docs = new Map();
  return { approved: [], rejected: [], pending: [] };
}`,
  },
  {
    title: 'Paso 2 — DOC_OPENED: registra el doc',
    why: `Cada doc se inicializa con \`approvers: new Set()\` y \`state: 'pending'\`. La guarda \`!docs.has\` evita que un segundo OPENED resetee el estado de un doc ya en proceso.`,
    codeAfter: `function solution(events) {
  const docs = new Map();
  for (const e of events) {
    if (e.type === 'DOC_OPENED') {
      if (!docs.has(e.docId)) {
        docs.set(e.docId, { required: e.requiredApprovers, approvers: new Set(), state: 'pending' });
      }
    }
  }
  return { approved: [], rejected: [], pending: [] };
}`,
  },
  {
    title: 'Paso 3 — La guarda: ignorar eventos sobre docs no-pending',
    why: `Antes de tocar nada, validamos: doc existe Y está en \`'pending'\`. Si no, \`continue\`.

Esto cubre dos casos sutiles: eventos sobre docs desconocidos (\`ghost\`) Y eventos después del estado final (la spec dice "Once a doc has a final state, further events for it are ignored").`,
    codeAfter: `function solution(events) {
  const docs = new Map();
  for (const e of events) {
    if (e.type === 'DOC_OPENED') {
      if (!docs.has(e.docId)) {
        docs.set(e.docId, { required: e.requiredApprovers, approvers: new Set(), state: 'pending' });
      }
      continue;
    }
    const d = docs.get(e.docId);
    if (!d || d.state !== 'pending') continue;
  }
  return { approved: [], rejected: [], pending: [] };
}`,
  },
  {
    title: 'Paso 4 — APPROVED + threshold, REJECTED instantáneo',
    why: `\`approvers.add(reviewerId)\` deduplica al mismo reviewer aprobando dos veces. Cuando \`size >= required\`, transición a \`'approved'\`.

REJECTED es atómico: un solo rechazo manda el doc a estado final. Un APPROVED después se ignora por la guarda del paso 3.`,
    codeAfter: `function solution(events) {
  const docs = new Map();
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
  return { approved: [], rejected: [], pending: [] };
}`,
  },
  {
    title: 'Paso 5 — Aggregate + sort de los 3 buckets',
    why: `Una pasada final por el Map clasifica los docs en 3 arrays. Sort al final, fuera del loop principal — O(K log K) donde K es el número de docs.`,
    codeAfter: `function solution(events) {
  const docs = new Map();
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
  },
];

const latePayments: TutorialStep[] = [
  {
    title: 'Paso 1 — Map de counts por contractor',
    why: `Solo necesitamos contar — no necesitamos guardar las fechas. \`Map<contractorId, number>\` es suficiente.`,
    codeAfter: `function solution(records) {
  const counts = new Map();
  return [];
}`,
  },
  {
    title: 'Paso 2 — Filtrar late + incrementar counter',
    why: `Las dos condiciones de "late": \`paidTs !== null\` (sino es unpaid, no late) Y \`paidTs > dueTs\` (pago estrictamente tardío — \`paidTs === dueTs\` cuenta como on-time según los tests).

\`!== null\` es estricto: un \`undefined\` también pasaría. Si quieres ser super defensivo, usá \`!= null\` (con dos =) que cubre ambos.`,
    codeAfter: `function solution(records) {
  const counts = new Map();
  for (const r of records) {
    if (r.paidTs !== null && r.paidTs > r.dueTs) {
      counts.set(r.contractorId, (counts.get(r.contractorId) || 0) + 1);
    }
  }
  return [];
}`,
  },
  {
    title: 'Paso 3 — Filtrar ≥ 3 + sort',
    why: `La spec dice "al menos 3 late payments" — usar \`>= 3\` (NO \`> 2\`, son equivalentes pero \`>=\` es más legible y exacto al texto).

Sort al final, una sola vez.`,
    codeAfter: `function solution(records) {
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
  },
];

const currencyBestPair: TutorialStep[] = [
  {
    title: 'Paso 1 — Destructurar + inicializar best/worst en null',
    why: `Iniciar en \`null\` (no en \`Infinity\` o \`-Infinity\`) hace que la comparación al inicio sea siempre "primera vez gana" — más legible y maneja bien el caso "no matches".`,
    codeAfter: `function solution(input) {
  const { snapshots, targetPair, startTs, endTs } = input;
  let best = null;
  let worst = null;
  return { best, worst };
}`,
  },
  {
    title: 'Paso 2 — Filtrar y comparar para best',
    why: `Dos filtros baratos al inicio del loop: pair correcto Y dentro del window.

Para el "best" (mayor rate), también necesitamos el tie-break: si \`rate\` empata, gana el \`ts\` MÁS BAJO. Por eso el \`||\` con \`s.ts < best.ts\`.`,
    codeAfter: `function solution(input) {
  const { snapshots, targetPair, startTs, endTs } = input;
  let best = null;
  let worst = null;
  for (const s of snapshots) {
    if (s.pair !== targetPair) continue;
    if (s.ts < startTs || s.ts > endTs) continue;
    if (best === null || s.rate > best.rate || (s.rate === best.rate && s.ts < best.ts)) {
      best = { rate: s.rate, ts: s.ts };
    }
  }
  return { best, worst };
}`,
  },
  {
    title: 'Paso 3 — Worst con la misma lógica invertida',
    why: `Espejo de "best": menor \`rate\` gana, empate por menor \`ts\`. Mantenemos el mismo loop — no hagas dos pasadas.

Un solo loop = O(N). Dos loops = O(2N) que sigue siendo O(N) pero parece sloppy y duplicas filtros.`,
    codeAfter: `function solution(input) {
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
  },
];

// =============================================================================
// SQL PROBLEMS — extra-sql.ts
// =============================================================================

const highestPaidContractor: TutorialStep[] = [
  {
    title: 'Paso 1 — Aggregate por contractor con joins',
    why: `Empezamos por sumar paid jobs por contractor en un CTE \`totals\`. Necesitamos \`id\` (para tie-break), \`first_name\` (para output), \`profession\` (para particionar).`,
    codeAfter: `WITH totals AS (
  SELECT p.id, p.first_name, p.profession, SUM(j.price) AS total
  FROM jobs j
  JOIN contracts c ON c.id = j.contract_id
  JOIN profiles p ON p.id = c.contractor_id
  WHERE j.paid = TRUE
    AND j.payment_date BETWEEN :start_date AND :end_date
    AND p.profession IS NOT NULL
  GROUP BY p.id, p.first_name, p.profession
)
SELECT * FROM totals;`,
  },
  {
    title: 'Paso 2 — ROW_NUMBER para el "top por profession"',
    why: `\`ROW_NUMBER() OVER (PARTITION BY profession ORDER BY total DESC, id ASC)\` asigna 1 al ganador de cada profession.

El \`ORDER BY total DESC, id ASC\` resuelve el tie-break: si dos contractors empatan en total, gana el de menor \`id\`.`,
    codeAfter: `WITH totals AS (
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
SELECT * FROM ranked;`,
  },
  {
    title: 'Paso 3 — Filtrar rn=1 + cast TEXT + sort final',
    why: `\`WHERE rn = 1\` nos deja una fila por profession.

\`total::TEXT\` por la misma razón que en Top Profession: NUMERIC en JS es a veces string a veces número, castear lo hace determinístico.`,
    codeAfter: `WITH totals AS (
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
  },
];

const monthsNoPayments: TutorialStep[] = [
  {
    title: 'Paso 1 — generate_series para todos los meses del rango',
    why: `\`generate_series(start, end, '1 month')\` nos da una fila por mes en el rango (inclusivo). \`TO_CHAR(d, 'YYYY-MM')\` lo formatea como espera la spec.

Esto resuelve el problema antifrágil: aunque no haya jobs ningún mes, los meses siguen apareciendo.`,
    codeAfter: `SELECT TO_CHAR(d, 'YYYY-MM') AS month
FROM generate_series(:start_date::date, :end_date::date, '1 month') AS d
ORDER BY month ASC;`,
  },
  {
    title: 'Paso 2 — CTE de meses + subquery de meses CON pagos',
    why: `Construimos dos conjuntos:
1. \`months\`: todos los meses del rango
2. Una subquery con los meses que SÍ tienen pagos

Después filtramos: \`month NOT IN (subquery)\`.`,
    codeAfter: `WITH months AS (
  SELECT TO_CHAR(d, 'YYYY-MM') AS month
  FROM generate_series(:start_date::date, :end_date::date, '1 month') AS d
)
SELECT month FROM months;`,
  },
  {
    title: 'Paso 3 — NOT IN filter',
    why: `Filtramos los meses del CTE quitando los que aparecen en la subquery de meses con pagos. \`paid = TRUE\` y \`payment_date IS NOT NULL\` para evitar contar unpaid o jobs sin fecha.

⚠️ Trampa con \`NOT IN\`: si la subquery puede devolver NULL, todo el \`NOT IN\` colapsa a unknown. Por eso filtramos \`IS NOT NULL\` explícitamente.`,
    codeAfter: `WITH months AS (
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
  },
];

const cancellationRate: TutorialStep[] = [
  {
    title: 'Paso 1 — JOIN contracts + profiles, sin agrupar aún',
    why: `Necesitamos el \`first_name\` así que joineamos a \`profiles\`. Vamos a agrupar por contractor.`,
    codeAfter: `SELECT c.contractor_id, p.first_name, c.status
FROM contracts c
JOIN profiles p ON p.id = c.contractor_id;`,
  },
  {
    title: 'Paso 2 — GROUP BY + condicional para contar terminated',
    why: `\`SUM(CASE WHEN ... THEN 1 ELSE 0 END)\` es el patrón canónico para "cuenta los que cumplen X". \`COUNT(*)\` cuenta el total.

Dividir + multiplicar por 100 → porcentaje.`,
    codeAfter: `SELECT c.contractor_id,
       p.first_name,
       SUM(CASE WHEN c.status = 'terminated' THEN 1 ELSE 0 END) * 100.0 / COUNT(*) AS pct
FROM contracts c
JOIN profiles p ON p.id = c.contractor_id
GROUP BY c.contractor_id, p.first_name;`,
  },
  {
    title: 'Paso 3 — ROUND a 1 decimal + cast TEXT',
    why: `\`ROUND(x, 1)\` redondea a 1 decimal. \`::TEXT\` consistencia de formato — la spec dice \`'42.9'\`, no \`42.9\`.

El \`* 1.0\` (o \`100.0\`) es para forzar división de NUMERIC, no integer division (que daría 0 si numerador < denominador).`,
    codeAfter: `SELECT c.contractor_id,
       p.first_name,
       ROUND(SUM(CASE WHEN c.status = 'terminated' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 1)::TEXT AS cancellation_pct
FROM contracts c
JOIN profiles p ON p.id = c.contractor_id
GROUP BY c.contractor_id, p.first_name;`,
  },
  {
    title: 'Paso 4 — HAVING para los dos filtros + ORDER BY',
    why: `\`HAVING\` (no \`WHERE\`) porque filtramos por agregados.

Dos condiciones: \`COUNT(*) >= 3\` (mínimo de contratos) Y rate \`> 30\` (estrictamente mayor, no \`>=\`). Sin el \`> 30\`, devolvés contractors con exactamente 30%.

\`ORDER BY cancellation_pct\` no funciona en algunos engines porque es un TEXT casted — mejor referenciar la expresión completa o usar el alias en la SELECT.`,
    codeAfter: `SELECT c.contractor_id,
       p.first_name,
       ROUND(SUM(CASE WHEN c.status = 'terminated' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 1)::TEXT AS cancellation_pct
FROM contracts c
JOIN profiles p ON p.id = c.contractor_id
GROUP BY c.contractor_id, p.first_name
HAVING COUNT(*) >= 3
   AND SUM(CASE WHEN c.status = 'terminated' THEN 1 ELSE 0 END) * 100.0 / COUNT(*) > 30
ORDER BY cancellation_pct DESC, c.contractor_id ASC;`,
  },
];

const avgDaysToPayment: TutorialStep[] = [
  {
    title: 'Paso 1 — JOINs filtradas por paid',
    why: `Solo nos interesan paid jobs. \`type = 'contractor'\` por si la spec restringe a ese tipo de profile.`,
    codeAfter: `SELECT p.id, p.first_name, c.created_at, j.payment_date
FROM jobs j
JOIN contracts c ON c.id = j.contract_id
JOIN profiles p ON p.id = c.contractor_id
WHERE j.paid = TRUE
  AND p.type = 'contractor';`,
  },
  {
    title: 'Paso 2 — Calcular días entre dos timestamps',
    why: `\`payment_date - created_at\` devuelve un interval. \`EXTRACT(EPOCH FROM interval)\` lo convierte a segundos, y dividimos entre 86400 para obtener días.

Postgres también acepta \`DATE_PART('day', interval)\` pero \`EXTRACT EPOCH\` funciona también con fracciones de día.`,
    codeAfter: `SELECT p.id, p.first_name,
       EXTRACT(EPOCH FROM (j.payment_date - c.created_at)) / 86400.0 AS days
FROM jobs j
JOIN contracts c ON c.id = j.contract_id
JOIN profiles p ON p.id = c.contractor_id
WHERE j.paid = TRUE
  AND p.type = 'contractor';`,
  },
  {
    title: 'Paso 3 — AVG + ROUND + GROUP BY',
    why: `\`AVG(...)\` agrega los días por contractor. \`ROUND(x, 1)::TEXT\` para 1 decimal como string.

\`GROUP BY p.id, p.first_name\` — siempre listamos en GROUP BY todas las columnas no-agregadas del SELECT.`,
    codeAfter: `SELECT p.id AS contractor_id,
       p.first_name,
       ROUND(AVG(EXTRACT(EPOCH FROM (j.payment_date - c.created_at)) / 86400.0)::numeric, 1)::TEXT AS avg_days
FROM jobs j
JOIN contracts c ON c.id = j.contract_id
JOIN profiles p ON p.id = c.contractor_id
WHERE j.paid = TRUE
  AND p.type = 'contractor'
GROUP BY p.id, p.first_name;`,
  },
  {
    title: 'Paso 4 — ORDER BY por el AVG raw, no por el TEXT',
    why: `Si ordenas por \`avg_days\` (el TEXT), \`'10.0'\` viene antes que \`'5.0'\` alfabéticamente (\`'1' < '5'\`).

Por eso ordenamos por la expresión raw \`AVG(...)\` no por el alias del TEXT casted. Sutil pero crítico.`,
    codeAfter: `SELECT p.id AS contractor_id,
       p.first_name,
       ROUND(AVG(EXTRACT(EPOCH FROM (j.payment_date - c.created_at)) / 86400.0)::numeric, 1)::TEXT AS avg_days
FROM jobs j
JOIN contracts c ON c.id = j.contract_id
JOIN profiles p ON p.id = c.contractor_id
WHERE j.paid = TRUE
  AND p.type = 'contractor'
GROUP BY p.id, p.first_name
ORDER BY (AVG(EXTRACT(EPOCH FROM (j.payment_date - c.created_at)) / 86400.0)) ASC, p.id ASC;`,
  },
];

const clientsWithoutActive: TutorialStep[] = [
  {
    title: 'Paso 1 — Filtrar profiles tipo client',
    why: `Empezamos con la tabla más selectiva y descartamos lo obvio: solo profiles de tipo \`client\`.`,
    codeAfter: `SELECT p.id AS client_id, p.first_name
FROM profiles p
WHERE p.type = 'client';`,
  },
  {
    title: 'Paso 2 — EXISTS: al menos 1 contrato en su historia',
    why: `\`EXISTS\` es más eficiente que \`COUNT(*) > 0\` en una subquery — el motor para de buscar en cuanto encuentra una fila.

Esto excluye clients sin contratos.`,
    codeAfter: `SELECT p.id AS client_id, p.first_name
FROM profiles p
WHERE p.type = 'client'
  AND EXISTS (SELECT 1 FROM contracts c WHERE c.client_id = p.id);`,
  },
  {
    title: 'Paso 3 — NOT EXISTS: cero contratos in_progress',
    why: `Dos \`EXISTS\` complementarios: uno positivo ("tiene contratos"), uno negativo ("ninguno está activo").

\`NOT EXISTS\` es preferible a \`COUNT(*) = 0\` por la misma razón de short-circuit + porque NO tiene problemas con NULLs (a diferencia de \`NOT IN\`).`,
    codeAfter: `SELECT p.id AS client_id, p.first_name
FROM profiles p
WHERE p.type = 'client'
  AND EXISTS (SELECT 1 FROM contracts c WHERE c.client_id = p.id)
  AND NOT EXISTS (SELECT 1 FROM contracts c WHERE c.client_id = p.id AND c.status = 'in_progress')
ORDER BY p.id ASC;`,
  },
];

const topEarnerPerYear: TutorialStep[] = [
  {
    title: 'Paso 1 — CTE: agregado anual por contractor',
    why: `\`EXTRACT(YEAR FROM payment_date)::int\` saca el año. Agrupamos por \`(year, contractor)\`.`,
    codeAfter: `WITH yearly AS (
  SELECT EXTRACT(YEAR FROM j.payment_date)::int AS year,
         p.id AS contractor_id,
         p.first_name,
         SUM(j.price) AS total
  FROM jobs j
  JOIN contracts c ON c.id = j.contract_id
  JOIN profiles p ON p.id = c.contractor_id
  WHERE j.paid = TRUE
  GROUP BY year, p.id, p.first_name
)
SELECT * FROM yearly;`,
  },
  {
    title: 'Paso 2 — ROW_NUMBER per year',
    why: `Mismo patrón que en "Highest-Paid Contractor": \`PARTITION BY\` el campo que segmenta (year), \`ORDER BY\` que ranquea + tie-break.

Acá tie-break por menor \`contractor_id\`.`,
    codeAfter: `WITH yearly AS (
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
SELECT * FROM ranked;`,
  },
  {
    title: 'Paso 3 — WHERE rn=1 + cast TEXT + ORDER BY year',
    why: `Quedarnos con el ganador de cada año, formatear el total como string, sortear cronológicamente.`,
    codeAfter: `WITH yearly AS (
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
  },
];

// =============================================================================
// API PROBLEMS — extra-api.ts
// =============================================================================

const apiGetContract: TutorialStep[] = [
  {
    title: 'Paso 1 — Auth: si no hay currentUser, 401',
    why: `**Primera línea de defensa siempre**. Antes que cualquier otra cosa (parseo, lookup, etc.), validamos que hay un usuario. Sin esto, leakeás info en los siguientes pasos.`,
    codeAfter: `function handle(request, db) {
  if (!request.currentUser) return { status: 401, body: { error: 'unauthorized' } };
}`,
  },
  {
    title: 'Paso 2 — Parsear el id del path',
    why: `Regex captura el id. Si el path no matchea \`/contracts/:id\`, devolvemos 404 (no 400) — el endpoint simplemente no existe para esa shape.

\`Number(m[1])\` convierte el string a número para compararlo con \`contract.id\`.`,
    codeAfter: `function handle(request, db) {
  if (!request.currentUser) return { status: 401, body: { error: 'unauthorized' } };
  const m = request.path.match(/^\\/contracts\\/(\\d+)$/);
  if (!m) return { status: 404, body: { error: 'not found' } };
  const id = Number(m[1]);
}`,
  },
  {
    title: 'Paso 3 — Buscar el contract → 404 si no existe',
    why: `\`db.contracts.find\` es O(N). Aceptable para la spec (10k contracts, ~50ms budget) porque solo lo hacés una vez por request.

Si NO existe, 404 — sin diferenciar (importante para el siguiente paso).`,
    codeAfter: `function handle(request, db) {
  if (!request.currentUser) return { status: 401, body: { error: 'unauthorized' } };
  const m = request.path.match(/^\\/contracts\\/(\\d+)$/);
  if (!m) return { status: 404, body: { error: 'not found' } };
  const id = Number(m[1]);
  const contract = db.contracts.find(c => c.id === id);
  if (!contract) return { status: 404, body: { error: 'not found' } };
}`,
  },
  {
    title: 'Paso 4 — Ownership check: el "no leak"',
    why: `**La trampa de seguridad clave**. Si el contract existe pero NO es del user, devolvemos el MISMO 404 que cuando no existe.

Si devolvieras 403/401 aquí, un atacante puede enumerar contracts: 404 = no existe, 403 = existe pero no es mío. Filtra info. La spec lo dice explícito: "Do NOT leak existence to non-owners".`,
    codeAfter: `function handle(request, db) {
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
}`,
  },
  {
    title: 'Paso 5 — Return 200 + contract',
    why: `Si todos los checks pasan, devolvemos el contract tal cual. Body shape: \`{ contract }\` (shorthand para \`{ contract: contract }\`).`,
    codeAfter: `function handle(request, db) {
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
  },
];

const apiUnpaidJobs: TutorialStep[] = [
  {
    title: 'Paso 1 — Auth + validar shape de la request',
    why: `Auth primero. Después validamos que es el path correcto — protege contra acoplamientos extraños.`,
    codeAfter: `function handle(request, db) {
  if (!request.currentUser) return { status: 401, body: { error: 'unauthorized' } };
  if (request.path !== '/jobs/unpaid' || request.method !== 'GET') {
    return { status: 404, body: { error: 'not found' } };
  }
}`,
  },
  {
    title: 'Paso 2 — Set de contractIds del user',
    why: `Filtramos los contracts donde el user es client O contractor Y el status es \`in_progress\`. Volcamos sus ids a un \`Set\` para lookup O(1) en el siguiente paso.

Sin el Set, el filtro de jobs sería O(N*M) (jobs × contracts). Con Set: O(N+M).`,
    codeAfter: `function handle(request, db) {
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
}`,
  },
  {
    title: 'Paso 3 — Filtrar jobs unpaid de mis contracts',
    why: `Dos condiciones: \`!job.paid\` Y \`myContractIds.has(job.contract_id)\`. El \`.has()\` es O(1) gracias al Set.`,
    codeAfter: `function handle(request, db) {
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
  const jobs = db.jobs.filter(j => !j.paid && myContractIds.has(j.contract_id));
}`,
  },
  {
    title: 'Paso 4 — Sort por id asc + return',
    why: `\`sort((a, b) => a.id - b.id)\` es numérico (a diferencia de \`.sort()\` que es lexicográfico — \`'10' < '2'\` por strings).

Body shape: \`{ jobs }\`.`,
    codeAfter: `function handle(request, db) {
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
  },
];

const apiPayJob: TutorialStep[] = [
  {
    title: 'Paso 1 — Auth + parse del path',
    why: `Auth primero. Parse del path antes de cualquier query a db. Si la shape del path no matchea o el método no es POST, 404.`,
    codeAfter: `function handle(request, db) {
  if (!request.currentUser) return { status: 401, body: { error: 'unauthorized' } };
  const m = request.path.match(/^\\/jobs\\/(\\d+)\\/pay$/);
  if (!m || request.method !== 'POST') return { status: 404, body: { error: 'not found' } };
  const id = Number(m[1]);
}`,
  },
  {
    title: 'Paso 2 — Buscar job y contract',
    why: `Lookups baratos. Si el job no existe O el contract no existe, 404.

Defensive: en una BD real, un job sin contract no debería existir, pero validamos por si las moscas.`,
    codeAfter: `function handle(request, db) {
  if (!request.currentUser) return { status: 401, body: { error: 'unauthorized' } };
  const m = request.path.match(/^\\/jobs\\/(\\d+)\\/pay$/);
  if (!m || request.method !== 'POST') return { status: 404, body: { error: 'not found' } };
  const id = Number(m[1]);
  const job = db.jobs.find(j => j.id === id);
  if (!job) return { status: 404, body: { error: 'not found' } };
  const contract = db.contracts.find(c => c.id === job.contract_id);
  if (!contract) return { status: 404, body: { error: 'not found' } };
}`,
  },
  {
    title: 'Paso 3 — Solo el CLIENTE puede pagar → 401 forbidden',
    why: `**Atomicidad regla 1**: validar permisos antes de tocar nada. La spec es estricta: solo \`type === 'client'\` Y \`client_id === currentUser.id\`. Un contractor — incluso el de este contract — no puede.

\`forbidden\` con status 401 (la spec así lo pide; en REST puro sería 403, pero seguimos la spec).`,
    codeAfter: `function handle(request, db) {
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
}`,
  },
  {
    title: 'Paso 4 — Ya pagado → 400 already paid (sin mutar)',
    why: `Antes de tocar balances, chequear que el job no esté ya pagado. Si lo está, 400. El postCheck de los tests verifica que \`client.balance\` NO cambió.

Esto sale gratis si validás ANTES de mutar — y se rompe brutalmente si validás después.`,
    codeAfter: `function handle(request, db) {
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
}`,
  },
  {
    title: 'Paso 5 — Balance check ANTES de mutar (atomicidad)',
    why: `Buscar profiles + validar fondos. **Si \`client.balance < job.price\` → 400 INSUFFICIENT FUNDS sin tocar ni un campo**.

Esta es la trampa de atomicidad. La forma "natural pero incorrecta" sería:
\`\`\`
client.balance -= job.price;
if (client.balance < 0) return 400;
\`\`\`
Eso ya mutó \`client.balance\` (ahora negativo). El postCheck explota.`,
    codeAfter: `function handle(request, db) {
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
}`,
  },
  {
    title: 'Paso 6 — Todo OK: mutar atómicamente + return',
    why: `Las 6 validaciones pasaron. Ahora SÍ podemos mutar — y mutamos las 4 cosas en orden, sin posibilidad de fallo a mitad:

1. \`client.balance -= price\`
2. \`contractor.balance += price\`
3. \`job.paid = true\`
4. \`job.payment_date = ts\`

Como JS es single-threaded y no estamos haciendo I/O, no hay race conditions a preocuparse. En un Postgres real, esto iría dentro de \`BEGIN; ... COMMIT;\`.`,
    codeAfter: `function handle(request, db) {
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
  client.balance -= job.price;
  contractor.balance += job.price;
  job.paid = true;
  job.payment_date = (request.body && request.body.now) || new Date().toISOString();
  return { status: 200, body: { job } };
}`,
  },
];

// =============================================================================
// EXPORT
// =============================================================================

export const tutorialsById: Record<string, TutorialStep[]> = {
  // JS extras
  'time-tracker': timeTracker,
  'subscription-mrr': subscriptionMrr,
  'idempotent-payments': idempotentPayments,
  'approval-workflow': approvals,
  'late-payments': latePayments,
  'currency-best-pair': currencyBestPair,
  // SQL extras
  'highest-paid-contractor': highestPaidContractor,
  'months-no-payments': monthsNoPayments,
  'cancellation-rate': cancellationRate,
  'avg-days-to-payment': avgDaysToPayment,
  'clients-without-active': clientsWithoutActive,
  'top-earner-per-year': topEarnerPerYear,
  // API extras
  'api-get-contract': apiGetContract,
  'api-unpaid-jobs': apiUnpaidJobs,
  'api-pay-job': apiPayJob,
};
