interface TimerProps {
  remainingSeconds: number;
  paused: boolean;
}

function format(s: number): string {
  if (s < 0) s = 0;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

export function Timer({ remainingSeconds, paused }: TimerProps) {
  const isUrgent = remainingSeconds < 600 && remainingSeconds > 0;
  const isExpired = remainingSeconds <= 0;
  return (
    <div className="flex items-center gap-2 font-mono text-sm">
      <span className={
        isExpired ? 'text-slate-400'
          : isUrgent ? 'text-red-600 font-semibold'
          : 'text-slate-700'
      }>
        {format(remainingSeconds)}
      </span>
      {paused && <span className="text-amber-600 text-xs">paused</span>}
    </div>
  );
}
