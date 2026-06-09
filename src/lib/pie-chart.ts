import type { MeCategory } from "@/types";

export const CATEGORY_COLORS: Record<MeCategory, string> = {
  Thermodynamics: "#dc2626",
  "Fluid Mechanics": "#2563eb",
  "Solid Mechanics": "#7c3aed",
  "Materials Science": "#0891b2",
  Manufacturing: "#ca8a04",
  "Dynamics & Vibrations": "#db2777",
  "Heat Transfer": "#ea580c",
  "Machine Design": "#059669",
  "FEA / FEM": "#4f46e5",
  "Control Systems": "#0d9488",
  Robotics: "#9333ea",
  HVAC: "#0284c7",
  Other: "#64748b",
};

export function polarToCartesian(
  centerX: number,
  centerY: number,
  radius: number,
  angleDegrees: number
): { x: number; y: number } {
  const radians = ((angleDegrees - 90) * Math.PI) / 180;
  return {
    x: centerX + radius * Math.cos(radians),
    y: centerY + radius * Math.sin(radians),
  };
}

export function describePieSlice(
  centerX: number,
  centerY: number,
  radius: number,
  startAngle: number,
  endAngle: number
): string {
  if (endAngle - startAngle >= 359.999) {
    return [
      `M ${centerX - radius} ${centerY}`,
      `A ${radius} ${radius} 0 1 1 ${centerX + radius} ${centerY}`,
      `A ${radius} ${radius} 0 1 1 ${centerX - radius} ${centerY}`,
      "Z",
    ].join(" ");
  }

  const start = polarToCartesian(centerX, centerY, radius, endAngle);
  const end = polarToCartesian(centerX, centerY, radius, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;

  return [
    `M ${centerX} ${centerY}`,
    `L ${start.x} ${start.y}`,
    `A ${radius} ${radius} 0 ${largeArc} 0 ${end.x} ${end.y}`,
    "Z",
  ].join(" ");
}

export function buildPieAngles(
  slices: Array<{ count: number }>
): Array<{ startAngle: number; endAngle: number }> {
  const total = slices.reduce((sum, slice) => sum + slice.count, 0);
  if (total === 0) return [];

  let cursor = 0;
  return slices.map((slice) => {
    const sweep = (slice.count / total) * 360;
    const startAngle = cursor;
    const endAngle = cursor + sweep;
    cursor = endAngle;
    return { startAngle, endAngle };
  });
}
