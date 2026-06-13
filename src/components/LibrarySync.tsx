"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/Toast";
import Button from "@/components/ui/Button";
import { getLibraryId, setLibraryId } from "@/lib/library-id";
import { resetCloudSyncState } from "@/lib/cloud-library";

export default function LibrarySync() {
  const { toast } = useToast();
  const [libraryId, setLibraryIdState] = useState("");
  const [linkValue, setLinkValue] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setLibraryIdState(getLibraryId());
  }, []);

  async function copySyncCode() {
    if (!libraryId) return;
    await navigator.clipboard.writeText(libraryId);
    toast("Sync code copied", "success");
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
              Your documents sync across devices when you use the same sync code.
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
            <Button variant="primary" size="sm" className="mt-3 w-full" onClick={linkLibrary}>
              Link library
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
