"use client";

interface HighlightTextProps {
  text: string;
  query: string;
  className?: string;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default function HighlightText({ text, query, className }: HighlightTextProps) {
  const q = query.trim();
  if (!q) return <span className={className}>{text}</span>;

  const parts = text.split(new RegExp(`(${escapeRegExp(q)})`, "gi"));
  return (
    <span className={className}>
      {parts.map((part, index) =>
        part.toLowerCase() === q.toLowerCase() ? (
          <mark key={`${part}-${index}`} className="rounded bg-amber-200 px-0.5 text-inherit">
            {part}
          </mark>
        ) : (
          <span key={`${part}-${index}`}>{part}</span>
        )
      )}
    </span>
  );
}
