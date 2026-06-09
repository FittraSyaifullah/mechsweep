import { describe, expect, it } from "vitest";
import { formatUserError, relevancePercent } from "@/lib/user-messages";

describe("user-messages", () => {
  it("formats timeout errors as retryable", () => {
    const err = formatUserError("Exa search timed out after 9s");
    expect(err.title).toBe("Search timed out");
    expect(err.retryable).toBe(true);
  });

  it("formats relevance scores as percentages", () => {
    expect(relevancePercent(0.876)).toBe("88%");
  });
});
