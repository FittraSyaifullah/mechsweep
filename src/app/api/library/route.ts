import { NextRequest, NextResponse } from "next/server";
import { readJsonBody } from "@/lib/json-safe";
import {
  assertLibraryId,
  isCloudStorageConfigured,
  listCloudDocuments,
  syncCloudDocuments,
} from "@/lib/cloud-library-server";
import type { MechDocument } from "@/types";

interface SyncRequestBody {
  documents?: MechDocument[];
  deletedIds?: string[];
}

export async function GET(request: NextRequest) {
  const libraryId = assertLibraryId(request.nextUrl.searchParams.get("libraryId"));
  if (!libraryId) {
    return NextResponse.json({ error: "Valid libraryId is required" }, { status: 400 });
  }

  if (!isCloudStorageConfigured()) {
    return NextResponse.json({ documents: [], cloudEnabled: false });
  }

  try {
    const documents = await listCloudDocuments(libraryId);
    return NextResponse.json({
      documents,
      cloudEnabled: true,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cloud library read failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const libraryId = assertLibraryId(request.nextUrl.searchParams.get("libraryId"));
  if (!libraryId) {
    return NextResponse.json({ error: "Valid libraryId is required" }, { status: 400 });
  }

  if (!isCloudStorageConfigured()) {
    return NextResponse.json({ cloudEnabled: false, synced: 0 });
  }

  try {
    const body = await readJsonBody<SyncRequestBody>(request, {
      maxBytes: 25_000_000,
      label: "Library sync payload",
    });

    const documents = Array.isArray(body.documents) ? body.documents : [];
    const deletedIds = Array.isArray(body.deletedIds)
      ? body.deletedIds.filter((id): id is string => typeof id === "string" && id.length > 0)
      : [];

    const synced = await syncCloudDocuments(libraryId, documents, deletedIds);
    return NextResponse.json({ cloudEnabled: true, synced });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cloud library sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
