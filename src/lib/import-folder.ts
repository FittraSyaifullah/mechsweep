import { isDocType } from "@/lib/file-types";
import {
  createThrottledProgress,
  flushThrottledProgress,
  yieldToMain,
} from "@/lib/scheduling";
import type { DocSource, DocType } from "@/types";

export interface FolderImportProgress {
  phase: "scanning" | "reading";
  completed: number;
  total: number;
}

export interface FolderImportDocument {
  id?: string;
  title: string;
  type: DocType;
  source: DocSource;
  url?: string;
  content: string;
  summary?: string;
  tags?: string[];
  category?: string;
  addedAt?: string;
  contentHash?: string | null;
  pageCount?: number | null;
}

export interface FolderImportResult {
  folderName: string;
  documents: FolderImportDocument[];
  skippedFiles: number;
}

interface CorpusDocumentRecord {
  id?: string;
  title?: string;
  type?: string;
  source?: string;
  url?: string | null;
  category?: string | null;
  tags?: string[];
  summary?: string | null;
  content?: string;
  addedAt?: string;
  contentHash?: string | null;
  pageCount?: number | null;
  exportPath?: string;
}

interface CorpusIndex {
  format?: string;
  count?: number;
  documents?: CorpusDocumentRecord[];
}

type DirectoryPickerWindow = Window & {
  showDirectoryPicker?: (options?: {
    mode?: "read" | "readwrite";
  }) => Promise<FileSystemDirectoryHandle>;
};

type FileWithRelativePath = File & { webkitRelativePath?: string };

/** Same browsers as folder export — Chrome / Edge on HTTPS. */
export function isFolderImportSupported(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.isSecureContext &&
    typeof (window as DirectoryPickerWindow).showDirectoryPicker === "function"
  );
}

/** Folder upload via webkitdirectory (works in most browsers; loads all files into memory). */
export function isFolderUploadSupported(): boolean {
  return typeof document !== "undefined";
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\/+/, "");
}

function titleFromExportPath(path: string): string {
  const base = path.split("/").pop() ?? path;
  const withoutExt = base.replace(/\.txt$/i, "");
  const dashed = withoutExt.replace(/^\d+-/, "");
  return dashed.replace(/-/g, " ").trim() || base;
}

function parseFieldBlock(body: string, field: string): string {
  const match = body.match(new RegExp(`^${field}: (.*)$`, "m"));
  return match?.[1]?.trim() ?? "";
}

function parseMultilineField(body: string, field: string, until: RegExp): string {
  const marker = new RegExp(`\\n${field}:\\n`);
  const start = body.search(marker);
  if (start < 0) return "";
  const from = start + body.slice(start).indexOf("\n", 1) + 1;
  const rest = body.slice(from);
  const end = rest.search(until);
  const value = end >= 0 ? rest.slice(0, end) : rest;
  return value.trim();
}

/** Parse a single `documents/*.txt` file produced by MechSweep export. */
export function parseExportedDocumentTxt(text: string): FolderImportDocument | null {
  let body = text.replace(/^\uFEFF/, "");
  if (body.startsWith("Manifest:")) {
    const parts = body.split(/\n\n---\n\n/);
    body = parts.find((part) => /^Document \d+:/m.test(part)) ?? parts[parts.length - 1] ?? body;
  }

  const chunksIdx = body.search(/\n\nChunks:\n/);
  if (chunksIdx >= 0) {
    body = body.slice(0, chunksIdx);
  }

  const titleMatch = body.match(/^Document \d+: (.+)$/m);
  if (!titleMatch?.[1]) return null;

  const title = titleMatch[1].trim();
  const rawType = parseFieldBlock(body, "Type") || "txt";
  const type = isDocType(rawType) ? rawType : "txt";
  const rawSource = parseFieldBlock(body, "Source");
  const source: DocSource = rawSource === "sweep" ? "sweep" : "upload";
  const url = parseFieldBlock(body, "URL") || undefined;
  const category = parseFieldBlock(body, "Category") || undefined;
  const addedAt = parseFieldBlock(body, "Added") || undefined;
  const id = parseFieldBlock(body, "ID") || undefined;
  const tagsRaw = parseFieldBlock(body, "Tags");
  const tags = tagsRaw
    ? tagsRaw
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
    : undefined;
  const summary = parseMultilineField(body, "Summary", /\n(?:Content:|$)/) || undefined;
  const content = parseMultilineField(body, "Content", /\n---\n/) || "";

  if (!content.trim()) return null;

  return {
    id,
    title,
    type,
    source,
    url,
    category,
    addedAt,
    tags,
    summary,
    content,
  };
}

function recordToImportDoc(record: CorpusDocumentRecord, content: string): FolderImportDocument | null {
  const title = record.title?.trim();
  if (!title || !content.trim()) return null;

  const rawType = record.type ?? "txt";
  const type = isDocType(rawType) ? rawType : "txt";
  const rawSource = record.source ?? "upload";
  const source: DocSource = rawSource === "sweep" ? "sweep" : "upload";

  return {
    id: record.id,
    title,
    type,
    source,
    url: record.url ?? undefined,
    category: record.category ?? undefined,
    addedAt: record.addedAt,
    tags: record.tags,
    summary: record.summary ?? undefined,
    content,
    contentHash: record.contentHash ?? undefined,
    pageCount: record.pageCount ?? undefined,
  };
}

function parseCorpusIndex(raw: unknown): CorpusIndex | null {
  if (!raw || typeof raw !== "object") return null;
  const corpus = raw as CorpusIndex;
  if (!Array.isArray(corpus.documents)) return null;
  return corpus;
}

async function readTextFile(
  root: FileSystemDirectoryHandle,
  relativePath: string
): Promise<string | null> {
  const segments = normalizePath(relativePath).split("/").filter(Boolean);
  const fileName = segments.pop();
  if (!fileName) return null;

  let dir = root;
  for (const segment of segments) {
    dir = await dir.getDirectoryHandle(segment);
  }

  try {
    const handle = await dir.getFileHandle(fileName);
    const file = await handle.getFile();
    return await file.text();
  } catch {
    return null;
  }
}

type DirectoryHandleWithEntries = FileSystemDirectoryHandle & {
  entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
};

async function listDirectoryEntries(
  dir: FileSystemDirectoryHandle
): Promise<Array<[string, FileSystemHandle]>> {
  const items: Array<[string, FileSystemHandle]> = [];
  for await (const entry of (dir as DirectoryHandleWithEntries).entries()) {
    items.push(entry);
  }
  return items;
}

async function resolveExportRoot(dir: FileSystemDirectoryHandle): Promise<FileSystemDirectoryHandle> {
  if (await readTextFile(dir, "corpus.json")) return dir;

  for (const [name, handle] of await listDirectoryEntries(dir)) {
    if (handle.kind !== "directory" || !name.startsWith("mechsweep-")) continue;
    const subdir = handle as FileSystemDirectoryHandle;
    if (await readTextFile(subdir, "corpus.json")) return subdir;
  }

  try {
    await dir.getDirectoryHandle("documents");
    return dir;
  } catch {
    throw new Error(
      "No MechSweep export found. Select a folder containing corpus.json or a documents/ folder."
    );
  }
}

async function listDocumentPaths(dir: FileSystemDirectoryHandle): Promise<string[]> {
  const documentsDir = await dir.getDirectoryHandle("documents");
  const paths: string[] = [];

  for (const [name, handle] of await listDirectoryEntries(documentsDir)) {
    if (handle.kind === "file" && name.toLowerCase().endsWith(".txt")) {
      paths.push(`documents/${name}`);
    }
  }

  return paths.sort();
}

async function collectFromDirectoryHandle(
  root: FileSystemDirectoryHandle,
  onProgress?: (progress: FolderImportProgress) => void
): Promise<FolderImportResult> {
  onProgress?.({ phase: "scanning", completed: 0, total: 0 });

  const exportDir = await resolveExportRoot(root);
  const folderName = exportDir.name;
  const corpusRaw = await readTextFile(exportDir, "corpus.json");
  const corpus = corpusRaw ? parseCorpusIndex(JSON.parse(corpusRaw)) : null;

  const jobs: Array<{ path: string; record?: CorpusDocumentRecord }> = [];

  if (corpus?.format === "mechsweep-folder-v2" && corpus.documents?.length) {
    for (const record of corpus.documents) {
      if (record.exportPath) {
        jobs.push({ path: record.exportPath, record });
      }
    }
  } else if (corpus?.documents?.length && corpus.documents.some((doc) => doc.content?.trim())) {
    const documents = corpus.documents
      .map((record) => recordToImportDoc(record, record.content ?? ""))
      .filter((doc): doc is FolderImportDocument => doc !== null);

    onProgress?.({ phase: "reading", completed: documents.length, total: documents.length });
    return { folderName, documents, skippedFiles: corpus.documents.length - documents.length };
  } else {
    const paths = await listDocumentPaths(exportDir);
    for (const path of paths) {
      jobs.push({ path });
    }
  }

  if (jobs.length === 0) {
    throw new Error("Export folder has no importable documents.");
  }

  const documents: FolderImportDocument[] = [];
  let skippedFiles = 0;
  const report = createThrottledProgress(onProgress);

  report({ phase: "reading", completed: 0, total: jobs.length });

  for (let index = 0; index < jobs.length; index++) {
    const job = jobs[index]!;
    const text = await readTextFile(exportDir, job.path);
    if (!text) {
      skippedFiles += 1;
      continue;
    }

    const parsed = parseExportedDocumentTxt(text);
    if (!parsed) {
      skippedFiles += 1;
      continue;
    }

    if (job.record) {
      documents.push({
        ...parsed,
        id: job.record.id ?? parsed.id,
        title: job.record.title ?? parsed.title,
        type: job.record.type && isDocType(job.record.type) ? job.record.type : parsed.type,
        source: job.record.source === "sweep" ? "sweep" : parsed.source,
        url: job.record.url ?? parsed.url,
        category: job.record.category ?? parsed.category,
        addedAt: job.record.addedAt ?? parsed.addedAt,
        tags: job.record.tags ?? parsed.tags,
        summary: job.record.summary ?? parsed.summary,
        contentHash: job.record.contentHash ?? undefined,
        pageCount: job.record.pageCount ?? undefined,
        content: parsed.content,
      });
    } else {
      documents.push(parsed);
    }

    report({ phase: "reading", completed: index + 1, total: jobs.length });

    if (index % 4 === 3) {
      await yieldToMain();
    }
  }

  flushThrottledProgress(report, { phase: "reading", completed: jobs.length, total: jobs.length });

  return { folderName, documents, skippedFiles };
}

function resolveVirtualExportRoot(fileMap: Map<string, string>): string {
  for (const path of Array.from(fileMap.keys())) {
    if (path.endsWith("/corpus.json") || path === "corpus.json") {
      const dir = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
      return dir;
    }
  }

  for (const path of Array.from(fileMap.keys())) {
    if (path.includes("/documents/") || path.startsWith("documents/")) {
      const dir = path.includes("/") ? path.slice(0, path.indexOf("/documents/")) : "";
      return dir;
    }
  }

  throw new Error(
    "No MechSweep export found. Select a folder containing corpus.json or a documents/ folder."
  );
}

function virtualPath(fileMap: Map<string, string>, root: string, relativePath: string): string | null {
  const normalized = normalizePath(relativePath);
  const candidates = root
    ? [`${root}/${normalized}`, normalized]
    : [normalized, `${normalized}`];

  for (const candidate of candidates) {
    if (fileMap.has(candidate)) return candidate;
  }
  return null;
}

async function collectFromFileMap(
  fileMap: Map<string, string>,
  onProgress?: (progress: FolderImportProgress) => void
): Promise<FolderImportResult> {
  onProgress?.({ phase: "scanning", completed: 0, total: 0 });

  const root = resolveVirtualExportRoot(fileMap);
  const folderName = root ? root.split("/").pop() ?? root : "export";
  const corpusKey = virtualPath(fileMap, root, "corpus.json");
  const corpus = corpusKey ? parseCorpusIndex(JSON.parse(fileMap.get(corpusKey)!)) : null;

  const jobs: Array<{ path: string; record?: CorpusDocumentRecord }> = [];

  if (corpus?.format === "mechsweep-folder-v2" && corpus.documents?.length) {
    for (const record of corpus.documents) {
      if (record.exportPath) jobs.push({ path: record.exportPath, record });
    }
  } else if (corpus?.documents?.length && corpus.documents.some((doc) => doc.content?.trim())) {
    const documents = corpus.documents
      .map((record) => recordToImportDoc(record, record.content ?? ""))
      .filter((doc): doc is FolderImportDocument => doc !== null);

    onProgress?.({ phase: "reading", completed: documents.length, total: documents.length });
    return { folderName, documents, skippedFiles: corpus.documents.length - documents.length };
  } else {
    const prefix = root ? `${root}/documents/` : "documents/";
    const paths = Array.from(fileMap.keys())
      .filter((path) => path.startsWith(prefix) && path.toLowerCase().endsWith(".txt"))
      .map((path) => path.slice(root ? root.length + 1 : 0))
      .sort();
    for (const path of paths) jobs.push({ path });
  }

  if (jobs.length === 0) {
    throw new Error("Export folder has no importable documents.");
  }

  const documents: FolderImportDocument[] = [];
  let skippedFiles = 0;
  const report = createThrottledProgress(onProgress);

  report({ phase: "reading", completed: 0, total: jobs.length });

  for (let index = 0; index < jobs.length; index++) {
    const job = jobs[index]!;
    const key = virtualPath(fileMap, root, job.path);
    const text = key ? fileMap.get(key) : null;
    if (!text) {
      skippedFiles += 1;
      continue;
    }

    const parsed = parseExportedDocumentTxt(text);
    if (!parsed) {
      skippedFiles += 1;
      continue;
    }

    if (job.record) {
      documents.push({
        ...parsed,
        id: job.record.id ?? parsed.id,
        title: job.record.title ?? parsed.title,
        type: job.record.type && isDocType(job.record.type) ? job.record.type : parsed.type,
        source: job.record.source === "sweep" ? "sweep" : parsed.source,
        url: job.record.url ?? parsed.url,
        category: job.record.category ?? parsed.category,
        addedAt: job.record.addedAt ?? parsed.addedAt,
        tags: job.record.tags ?? parsed.tags,
        summary: job.record.summary ?? parsed.summary,
        contentHash: job.record.contentHash ?? undefined,
        pageCount: job.record.pageCount ?? undefined,
        content: parsed.content,
      });
    } else {
      documents.push(parsed);
    }

    report({ phase: "reading", completed: index + 1, total: jobs.length });

    if (index % 4 === 3) {
      await yieldToMain();
    }
  }

  flushThrottledProgress(report, { phase: "reading", completed: jobs.length, total: jobs.length });

  return { folderName, documents, skippedFiles };
}

/** Pick an export folder and read documents one file at a time. */
export async function importDocumentsFromFolder(
  onProgress?: (progress: FolderImportProgress) => void
): Promise<FolderImportResult> {
  if (!isFolderImportSupported()) {
    throw new Error("Folder import requires Chrome or Edge on HTTPS.");
  }

  const picker = (window as DirectoryPickerWindow).showDirectoryPicker;
  if (!picker) {
    throw new Error("Folder import is unavailable in this browser.");
  }

  const dir = await picker({ mode: "read" });
  return collectFromDirectoryHandle(dir, onProgress);
}

/** Import from a folder chosen via webkitdirectory (all files loaded into memory). */
export async function importDocumentsFromFileList(
  files: FileList | File[],
  onProgress?: (progress: FolderImportProgress) => void
): Promise<FolderImportResult> {
  const fileMap = new Map<string, string>();

  for (const file of Array.from(files)) {
    const relativePath = normalizePath(
      (file as FileWithRelativePath).webkitRelativePath || file.name
    );
    fileMap.set(relativePath, await file.text());
  }

  return collectFromFileMap(fileMap, onProgress);
}

/** Read a prepared export file map — used by stress tests and tooling. */
export async function importDocumentsFromFileMap(
  fileMap: Map<string, string>,
  onProgress?: (progress: FolderImportProgress) => void
): Promise<FolderImportResult> {
  return collectFromFileMap(fileMap, onProgress);
}

export function titleFromImportPath(path: string): string {
  return titleFromExportPath(path);
}
