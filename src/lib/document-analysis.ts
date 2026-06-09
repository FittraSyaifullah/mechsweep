import { ME_CATEGORIES, type AnalyzeResult, type MeCategory } from "@/types";

const CATEGORY_KEYWORDS: Record<MeCategory, string[]> = {
  Thermodynamics: ["thermodynamic", "entropy", "enthalpy", "heat engine"],
  "Fluid Mechanics": ["fluid", "flow", "navier", "reynolds", "turbulence"],
  "Solid Mechanics": ["stress", "strain", "deformation", "elastic"],
  "Materials Science": ["material", "alloy", "composite", "microstructure"],
  Manufacturing: ["manufacturing", "machining", "cnc", "welding"],
  "Dynamics & Vibrations": ["vibration", "dynamic", "modal", "frequency"],
  "Heat Transfer": ["heat transfer", "conduction", "convection", "radiation"],
  "Machine Design": ["machine design", "gear", "bearing", "shaft"],
  "FEA / FEM": ["fea", "fem", "finite element", "mesh"],
  "Control Systems": ["control", "pid", "feedback", "actuator"],
  Robotics: ["robot", "kinematics", "manipulator", "end effector"],
  HVAC: ["hvac", "ventilation", "air conditioning", "refrigeration"],
  Other: [],
};

export function inferCategoryFromText(text: string): MeCategory {
  const lower = text.toLowerCase();
  for (const category of ME_CATEGORIES) {
    if (category === "Other") continue;
    if (CATEGORY_KEYWORDS[category].some((keyword) => lower.includes(keyword))) {
      return category;
    }
  }
  return "Other";
}

export function buildLocalAnalyzeResult(
  title: string,
  type: string,
  content: string,
  categoryHint?: string
): AnalyzeResult {
  const normalized = content.trim().replace(/\s+/g, " ");
  const firstSentence = normalized.match(/^[^.!?]+[.!?]?/)?.[0]?.trim() ?? "";
  const summary =
    firstSentence.length >= 20
      ? firstSentence.slice(0, 240)
      : normalized.slice(0, 240) || `${title} (${type.toUpperCase()})`;

  const hinted =
    categoryHint && ME_CATEGORIES.includes(categoryHint as MeCategory)
      ? (categoryHint as MeCategory)
      : undefined;

  const tags = Array.from(
    new Set(
      [type, ...title.split(/\W+/).filter((word) => word.length > 3).slice(0, 4)].map((tag) =>
        tag.toLowerCase()
      )
    )
  ).slice(0, 6);

  return {
    summary,
    tags,
    category: hinted ?? inferCategoryFromText(`${title} ${normalized}`),
    keyTopics: Array.from(
      new Set([title.split(/\W+/)[0], type].filter((topic) => topic && topic.length > 2))
    ).slice(0, 4),
  };
}

export function hasAnalyzePayload(title: string, content: string): boolean {
  return Boolean(title.trim()) && Boolean(content.trim());
}
