import { NextRequest, NextResponse } from "next/server";
import { readJsonBody } from "@/lib/json-safe";
import {
  assertLibraryId,
  deleteCloudDocument,
  isCloudStorageConfigured,
  upsertCloudDocument,
} from "@/lib/cloud-library-server";
import type { MechDocument } from "@/types";

export async function PUT(request: NextRequest) {
  const libraryId = assertLibraryId(request.nextUrl.searchParams.get("libraryId"));
  if (!libraryId) {
    return NextResponse.json({ error: "Valid libraryId is required" }, { status: 400 });
  }

  if (!isCloudStorageConfigured()) {
    return NextResponse.json({ cloudEnabled: false, synced: 0 });
  }

  try {
    const doc = await readJsonBody<MechDocument>(request, {
      maxBytes: 4_500_000,
      label: "Document sync payload",
    });

    if (!doc?.id?.trim()) {
      return NextResponse.json({ error: "Document id is required" }, { status: 400 });
    }

    await upsertCloudDocument(libraryId, doc);
    return NextResponse.json({ cloudEnabled: true, synced: 1, id: doc.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cloud document sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const libraryId = assertLibraryId(request.nextUrl.searchParams.get("libraryId"));
  const docId = request.nextUrl.searchParams.get("docId")?.trim();

  if (!libraryId) {
    return NextResponse.json({ error: "Valid libraryId is required" }, { status: 400 });
  }

  if (!docId) {
    return NextResponse.json({ error: "docId is required" }, { status: 400 });
  }

  if (!isCloudStorageConfigured()) {
    return NextResponse.json({ cloudEnabled: false, synced: 0 });
  }

  try {
    await deleteCloudDocument(libraryId, docId);
    return NextResponse.json({ cloudEnabled: true, synced: 1, id: docId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cloud document delete failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
