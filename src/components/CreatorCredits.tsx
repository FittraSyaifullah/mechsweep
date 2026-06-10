"use client";

import { useEffect } from "react";
import { useToast } from "@/components/Toast";

const CREDITS_MESSAGE = "MechSweep is created by Fittra Syaifullah";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    target.isContentEditable ||
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT"
  );
}

export default function CreatorCredits() {
  const { toast } = useToast();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "y") return;
      if (isEditableTarget(event.target)) return;

      event.preventDefault();
      toast(CREDITS_MESSAGE, "info");
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [toast]);

  return null;
}
