"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Icons";
import { useToast } from "@/components/Toast";
import { useSupabase } from "@/contexts/SupabaseProvider";
import {
  fetchCloudLibraryCount,
  pullAndMergeLibrary,
  uploadLibraryToSupabase,
  type CloudSyncProgress,
} from "@/lib/supabase/sync";
import type { MechDocument } from "@/types";

interface CloudSyncPanelProps {
  documents: MechDocument[];
  onLibraryMerged: (docs: MechDocument[]) => void;
}

function progressLabel(progress: CloudSyncProgress | null): string {
  if (!progress) return "";
  const pct =
    progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;
  const labels: Record<CloudSyncProgress["phase"], string> = {
    index: "Updating index",
    upload: "Uploading",
    download: "Downloading",
    delete: "Cleaning cloud",
    merge: "Merging",
  };
  return `${labels[progress.phase]}… ${pct}%`;
}

export default function CloudSyncPanel({ documents, onLibraryMerged }: CloudSyncPanelProps) {
  const { toast } = useToast();
  const { configured, client, user, loading, signIn, signUp, signOut } = useSupabase();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState<CloudSyncProgress | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [cloudCount, setCloudCount] = useState<number | null>(null);
  const [cloudCountLoading, setCloudCountLoading] = useState(false);

  useEffect(() => {
    if (!open || !client || !user) {
      setCloudCount(null);
      return;
    }

    let active = true;
    setCloudCountLoading(true);
    void fetchCloudLibraryCount(client, user.id)
      .then((count) => {
        if (active) setCloudCount(count);
      })
      .catch(() => {
        if (active) setCloudCount(null);
      })
      .finally(() => {
        if (active) setCloudCountLoading(false);
      });

    return () => {
      active = false;
    };
  }, [open, client, user]);

  async function handleAuthSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAuthError(null);
    setAuthMessage(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || password.length < 6) {
      setAuthError("Enter a valid email and password (min 6 characters).");
      return;
    }

    if (mode === "sign-in") {
      const result = await signIn(trimmedEmail, password);
      if (result.error) setAuthError(result.error);
      else setOpen(true);
      return;
    }

    const result = await signUp(trimmedEmail, password);
    if (result.error) setAuthError(result.error);
    else if (result.message) setAuthMessage(result.message);
    else setOpen(true);
  }

  async function handleUpload() {
    if (!client || !user) return;
    setSyncing(true);
    setSyncError(null);
    setProgress(null);
    try {
      await uploadLibraryToSupabase(client, user.id, documents, setProgress);
      setCloudCount(documents.length);
      toast(`Uploaded ${documents.length.toLocaleString()} documents to cloud`, "success");
      setOpen(false);
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setSyncing(false);
      setProgress(null);
    }
  }

  async function handleDownload() {
    if (!client || !user) return;
    setSyncing(true);
    setSyncError(null);
    setProgress(null);
    try {
      const merged = await pullAndMergeLibrary(client, user.id, documents, setProgress);
      onLibraryMerged(merged);
      setOpen(false);
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setSyncing(false);
      setProgress(null);
    }
  }

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={
          !configured
            ? "Supabase cloud sync setup"
            : user
              ? "Cloud sync options"
              : "Sign in to cloud sync"
        }
      >
        {loading ? (
          <Spinner className="h-4 w-4" aria-hidden="true" />
        ) : (
          "Cloud"
        )}
      </Button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default bg-black/20"
            aria-label="Close cloud sync panel"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Cloud library sync"
            className="absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white p-4 shadow-float"
          >
            {!configured ? (
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Connect Supabase</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">
                    Add these to <code className="rounded bg-slate-100 px-1">.env.local</code>{" "}
                    (and Vercel env vars for production), then restart the app:
                  </p>
                </div>
                <pre className="overflow-x-auto rounded-lg bg-slate-900 p-3 text-[11px] leading-relaxed text-slate-100">
                  {`NEXT_PUBLIC_SUPABASE_URL=\n  https://YOUR-PROJECT.supabase.co\nNEXT_PUBLIC_SUPABASE_ANON_KEY=\n  eyJ...your-anon-key`}
                </pre>
                <p className="text-xs text-slate-600">
                  Run <code className="rounded bg-slate-100 px-1">supabase/migrations/001_library.sql</code>{" "}
                  in the Supabase SQL Editor, then enable Email auth.
                </p>
              </div>
            ) : user ? (
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Cloud library</p>
                  <p className="mt-0.5 truncate text-xs text-slate-600">{user.email}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Local: {documents.length.toLocaleString()} · Cloud:{" "}
                    {cloudCountLoading
                      ? "…"
                      : cloudCount != null
                        ? cloudCount.toLocaleString()
                        : "—"}
                  </p>
                </div>

                {documents.length === 0 && cloudCount != null && cloudCount > 0 && (
                  <p className="rounded-lg border border-mech-200 bg-mech-50 px-3 py-2 text-xs text-mech-800">
                    Your cloud library has {cloudCount.toLocaleString()} documents. Use Download
                    &amp; merge to restore them on this device.
                  </p>
                )}

                <p className="text-xs leading-relaxed text-slate-600">
                  Upload replaces your cloud library with this device. Download merges cloud
                  documents with local ones.
                </p>

                {syncError && (
                  <p
                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
                    role="alert"
                  >
                    {syncError}
                  </p>
                )}

                {progress && (
                  <p className="flex items-center gap-2 text-xs text-sky-700">
                    <Spinner className="h-3.5 w-3.5" aria-hidden="true" />
                    {progressLabel(progress)}
                  </p>
                )}

                <div className="flex flex-col gap-2">
                  <Button
                    size="sm"
                    onClick={() => void handleUpload()}
                    disabled={syncing || documents.length === 0}
                    loading={syncing && progress?.phase === "upload"}
                  >
                    Upload to cloud ({documents.length.toLocaleString()})
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void handleDownload()}
                    disabled={
                      syncing ||
                      cloudCountLoading ||
                      (cloudCount !== null && cloudCount === 0)
                    }
                    loading={syncing && progress?.phase !== "upload"}
                  >
                    Download &amp; merge
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void signOut()}
                    disabled={syncing}
                  >
                    Sign out
                  </Button>
                </div>
              </div>
            ) : (
              <form className="space-y-3" onSubmit={(e) => void handleAuthSubmit(e)}>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Sign in to Supabase</p>
                  <p className="mt-0.5 text-xs text-slate-600">
                    Sync your library across devices.
                  </p>
                </div>

                <div>
                  <label htmlFor="cloud-email" className="filter-label">
                    Email
                  </label>
                  <input
                    id="cloud-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input-base"
                  />
                </div>

                <div>
                  <label htmlFor="cloud-password" className="filter-label">
                    Password
                  </label>
                  <input
                    id="cloud-password"
                    type="password"
                    autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-base"
                  />
                </div>

                {authError && (
                  <p className="text-xs text-red-700" role="alert">
                    {authError}
                  </p>
                )}
                {authMessage && (
                  <p className="text-xs text-emerald-700" role="status">
                    {authMessage}
                  </p>
                )}

                <div className="flex flex-col gap-2">
                  <Button type="submit" size="sm">
                    {mode === "sign-in" ? "Sign in" : "Create account"}
                  </Button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode((current) => (current === "sign-in" ? "sign-up" : "sign-in"));
                      setAuthError(null);
                      setAuthMessage(null);
                    }}
                    className="text-xs font-semibold text-mech-700 hover:text-mech-900"
                  >
                    {mode === "sign-in"
                      ? "Need an account? Sign up"
                      : "Already have an account? Sign in"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </>
      )}
    </div>
  );
}
