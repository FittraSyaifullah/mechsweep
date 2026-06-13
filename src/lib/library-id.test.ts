import { beforeEach, describe, expect, it, vi } from "vitest";
import { getLibraryId, isValidLibraryId, setLibraryId } from "@/lib/library-id";

describe("library-id", () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal("window", {});
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
    });
    vi.stubGlobal("crypto", {
      randomUUID: () => "11111111-1111-4111-8111-111111111111",
    });
  });

  it("creates and persists a library id", () => {
    expect(getLibraryId()).toBe("11111111-1111-4111-8111-111111111111");
    expect(getLibraryId()).toBe("11111111-1111-4111-8111-111111111111");
  });

  it("validates sync codes", () => {
    expect(isValidLibraryId("11111111-1111-4111-8111-111111111111")).toBe(true);
    expect(isValidLibraryId("not-a-uuid")).toBe(false);
  });

  it("links an existing sync code", () => {
    expect(
      setLibraryId("22222222-2222-4222-8222-222222222222")
    ).toBe(true);
    expect(getLibraryId()).toBe("22222222-2222-4222-8222-222222222222");
  });
});
