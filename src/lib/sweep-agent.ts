import { ANALYZE_CONCURRENCY } from "@/lib/constants";
import { runWithConcurrency } from "@/lib/concurrency";
import { isDocumentUrlKnown } from "@/lib/duplicates";
import { runBatchedSweep } from "@/lib/sweep-client";
import { resolveSweepSessionMax } from "@/lib/sweep-limits";
import type { SweepResult } from "@/types";

export type SweepAgentStepStatus = "pending" | "running" | "done" | "skipped" | "error";

export interface SweepAgentStep {
  id: "search" | "review" | "add" | "complete";
  label: string;
  status: SweepAgentStepStatus;
  detail?: string;
}

export interface RunSweepAgentOptions {
  query: string;
  excludeUrls: string[];
  onAdd: (result: SweepResult) => Promise<void>;
  onSteps?: (steps: SweepAgentStep[]) => void;
  onAddProgress?: (completed: number, total: number) => void;
  onBatchProgress?: (current: number, total: number) => void;
}

export interface RunSweepAgentResult {
  results: SweepResult[];
  provider: string | null;
  added: number;
  skipped: number;
}

function initialSteps(): SweepAgentStep[] {
  return [
    { id: "search", label: "Search the web for documents", status: "pending" },
    { id: "review", label: "Review matches", status: "pending" },
    { id: "add", label: "Add documents to library", status: "pending" },
    { id: "complete", label: "Finish", status: "pending" },
  ];
}

function publishSteps(
  steps: SweepAgentStep[],
  onSteps: RunSweepAgentOptions["onSteps"]
): SweepAgentStep[] {
  onSteps?.(steps.map((step) => ({ ...step })));
  return steps;
}

function setStep(
  steps: SweepAgentStep[],
  id: SweepAgentStep["id"],
  patch: Partial<SweepAgentStep>
): SweepAgentStep[] {
  return steps.map((step) => (step.id === id ? { ...step, ...patch } : step));
}

/** Autonomous sweep: search, filter new URLs, add all matches to the library. */
export async function runSweepAgent(options: RunSweepAgentOptions): Promise<RunSweepAgentResult> {
  const {
    query,
    excludeUrls,
    onAdd,
    onSteps,
    onAddProgress,
    onBatchProgress,
  } = options;

  const excludeSet = new Set(excludeUrls);
  let steps = publishSteps(initialSteps(), onSteps);

  steps = publishSteps(
    setStep(steps, "search", { status: "running", detail: "Querying Exa…" }),
    onSteps
  );

  const outcome = await runBatchedSweep({
    query,
    excludeUrls,
    totalTarget: resolveSweepSessionMax(),
    onProgress: onBatchProgress,
  });

  const results = outcome.results;
  steps = publishSteps(
    setStep(steps, "search", {
      status: "done",
      detail: `Found ${results.length.toLocaleString()} result${results.length !== 1 ? "s" : ""}`,
    }),
    onSteps
  );

  steps = publishSteps(setStep(steps, "review", { status: "running" }), onSteps);

  const pending = results.filter((result) => !isDocumentUrlKnown(result.url, excludeSet));
  const skipped = results.length - pending.length;

  steps = publishSteps(
    setStep(steps, "review", {
      status: "done",
      detail:
        pending.length === 0
          ? skipped > 0
            ? "All results already in library"
            : "No documents matched"
          : `${pending.length.toLocaleString()} new · ${skipped.toLocaleString()} already in library`,
    }),
    onSteps
  );

  if (pending.length === 0) {
    steps = publishSteps(
      setStep(setStep(steps, "add", { status: "skipped", detail: "Nothing to add" }), "complete", {
        status: "done",
        detail: "Sweep complete",
      }),
      onSteps
    );
    return { results, provider: outcome.provider, added: 0, skipped };
  }

  steps = publishSteps(
    setStep(steps, "add", {
      status: "running",
      detail: `0 / ${pending.length.toLocaleString()}`,
    }),
    onSteps
  );

  let added = 0;
  await runWithConcurrency(pending, ANALYZE_CONCURRENCY, async (result) => {
    await onAdd(result);
    added += 1;
    onAddProgress?.(added, pending.length);
    if (onSteps) {
      steps = publishSteps(
        setStep(steps, "add", {
          status: "running",
          detail: `${added.toLocaleString()} / ${pending.length.toLocaleString()}`,
        }),
        onSteps
      );
    }
  });

  steps = publishSteps(
    setStep(steps, "add", {
      status: "done",
      detail: `Added ${added.toLocaleString()} document${added !== 1 ? "s" : ""}`,
    }),
    onSteps
  );
  steps = publishSteps(
    setStep(steps, "complete", {
      status: "done",
      detail: `Library updated with ${added.toLocaleString()} document${added !== 1 ? "s" : ""}`,
    }),
    onSteps
  );

  return { results, provider: outcome.provider, added, skipped };
}
