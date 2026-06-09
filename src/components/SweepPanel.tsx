"use client";

import { useState } from "react";
import { DEFAULT_SWEEP_MAX_RESULTS } from "@/lib/constants";
import { fetchJson } from "@/lib/fetch-json";
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
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [provider, setProvider] = useState<string | null>(null);

  async function handleSweep(searchQuery?: string, append = false) {
    const q = (searchQuery ?? query).trim();
    if (searchQuery) setQuery(searchQuery);

    setLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const { response: res, data } = await fetchJson<{
        results?: SweepResult[];
        provider?: string;
        error?: string;
      }>("/api/sweep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: q || undefined,
          excludeUrls: append
            ? [...Array.from(addedUrls), ...results.map((result) => result.url)]
            : Array.from(addedUrls),
        }),
      });
      if (!res.ok) throw new Error(data.error ?? "Sweep failed");
      setProvider(data.provider ?? "exa");
      const nextResults = data.results ?? [];
      setResults((prev) => {
        const merged = append ? [...prev] : [];
        const seen = new Set(merged.map((result) => result.url));
        for (const result of nextResults) {
          if (!seen.has(result.url)) {
            merged.push(result);
            seen.add(result.url);
          }
        }
        return merged;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sweep failed");
      if (!append) setResults([]);
    } finally {
      setLoading(false);
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

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Search the web for up to {DEFAULT_SWEEP_MAX_RESULTS} publicly accessible mechanical engineering documents per sweep.
        Use Sweep more to append additional unique resources.
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
          Searching for documents…
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
