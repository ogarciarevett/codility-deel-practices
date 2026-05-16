import { payoutEngine } from './payout-engine';
import { topProfession } from './top-profession';
import { extraJsProblems } from './extra-js';
import { extraSqlProblems } from './extra-sql';
import { extraApiProblems } from './extra-api';
import { tutorialsById } from './tutorials';
import type { JsProblem, SqlProblem, ApiProblem } from './types';

export type Problem = JsProblem | SqlProblem | ApiProblem;
export type { JsProblem, SqlProblem, ApiProblem };

function withTutorial<T extends Problem>(p: T): T {
  if (p.tutorial) return p;  // already has one embedded
  const steps = tutorialsById[p.id];
  if (!steps) return p;
  return { ...p, tutorial: { steps } };
}

const raw: Problem[] = [
  payoutEngine,
  topProfession,
  ...extraApiProblems,
  ...extraJsProblems,
  ...extraSqlProblems,
];

export const problems: Problem[] = raw.map(withTutorial);
