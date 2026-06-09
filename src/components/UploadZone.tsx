"use client";

import { useCallback, useRef, useState } from "react";
import {
  detectDocType,
  extractTextFromCsv,
  extractTextFromJson,
  extractTextFromMd,
  extractTextFromTxt,
} from "@/lib/parser";
import {
  detectLanguage,
  detectUnits,
  extractTablesFromCsv,
} from "@/lib/processing";
import {
  SUPPORTED_TYPE_LABELS,
  UPLOAD_ACCEPT,
} from "@/lib/file-types";
import { MAX_LIBRARY_DOCUMENTS } from "@/lib/constants";
import type { DocType, DocumentPage, ExtractedTable, MechDocument } from "@/types";
import Alert from "@/components/ui/Alert";
import { Spinner, UploadIcon } from "@/components/ui/Icons";

export interface UploadedFile {
  title: string;
  type: DocType;
  content: string;
  pageCount?: number;
  pages?: DocumentPage[];
  tables?: ExtractedTable[];
  detectedLanguage?: string;
  detectedUnits?: string[];
  ocrStatus?: MechDocument["ocrStatus"];
  rowCount?: number;
  sizeBytes: number;
}

interface UploadZoneProps {
  onUpload: (files: UploadedFile[]) => void | Promise<void>;
}

const SERVER_EXTRACT_TYPES = new Set<DocType>(["pdf", "zip", "stl", "step", "dwg"]);

async function extractViaApi(file: File, type: DocType, endpoint: string): Promise<UploadedFile> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("type", type);
  const res = await fetch(endpoint, { method: "POST", body: formData });
  const data = (await res.json()) as {
    text?: string;
    pageCount?: number;
    pages?: DocumentPage[];
    tables?: ExtractedTable[];
    detectedLanguage?: string;
    detectedUnits?: string[];
    ocrStatus?: MechDocument["ocrStatus"];
    rowCount?: number;
    error?: string;
  };
  if (!res.ok) throw new Error(data.error ?? "File extract failed");
  return {
    title: file.name.replace(/\.[^.]+$/, ""),
    type,
    content: data.text ?? "",
    pageCount: data.pageCount,
    pages: data.pages,
    tables: data.tables,
    detectedLanguage: data.detectedLanguage,
    detectedUnits: data.detectedUnits,
    ocrStatus: data.ocrStatus,
    rowCount: data.rowCount,
    sizeBytes: file.size,
  };
}

export default function UploadZone({ onUpload }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processFiles = useCallback(
    async (fileList: FileList | File[]) => {
      setProcessing(true);
      setError(null);
      const uploaded: UploadedFile[] = [];

      for (const file of Array.from(fileList)) {
        const type = detectDocType(file.name);
        if (!type) {
          setError(`Unsupported file: ${file.name}`);
          continue;
        }

        try {
          if (type === "pdf") {
            uploaded.push(await extractViaApi(file, type, "/api/parse-pdf"));
            continue;
          }

          if (SERVER_EXTRACT_TYPES.has(type)) {
            uploaded.push(await extractViaApi(file, type, "/api/extract-file"));
            continue;
          }

          const text = await file.text();
          if (type === "csv") {
            const { text: csvText, rowCount } = extractTextFromCsv(text);
            uploaded.push({
              title: file.name.replace(/\.[^.]+$/, ""),
              type,
              content: csvText,
              rowCount,
              tables: extractTablesFromCsv(text),
              detectedLanguage: detectLanguage(csvText),
              detectedUnits: detectUnits(csvText),
              ocrStatus: "not_needed",
              sizeBytes: file.size,
            });
          } else if (type === "json") {
            const content = extractTextFromJson(text);
            uploaded.push({
              title: file.name.replace(/\.[^.]+$/, ""),
              type,
              content,
              detectedLanguage: detectLanguage(content),
              detectedUnits: detectUnits(content),
              ocrStatus: "not_needed",
              sizeBytes: file.size,
            });
          } else if (type === "md") {
            const content = extractTextFromMd(text);
            uploaded.push({
              title: file.name.replace(/\.[^.]+$/, ""),
              type,
              content,
              detectedLanguage: detectLanguage(content),
              detectedUnits: detectUnits(content),
              ocrStatus: "not_needed",
              sizeBytes: file.size,
            });
          } else {
            const content = extractTextFromTxt(text);
            uploaded.push({
              title: file.name.replace(/\.[^.]+$/, ""),
              type,
              content,
              detectedLanguage: detectLanguage(content),
              detectedUnits: detectUnits(content),
              ocrStatus: "not_needed",
              sizeBytes: file.size,
            });
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : `Failed: ${file.name}`);
        }
      }

      if (uploaded.length > 0) await onUpload(uploaded);
      setProcessing(false);
    },
    [onUpload]
  );

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        Upload {SUPPORTED_TYPE_LABELS} files. Up to {MAX_LIBRARY_DOCUMENTS.toLocaleString()} documents stored locally in this browser.
      </p>

      <div
        role="button"
        tabIndex={0}
        onClick={() => !processing && inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && !processing && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files.length > 0) void processFiles(e.dataTransfer.files);
        }}
        className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-14 transition ${
          dragging
            ? "border-mech-400 bg-mech-50"
            : processing
              ? "cursor-wait border-slate-200 bg-slate-50"
              : "cursor-pointer border-slate-300 bg-white hover:border-mech-400 hover:bg-slate-50"
        }`}
      >
        {processing ? (
          <>
            <Spinner className="h-6 w-6 text-mech-600" />
            <p className="mt-3 text-sm font-medium text-slate-700">Processing files…</p>
          </>
        ) : (
          <>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
              <UploadIcon className="h-6 w-6" />
            </div>
            <p className="mt-4 text-sm font-medium text-slate-900">Drop files here</p>
            <p className="mt-1 text-xs text-slate-500">{SUPPORTED_TYPE_LABELS} — or click to browse</p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={UPLOAD_ACCEPT}
          multiple
          onChange={(e) => {
            if (e.target.files?.length) {
              void processFiles(e.target.files);
              e.target.value = "";
            }
          }}
          disabled={processing}
          className="hidden"
        />
      </div>

      {error && (
        <Alert variant="error" title="Upload failed" detail={error} onRetry={() => setError(null)} retryLabel="Dismiss" />
      )}
    </div>
  );
}
