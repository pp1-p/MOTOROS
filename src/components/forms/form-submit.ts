export class FormSubmissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FormSubmissionError";
  }
}

async function readResponse(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return null;
  return response.json().catch(() => null) as Promise<unknown>;
}

function getResponseMessage(body: unknown) {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  return typeof record.message === "string"
    ? record.message
    : typeof record.error === "string"
      ? record.error
      : null;
}

export async function postJson<T>(url: string, payload: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new FormSubmissionError(
      "We could not reach the dealership system. Please check your connection and try again.",
    );
  }

  const body = await readResponse(response);
  if (!response.ok) {
    throw new FormSubmissionError(
      getResponseMessage(body) ??
        "We could not submit this form. Nothing has been lost—please try again.",
    );
  }

  return body as T;
}

export async function postFormData<T>(url: string, payload: FormData): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { method: "POST", body: payload });
  } catch {
    throw new FormSubmissionError(
      "We could not reach the dealership system. Please check your connection and try again.",
    );
  }

  const body = await readResponse(response);
  if (!response.ok) {
    throw new FormSubmissionError(
      getResponseMessage(body) ??
        "We could not submit this booking. Nothing has been lost—please try again.",
    );
  }

  return body as T;
}

