"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/Toast";
import Button from "@/components/ui/Button";
import { checkCloudSyncAvailable, resetCloudSyncState } from "@/lib/cloud-library";
import { getLibraryId, setLibraryId } from "@/lib/library-id";
import { syncDocumentsToCloud } from "@/lib/storage";

export default function LibrarySync() {
  const { toast } = useToast();
  const [libraryId, setLibraryIdState] = useState("");
  const [linkValue, setLinkValue] = useState("");
  const [open, setOpen] = useState(false);
  const [cloudReady, setCloudReady] = useState<boolean | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    setLibraryIdState(getLibraryId());
    void checkCloudSyncAvailable().then(setCloudReady);
  }, []);

  async function copySyncCode() {
    if (!libraryId) return;
    await navigator.clipboard.writeText(libraryId);
    toast("Sync code copied", "success");
  }

  async function syncNow() {
    setSyncing(true);
    try {
      const result = await syncDocumentsToCloud();
      if (!result.cloudEnabled) {
        toast("Cloud sync is not configured on the server", "error");
        setCloudReady(false);
        return;
      }

      if (result.ok) {
        toast(
          result.synced > 0
            ? `Synced ${result.synced} change${result.synced !== 1 ? "s" : ""} to cloud`
            : "Library is already up to date",
          "success"
        );
        return;
      }

      toast(
        `Sync incomplete — ${result.failed} item${result.failed !== 1 ? "s" : ""} failed`,
        "error"
      );
    } finally {
      setSyncing(false);
    }
  }

  function linkLibrary() {
    if (!setLibraryId(linkValue)) {
      toast("Enter a valid sync code (UUID)", "error");
      return;
    }

    resetCloudSyncState();
    toast("Linked library — reloading…", "success");
    window.setTimeout(() => window.location.reload(), 400);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 sm:px-3 sm:text-sm"
        aria-expanded={open}
      >
        Sync
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            aria-label="Close sync menu"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-4 shadow-float">
            <p className="text-sm font-medium text-slate-900">Cloud library sync</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Use the same sync code on every device. Documents upload one at a time to stay
              within server limits.
            </p>

            <p className="mt-2 text-xs">
              {cloudReady === null && "Checking cloud sync…"}
              {cloudReady === true && (
                <span className="text-emerald-700">Cloud sync is active</span>
              )}
              {cloudReady === false && (
                <span className="text-amber-700">Cloud sync unavailable on server</span>
              )}
            </p>

            <label className="mt-3 block text-xs font-medium text-slate-600">Your sync code</label>
            <div className="mt-1 flex gap-2">
              <code className="min-w-0 flex-1 truncate rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] text-slate-700">
                {libraryId || "…"}
              </code>
              <Button variant="ghost" size="sm" onClick={() => void copySyncCode()}>
                Copy
              </Button>
            </div>

            <Button
              variant="primary"
              size="sm"
              className="mt-3 w-full"
              loading={syncing}
              onClick={() => void syncNow()}
              icon={syncing ? undefined : undefined}
            >
              {syncing ? "Syncing…" : "Sync now"}
            </Button>

            <label className="mt-3 block text-xs font-medium text-slate-600">
              Link another device
            </label>
            <input
              type="text"
              value={linkValue}
              onChange={(event) => setLinkValue(event.target.value)}
              placeholder="Paste sync code from another computer"
              className="input-base mt-1 text-xs"
            />
            <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={linkLibrary}>
              Link library
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
