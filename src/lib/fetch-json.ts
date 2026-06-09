/** Thrown when an API response is not valid JSON or the request failed. */
export class ApiResponseError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "ApiResponseError";
  }
}

export async function fetchJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<{ response: Response; data: T }> {
  const response = await fetch(input, init);
  const raw = await response.text();

  if (!raw.trim()) {
    if (!response.ok) {
      throw new ApiResponseError(`Request failed (${response.status})`, response.status);
    }
    return { response, data: {} as T };
  }

  try {
    return { response, data: JSON.parse(raw) as T };
  } catch {
    const preview = raw.replace(/\s+/g, " ").trim().slice(0, 160);
    throw new ApiResponseError(
      response.ok
        ? `Server returned invalid JSON: ${preview}`
        : `Request failed (${response.status}): ${preview}`,
      response.status
    );
  }
}
