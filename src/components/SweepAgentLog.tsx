import type { SweepAgentStep } from "@/lib/sweep-agent";
import { CheckIcon, Spinner } from "@/components/ui/Icons";

interface SweepAgentLogProps {
  steps: SweepAgentStep[];
  batchProgress?: { current: number; total: number } | null;
}

function stepIcon(status: SweepAgentStep["status"]) {
  if (status === "running") return <Spinner className="h-4 w-4 text-mech-600" aria-hidden="true" />;
  if (status === "done") {
    return <CheckIcon className="h-4 w-4 text-emerald-600" aria-hidden="true" />;
  }
  if (status === "skipped") {
    return <span className="h-4 w-4 text-center text-xs text-slate-400" aria-hidden="true">—</span>;
  }
  if (status === "error") {
    return <span className="text-sm text-red-600" aria-hidden="true">!</span>;
  }
  return <span className="h-4 w-4 rounded-full border border-slate-300" aria-hidden="true" />;
}

export default function SweepAgentLog({ steps, batchProgress }: SweepAgentLogProps) {
  return (
    <div
      className="space-y-4 rounded-xl border border-mech-200 bg-mech-50/60 px-4 py-4"
      aria-live="polite"
      aria-label="Sweep agent progress"
    >
      <div>
        <p className="text-sm font-semibold text-slate-900">Sweep agent</p>
        <p className="mt-0.5 text-xs text-slate-600">
          Searching, reviewing, and adding documents automatically.
        </p>
      </div>

      <ol className="space-y-3">
        {steps.map((step) => (
          <li key={step.id} className="flex items-start gap-3">
            <div className="mt-0.5 shrink-0">{stepIcon(step.status)}</div>
            <div className="min-w-0">
              <p
                className={`text-sm font-medium ${
                  step.status === "running" ? "text-mech-800" : "text-slate-800"
                }`}
              >
                {step.label}
              </p>
              {step.detail && (
                <p className="mt-0.5 text-xs text-slate-600">{step.detail}</p>
              )}
            </div>
          </li>
        ))}
      </ol>

      {batchProgress && batchProgress.total > 1 && (
        <p className="text-xs text-slate-600">
          Search batch {batchProgress.current} of {batchProgress.total}
        </p>
      )}
    </div>
  );
}
