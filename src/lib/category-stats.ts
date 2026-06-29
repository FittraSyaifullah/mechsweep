import { ME_CATEGORIES, type MeCategory, type MechDocument } from "@/types";

export interface CategorySlice {
  category: MeCategory;
  count: number;
  percentage: number;
  documents: MechDocument[];
}

export type CategorySortMode = "count-desc" | "count-asc" | "name-asc" | "name-desc";

export type FilterListSortMode = "count-desc" | "count-asc" | "name-asc" | "name-desc";

export interface LabeledCount {
  label: string;
  count: number;
}

/** Map analyzed category strings onto canonical ME domains. */
export function normalizeCategory(category?: string): MeCategory {
  if (!category?.trim()) return "Other";

  const trimmed = category.trim();
  const lower = trimmed.toLowerCase();

  const exact = ME_CATEGORIES.find((item) => item.toLowerCase() === lower);
  if (exact) return exact;

  if (lower.includes("thermo")) return "Thermodynamics";
  if (lower.includes("fluid")) return "Fluid Mechanics";
  if (lower.includes("solid") || lower.includes("mechanics")) return "Solid Mechanics";
  if (lower.includes("material")) return "Materials Science";
  if (lower.includes("manufactur") || lower.includes("machining")) return "Manufacturing";
  if (lower.includes("vibration") || lower.includes("dynamic")) return "Dynamics & Vibrations";
  if (lower.includes("heat")) return "Heat Transfer";
  if (lower.includes("machine design") || lower.includes("gear")) return "Machine Design";
  if (lower.includes("fea") || lower.includes("fem") || lower.includes("finite element")) {
    return "FEA / FEM";
  }
  if (lower.includes("control") || lower.includes("pid")) return "Control Systems";
  if (lower.includes("robot")) return "Robotics";
  if (lower.includes("hvac")) return "HVAC";

  return "Other";
}

export function buildCategoryBreakdown(documents: MechDocument[]): CategorySlice[] {
  const ready = documents.filter((doc) => doc.status === "ready");
  if (ready.length === 0) return [];

  const buckets = new Map<MeCategory, MechDocument[]>();
  for (const category of ME_CATEGORIES) {
    buckets.set(category, []);
  }

  for (const doc of ready) {
    const category = normalizeCategory(doc.category);
    buckets.get(category)!.push(doc);
  }

  const total = ready.length;

  return ME_CATEGORIES.map((category) => {
    const docs = buckets.get(category) ?? [];
    return {
      category,
      count: docs.length,
      percentage: (docs.length / total) * 100,
      documents: docs,
    };
  }).filter((slice) => slice.count > 0);
}

export function sortCategorySlices(
  slices: CategorySlice[],
  mode: CategorySortMode = "count-desc"
): CategorySlice[] {
  const copy = [...slices];
  switch (mode) {
    case "count-asc":
      return copy.sort(
        (a, b) => a.count - b.count || a.category.localeCompare(b.category)
      );
    case "name-asc":
      return copy.sort((a, b) => a.category.localeCompare(b.category));
    case "name-desc":
      return copy.sort((a, b) => b.category.localeCompare(a.category));
    default:
      return copy.sort(
        (a, b) => b.count - a.count || a.category.localeCompare(b.category)
      );
  }
}

export function sortLabeledCounts(
  items: LabeledCount[],
  mode: FilterListSortMode = "name-asc"
): LabeledCount[] {
  const copy = [...items];
  switch (mode) {
    case "count-desc":
      return copy.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
    case "count-asc":
      return copy.sort((a, b) => a.count - b.count || a.label.localeCompare(b.label));
    case "name-desc":
      return copy.sort((a, b) => b.label.localeCompare(a.label));
    default:
      return copy.sort((a, b) => a.label.localeCompare(b.label));
  }
}

/** Raw AI-assigned category labels (industries / subfields). */
export function buildIndustryOptions(documents: MechDocument[]): LabeledCount[] {
  const counts = new Map<string, number>();
  for (const doc of documents) {
    const label = doc.category?.trim();
    if (!label) continue;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return Array.from(counts.entries()).map(([label, count]) => ({ label, count }));
}

/** Canonical ME domains with document counts. */
export function buildDomainOptions(documents: MechDocument[]): LabeledCount[] {
  const counts = new Map<MeCategory, number>();
  for (const doc of documents) {
    const domain = normalizeCategory(doc.category);
    counts.set(domain, (counts.get(domain) ?? 0) + 1);
  }
  return ME_CATEGORIES.filter((domain) => counts.has(domain)).map((domain) => ({
    label: domain,
    count: counts.get(domain) ?? 0,
  }));
}

export function countAnalyzedDocuments(documents: MechDocument[]): number {
  return documents.filter((doc) => doc.status === "ready").length;
}
