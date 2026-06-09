import { ME_CATEGORIES, type MeCategory, type MechDocument } from "@/types";

export interface CategorySlice {
  category: MeCategory;
  count: number;
  percentage: number;
  documents: MechDocument[];
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
  })
    .filter((slice) => slice.count > 0)
    .sort((a, b) => b.count - a.count);
}

export function countAnalyzedDocuments(documents: MechDocument[]): number {
  return documents.filter((doc) => doc.status === "ready").length;
}
