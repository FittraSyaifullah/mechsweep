"use client";

import { useCallback, useRef, useState } from "react";
import { detectDocType, extractTextFromCsv, extractTextFromTxt } from "@/lib/parser";
import {
  detectLanguage,
  detectUnits,
  extractTablesFromCsv,
} from "@/lib/processing";
import type { DocType, DocumentPage, ExtractedTable, MechDocument } from "@/types";
import { Spinner } from "@/components/ui/Icons";

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
            const formData = new FormData();
            formData.append("file", file);
            const res = await fetch("/api/parse-pdf", { method: "POST", body: formData });
            const data = (await res.json()) as {
              text?: string;
              pageCount?: number;
              pages?: DocumentPage[];
              tables?: ExtractedTable[];
              detectedLanguage?: string;
              detectedUnits?: string[];
              ocrStatus?: MechDocument["ocrStatus"];
              error?: string;
            };
            if (!res.ok) throw new Error(data.error ?? "PDF parse failed");
            uploaded.push({
              title: file.name.replace(/\.[^.]+$/, ""),
              type,
              content: data.text ?? "",
              pageCount: data.pageCount,
              pages: data.pages,
              tables: data.tables,
              detectedLanguage: data.detectedLanguage,
              detectedUnits: data.detectedUnits,
              ocrStatus: data.ocrStatus,
              sizeBytes: file.size,
            });
          } else if (type === "csv") {
            const text = await file.text();
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
          } else {
            const text = await file.text();
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
        Upload PDF, TXT, or CSV files. Text is extracted and analyzed automatically.
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
            <p className="text-sm font-medium text-slate-900">Drop files here</p>
            <p className="mt-1 text-xs text-slate-500">PDF · TXT · CSV — or click to browse</p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.txt,.csv"
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
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}
