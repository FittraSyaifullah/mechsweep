export type DocType =
  | "pdf"
  | "txt"
  | "csv"
  | "json"
  | "md"
  | "zip"
  | "stl"
  | "step"
  | "dwg";
export type DocSource = "upload" | "sweep";
export type DocStatus = "pending" | "processing" | "ready" | "error";

export interface MechDocument {
  id: string;
  title: string;
  type: DocType;
  source: DocSource;
  url?: string;
  content: string;
  summary?: string;
  tags?: string[];
  category?: string;
  pageCount?: number;
  pages?: DocumentPage[];
  tables?: ExtractedTable[];
  detectedLanguage?: string;
  detectedUnits?: string[];
  ocrStatus?: "not_needed" | "needed" | "unsupported";
  embedding?: number[];
  rowCount?: number;
  sizeBytes?: number;
  contentHash?: string;
  prefetchedText?: string;
  addedAt: string;
  status: DocStatus;
  error?: string;
}

export interface DocumentPage {
  pageNumber: number;
  text: string;
}

export interface ExtractedTable {
  id: string;
  title?: string;
  headers: string[];
  rows: string[][];
  source: "csv" | "html" | "text";
}

export interface SweepResult {
  title: string;
  url: string;
  type: DocType;
  description: string;
  relevanceScore: number;
  category?: string;
  prefetchedText?: string;
}

export interface ExportOptions {
  format: "txt" | "json" | "csv" | "pdf" | "zip";
  preset: "plain" | "langchain" | "llamaindex" | "openai";
  chunkSize: number;
  chunkOverlap: number;
  includeMetadata: boolean;
  includeContent: boolean;
  includeSummaries: boolean;
  includeTags: boolean;
}

export interface AnalyzeResult {
  summary: string;
  tags: string[];
  category: string;
  keyTopics: string[];
}

export const ME_CATEGORIES = [
  "Thermodynamics",
  "Fluid Mechanics",
  "Solid Mechanics",
  "Materials Science",
  "Manufacturing",
  "Dynamics & Vibrations",
  "Heat Transfer",
  "Machine Design",
  "FEA / FEM",
  "Control Systems",
  "Robotics",
  "HVAC",
  "Other",
] as const;

export type MeCategory = (typeof ME_CATEGORIES)[number];
