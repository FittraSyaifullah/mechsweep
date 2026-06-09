import type { DocType } from "@/types";

export const DOC_TYPES: DocType[] = [
  "pdf",
  "txt",
  "csv",
  "json",
  "md",
  "zip",
  "stl",
  "step",
  "dwg",
];

export const EXTENSION_TO_TYPE: Record<string, DocType> = {
  pdf: "pdf",
  txt: "txt",
  csv: "csv",
  json: "json",
  md: "md",
  markdown: "md",
  zip: "zip",
  stl: "stl",
  step: "step",
  stp: "step",
  dwg: "dwg",
};

export const UPLOAD_ACCEPT =
  ".pdf,.txt,.csv,.json,.md,.markdown,.zip,.stl,.step,.stp,.dwg";

export const SUPPORTED_TYPE_LABELS = "PDF, JSON, CSV, STL, STEP, TXT, DWG, MD, ZIP";

export const SWEEP_TYPE_HINT = "pdf|txt|csv|json|md|zip|stl|step|dwg";

export const URL_EXTENSION_PATTERN =
  /\.(pdf|txt|csv|json|md|markdown|zip|stl|step|stp|dwg)(\?|#|$)/i;

export function isDocType(value: string): value is DocType {
  return (DOC_TYPES as string[]).includes(value);
}

export function extensionFromPath(path: string): string | null {
  const segment = path.split("?")[0]?.split("#")[0]?.split("/").pop() ?? "";
  const dot = segment.lastIndexOf(".");
  if (dot <= 0) return null;
  return segment.slice(dot + 1).toLowerCase();
}

export function docTypeFromExtension(path: string): DocType | null {
  const ext = extensionFromPath(path);
  if (!ext) return null;
  return EXTENSION_TO_TYPE[ext] ?? null;
}

export function docTypeLabel(type: DocType): string {
  return type.toUpperCase();
}

export function hasDirectDocumentUrl(url: string): boolean {
  return docTypeFromExtension(url) !== null;
}
