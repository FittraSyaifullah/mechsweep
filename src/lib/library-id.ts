const LIBRARY_ID_KEY = "mechsweep-library-id";
const LIBRARY_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidLibraryId(value: string): boolean {
  return LIBRARY_ID_PATTERN.test(value.trim());
}

export function getLibraryId(): string {
  if (typeof window === "undefined") return "";

  const existing = localStorage.getItem(LIBRARY_ID_KEY)?.trim();
  if (existing && isValidLibraryId(existing)) return existing;

  const id = crypto.randomUUID();
  localStorage.setItem(LIBRARY_ID_KEY, id);
  return id;
}

export function setLibraryId(id: string): boolean {
  const normalized = id.trim();
  if (!isValidLibraryId(normalized)) return false;
  localStorage.setItem(LIBRARY_ID_KEY, normalized);
  return true;
}

export function clearLibraryId(): void {
  localStorage.removeItem(LIBRARY_ID_KEY);
}
