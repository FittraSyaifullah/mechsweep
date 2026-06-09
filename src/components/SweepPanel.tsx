"use client";

import { useState } from "react";
import {
  DEFAULT_SWEEP_SESSION_MAX,
  SWEEP_BATCH_SIZE,
} from "@/lib/constants";
import { runBatchedSweep } from "@/lib/sweep-client";
import { resolveSweepSessionMax, sweepBatchCount } from "@/lib/sweep-limits";
import type { SweepResult } from "@/types";
import Button from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Icons";

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
}

function providerLabel(provider: string | null): string {
  if (provider === "exa") return "Exa Search";
  if (provider === "mistral") return "Mistral AI";
  if (provider === "openrouter") return "OpenRouter";
  return provider ?? "";
}

export default function SweepPanel({ onAdd, addedUrls }: SweepPanelProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SweepResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addProgress, setAddProgress] = useState<string | null>(null);
  const [sweepProgress, setSweepProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [provider, setProvider] = useState<string | null>(null);

  async function handleSweep(searchQuery?: string, append = false) {
    const q = (searchQuery ?? query).trim();
    if (searchQuery) setQuery(searchQuery);

    setLoading(true);
    setError(null);
    setSweepProgress(null);
    setHasSearched(true);

    try {
      const sessionMax = resolveSweepSessionMax();
      const outcome = await runBatchedSweep({
        query: q,
        excludeUrls: Array.from(addedUrls),
        totalTarget: sessionMax,
        batchSize: SWEEP_BATCH_SIZE,
        singleBatch: append,
        existingResults: append ? results : [],
        onProgress: (batchIndex, total) => {
          setSweepProgress(
            total > 1 ? `Batch ${batchIndex} of ${total}…` : "Searching…"
          );
        },
      });

      setProvider(outcome.provider ?? "exa");
      setResults(outcome.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sweep failed");
      if (!append) setResults([]);
    } finally {
      setLoading(false);
      setSweepProgress(null);
    }
  }

  async function handleAddAll() {
    const pending = results.filter((r) => !addedUrls.has(r.url));
    if (pending.length === 0 || adding) return;

    setAdding(true);
    try {
      for (let i = 0; i < pending.length; i++) {
        setAddProgress(`Adding ${i + 1}/${pending.length}…`);
        await onAdd(pending[i]);
      }
    } finally {
      setAdding(false);
      setAddProgress(null);
    }
  }

  const busy = loading || adding;
  const sessionMax = resolveSweepSessionMax();
  const plannedBatches = sweepBatchCount(sessionMax, SWEEP_BATCH_SIZE);

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Exa-powered sweep (primary web search) collects up to {sessionMax} unique documents
        per run ({plannedBatches} batches of {SWEEP_BATCH_SIZE}). Mistral is used for
        document analysis only. Use Sweep more to append another batch.
      </p>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !busy && handleSweep()}
          placeholder="e.g. heat transfer, machine design…"
          disabled={busy}
          className="input-base flex-1"
        />
        <Button onClick={() => handleSweep()} loading={loading} disabled={adding} className="sm:shrink-0">
          {loading ? "Searching…" : "Sweep"}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => handleSweep(s)}
            disabled={busy}
            className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600 hover:border-mech-300 hover:text-mech-700 disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {addProgress && (
        <div className="flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-700">
          <Spinner className="h-4 w-4" />
          {addProgress}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
          <Spinner className="h-5 w-5 text-mech-600" />
          {sweepProgress ?? "Searching for documents…"}
        </div>
      )}

      {!loading && hasSearched && results.length === 0 && !error && (
        <p className="py-6 text-center text-sm text-slate-500">
          No results. Try a different query or suggestion.
        </p>
      )}

      {!loading && results.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-500">
              {results.length} results
              {provider ? ` · ${providerLabel(provider)}` : ""}
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleSweep(undefined, true)}
                disabled={busy}
                className="text-xs font-medium text-mech-600 hover:underline disabled:text-slate-400"
              >
                Sweep more
              </button>
              <button
                type="button"
                onClick={() => void handleAddAll()}
                disabled={busy || results.every((r) => addedUrls.has(r.url))}
                className="text-xs font-medium text-mech-600 hover:underline disabled:text-slate-400"
              >
                Add all
              </button>
            </div>
          </div>

          {results.map((result) => {
            const added = addedUrls.has(result.url);
            return (
              <div
                key={result.url}
                className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/50 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">{result.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-sm text-slate-600">
                    {result.description}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {result.type.toUpperCase()}
                    {result.category ? ` · ${result.category}` : ""}
                  </p>
                </div>
                <Button
                  variant={added ? "secondary" : "primary"}
                  size="sm"
                  onClick={() => void onAdd(result)}
                  disabled={added || adding}
                  loading={adding && !added}
                  className="shrink-0"
                >
                  {added ? "Added" : "Add"}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
