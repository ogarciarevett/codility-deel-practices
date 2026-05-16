import type { TestResult } from '../runners/js-runner';

export interface Scorecard {
  correctnessPct: number;
  performancePct: number;
  totalPct: number;
  correctnessPassed: number;
  correctnessTotal: number;
  performancePassed: number;
  performanceTotal: number;
}

function pct(passed: number, total: number): number {
  if (total === 0) return 100;
  return Math.round((passed / total) * 100);
}

export function computeScore(correctness: TestResult[], performance: TestResult[]): Scorecard {
  const correctnessPassed = correctness.filter(r => r.status === 'pass').length;
  const performancePassed = performance.filter(r => r.status === 'pass').length;
  const correctnessPct = pct(correctnessPassed, correctness.length);
  const performancePct = pct(performancePassed, performance.length);
  const totalPct = Math.round(0.5 * correctnessPct + 0.5 * performancePct);
  return {
    correctnessPct,
    performancePct,
    totalPct,
    correctnessPassed,
    correctnessTotal: correctness.length,
    performancePassed,
    performanceTotal: performance.length,
  };
}
