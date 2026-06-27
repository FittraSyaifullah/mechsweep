"use client";

import { useMemo, useState } from "react";
import { SWEEP_BATCH_SIZE, ANALYZE_CONCURRENCY } from "@/lib/constants";
import { runWithConcurrency } from "@/lib/concurrency";
import { runBatchedSweep } from "@/lib/sweep-client";
import { runSweepAgent, type SweepAgentStep } from "@/lib/sweep-agent";
import { dedupeSweepResultsByUrl, isDocumentUrlKnown } from "@/lib/duplicates";
import { resolveSweepSessionMax, sweepBatchCount } from "@/lib/sweep-limits";
import { formatUserError, relevancePercent } from "@/lib/user-messages";
import type { SweepResult } from "@/types";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import SweepAgentLog from "@/components/SweepAgentLog";
import { GlobeIcon, SearchIcon, Spinner } from "@/components/ui/Icons";
import ProgressBar from "@/components/ui/ProgressBar";
import { useToast } from "@/components/Toast";

const SUGGESTIONS = [
  "Heat transfer fundamentals",
  "FEA static analysis tutorials",
  "Fluid mechanics open textbooks",
  "Machine design reference datasheets",
  "Thermodynamics problem sets",
  "Robotics kinematics PDF",
];

interface SweepPanelProps {
  onAdd: (result: SweepResult) => Promise<void>;
  addedUrls: Set<string>;
  onAddedToLibrary?: (count: number) => void;
}

function providerLabel(provider: string | null): string {
  if (provider === "exa") return "Exa Search";
  if (provider === "mistral") return "Mistral AI";
  if (provider === "openrouter") return "OpenRouter";
  return provider ?? "";
}

export default function SweepPanel({ onAdd, addedUrls, onAddedToLibrary }: SweepPanelProps) {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SweepResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addProgress, setAddProgress] = useState<string | null>(null);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(
    null
  );
  const [agentSteps, setAgentSteps] = useState<SweepAgentStep[] | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [provider, setProvider] = useState<string | null>(null);
  const [lastQuery, setLastQuery] = useState("");

  const sessionMax = resolveSweepSessionMax();
  const plannedBatches = sweepBatchCount(sessionMax, SWEEP_BATCH_SIZE);
  const pendingCount = results.filter((r) => !isDocumentUrlKnown(r.url, addedUrls)).length;
  const userError = useMemo(
    () => (error ? formatUserError(error) : null),
    [error]
  );

  async function handlePreviewSweep(searchQuery?: string, append = false) {
    const q = (searchQuery ?? query).trim();
    if (!q) {
      toast("Enter a search topic first", "info");
      return;
    }
    if (searchQuery) setQuery(searchQuery);

    setLoading(true);
    setError(null);
    setBatchProgress(null);
    setAgentSteps(null);
    setHasSearched(true);
    setLastQuery(q);
    const resultCountBefore = append ? results.length : 0;

    try {
      const outcome = await runBatchedSweep({
        query: q,
        excludeUrls: Array.from(addedUrls),
        totalTarget: sessionMax,
        batchSize: SWEEP_BATCH_SIZE,
        singleBatch: append,
        existingResults: append ? results : [],
        onProgress: (batchIndex, total) => {
          setBatchProgress({ current: batchIndex, total });
        },
      });

      setProvider(outcome.provider ?? "exa");
      setResults(dedupeSweepResultsByUrl(outcome.results));

      if (outcome.results.length === 0) {
        toast("No new documents found — try different keywords", "info");
      } else if (append) {
        const added = outcome.results.length - resultCountBefore;
        if (added > 0) {
          toast(`Found ${added} more document${added !== 1 ? "s" : ""}`, "success");
        }
      } else {
        toast(
          `Found ${outcome.results.length} document${outcome.results.length !== 1 ? "s" : ""}`,
          "success"
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sweep failed";
      setError(message);
      if (!append) setResults([]);
    } finally {
      setLoading(false);
      setBatchProgress(null);
    }
  }

  async function handleAgentSweep(searchQuery?: string) {
    const q = (searchQuery ?? query).trim();
    if (!q) {
      toast("Enter a search topic first", "info");
      return;
    }
    if (searchQuery) setQuery(searchQuery);

    setLoading(true);
    setAdding(true);
    setError(null);
    setBatchProgress(null);
    setAgentSteps(null);
    setHasSearched(true);
    setLastQuery(q);

    try {
      const outcome = await runSweepAgent({
        query: q,
        excludeUrls: Array.from(addedUrls),
        onAdd,
        onSteps: setAgentSteps,
        onBatchProgress: (current, total) => setBatchProgress({ current, total }),
      });

      setProvider(outcome.provider ?? "exa");
      setResults(dedupeSweepResultsByUrl(outcome.results));

      if (outcome.added > 0) {
        toast(
          `Sweep agent added ${outcome.added} document${outcome.added !== 1 ? "s" : ""} to library`,
          "success"
        );
        onAddedToLibrary?.(outcome.added);
      } else if (outcome.results.length === 0) {
        toast("No documents found — try different keywords", "info");
      } else {
        toast("All results were already in your library", "info");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sweep failed";
      setError(message);
      setResults([]);
    } finally {
      setLoading(false);
      setAdding(false);
      setBatchProgress(null);
    }
  }

  function handleSweep(searchQuery?: string, append = false) {
    if (previewMode) {
      return handlePreviewSweep(searchQuery, append);
    }
    if (append) {
      return handlePreviewSweep(searchQuery, true);
    }
    return handleAgentSweep(searchQuery);
  }

  async function handleAddAll() {
    const pending = results.filter((r) => !isDocumentUrlKnown(r.url, addedUrls));
    if (pending.length === 0 || adding) return;

    setAdding(true);
    try {
      await runWithConcurrency(pending, ANALYZE_CONCURRENCY, async (result, index) => {
        setAddProgress(`Adding ${index + 1} of ${pending.length}…`);
        await onAdd(result);
      });
      toast(`Added ${pending.length} document${pending.length !== 1 ? "s" : ""} to library`, "success");
      onAddedToLibrary?.(pending.length);
    } finally {
      setAdding(false);
      setAddProgress(null);
    }
  }

  const busy = loading || adding;
  const showAgentLog = !previewMode && agentSteps !== null;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !busy && void handleSweep()}
            placeholder="e.g. heat transfer, FEA, machine design…"
            disabled={busy}
            aria-label="Search topic"
            className="input-base pl-9"
          />
        </div>
        <Button
          onClick={() => void handleSweep()}
          loading={loading && !showAgentLog}
          disabled={adding && !loading}
          icon={!loading ? <SearchIcon className="h-4 w-4" /> : undefined}
          className="sm:shrink-0"
        >
          {loading ? (showAgentLog ? "Agent sweeping…" : "Searching…") : "Sweep"}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => void handleSweep(s)}
            disabled={busy}
            className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600 transition hover:border-mech-300 hover:bg-mech-50 hover:text-mech-700 disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>

      <details className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-xs text-slate-500">
        <summary className="cursor-pointer select-none font-medium text-slate-600">
          Sweep settings
        </summary>
        <div className="mt-2 space-y-2 leading-relaxed">
          <label className="flex cursor-pointer items-start gap-2">
            <input
              type="checkbox"
              checked={previewMode}
              onChange={(e) => setPreviewMode(e.target.checked)}
              disabled={busy}
              className="mt-0.5 rounded border-slate-300 text-mech-600 focus:ring-mech-500"
            />
            <span>
              <span className="font-medium text-slate-700">Preview before adding</span>
              <span className="block text-slate-500">
                Search only — review results and add manually. Off by default: the sweep agent
                searches and adds new documents automatically.
              </span>
            </span>
          </label>
          <p>
            Powered by Exa — up to {sessionMax} unique documents per run ({plannedBatches} batches
            of {SWEEP_BATCH_SIZE}). Documents in your library are excluded from future sweeps.
          </p>
        </div>
      </details>

      {userError && (
        <Alert
          variant="error"
          title={userError.title}
          detail={userError.detail}
          onRetry={
            userError.retryable && lastQuery
              ? () => void handleSweep(lastQuery, results.length > 0 && previewMode)
              : undefined
          }
        />
      )}

      {showAgentLog && agentSteps && (
        <SweepAgentLog steps={agentSteps} batchProgress={loading ? batchProgress : null} />
      )}

      {addProgress && !showAgentLog && (
        <div className="flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2.5 text-sm text-sky-800">
          <Spinner className="h-4 w-4 shrink-0" />
          {addProgress}
        </div>
      )}

      {loading && previewMode && (
        <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50/50 px-4 py-6">
          <div className="flex items-center justify-center gap-2 text-sm text-slate-600">
            <Spinner className="h-5 w-5 text-mech-600" />
            {batchProgress && batchProgress.total > 1
              ? `Batch ${batchProgress.current} of ${batchProgress.total}…`
              : "Searching the web…"}
          </div>
          {batchProgress && batchProgress.total > 1 && (
            <ProgressBar
              value={batchProgress.current}
              max={batchProgress.total}
              label="Collecting results"
            />
          )}
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="animate-pulse rounded-lg bg-slate-200/70 h-16" />
            ))}
          </div>
        </div>
      )}

      {!loading && !hasSearched && (
        <EmptyState
          icon={<GlobeIcon className="h-7 w-7" />}
          title="Discover engineering documents"
          description="Click Sweep to run the agent — it searches the web and adds new documents to your library automatically."
        />
      )}

      {!loading && hasSearched && results.length === 0 && !error && (
        <EmptyState
          icon={<SearchIcon className="h-6 w-6" />}
          title="No results found"
          description="Try broader keywords, a different suggestion, or Sweep more if you've already collected results."
          action={
            lastQuery ? (
              <Button variant="secondary" size="sm" onClick={() => void handleSweep(lastQuery)}>
                Search again
              </Button>
            ) : undefined
          }
        />
      )}

      {!loading && results.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-slate-600">
              <span className="font-semibold text-slate-900">{results.length}</span> results
              {provider ? (
                <span className="text-slate-400"> · {providerLabel(provider)}</span>
              ) : null}
              {pendingCount < results.length && (
                <span className="text-slate-400">
                  {" "}
                  · {pendingCount} not yet in library
                </span>
              )}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void handleSweep(undefined, true)}
                disabled={busy}
              >
                Sweep more
              </Button>
              {previewMode && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void handleAddAll()}
                  disabled={busy || pendingCount === 0}
                  loading={adding}
                >
                  Add all{pendingCount > 0 ? ` (${pendingCount})` : ""}
                </Button>
              )}
            </div>
          </div>

          <ul className="space-y-2" aria-label="Sweep results">
            {results.map((result) => {
              const added = isDocumentUrlKnown(result.url, addedUrls);
              return (
                <li
                  key={result.url}
                  className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition hover:border-mech-200"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-slate-900">{result.title}</p>
                      <span className="rounded-full bg-mech-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-mech-700">
                        {result.type}
                      </span>
                      <span className="text-[10px] font-medium text-slate-400">
                        {relevancePercent(result.relevanceScore)} match
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-slate-600">
                      {result.description}
                    </p>
                    <a
                      href={result.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="mt-1.5 inline-block max-w-full truncate text-xs text-mech-600 hover:underline"
                    >
                      {result.url}
                    </a>
                  </div>
                  <Button
                    variant={added ? "secondary" : "primary"}
                    size="sm"
                    onClick={() => void onAdd(result)}
                    disabled={added || adding}
                    loading={adding && !added}
                    className="shrink-0"
                  >
                    {added ? "In library" : "Add"}
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
