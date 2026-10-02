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
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new FormSubmissionError(
      "The connection was lost or timed out. Your entries remain on screen. If you are unsure whether your request arrived, contact the dealership before submitting again.",
    );
  }

  const body = await readResponse(response);
  if (!response.ok) {
    throw new FormSubmissionError(
      getResponseMessage(body) ??
        "We could not submit this form. Nothing has been lost—please try again.",
    );
  }

  if (!body || typeof body !== "object") {
    throw new FormSubmissionError("The server did not confirm your request. Your entries remain on screen. Check with the dealership before submitting again.");
  }
  return body as T;
}

export async function postFormData<T>(url: string, payload: FormData): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { method: "POST", body: payload, signal: AbortSignal.timeout(20_000) });
  } catch {
    throw new FormSubmissionError(
      "The connection was lost or timed out. Your entries remain on screen. Your booking may already be in the diary; contact the dealership before submitting again.",
    );
  }

  const body = await readResponse(response);
  if (!response.ok) {
    throw new FormSubmissionError(
      getResponseMessage(body) ??
        "We could not submit this booking. Nothing has been lost—please try again.",
    );
  }

  if (!body || typeof body !== "object") {
    throw new FormSubmissionError("The server did not confirm your request. Your entries remain on screen. Check with the dealership before submitting again.");
  }
  return body as T;
}

