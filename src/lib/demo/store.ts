import "server-only";

import { randomUUID } from "node:crypto";

import { getServerEnv } from "@/lib/env";

type DemoSubmission = {
  id: string;
  type: "lead" | "sourcing" | "booking";
  createdAt: string;
  payload: Record<string, unknown>;
};

const globalStore = globalThis as typeof globalThis & {
  dealerOsDemoSubmissions?: DemoSubmission[];
};

const submissions =
  globalStore.dealerOsDemoSubmissions ??
  (globalStore.dealerOsDemoSubmissions = []);

export function isDevelopmentDemoMode() {
  return (
    getServerEnv().DEALEROS_DEMO_MODE === "true" &&
    process.env.NODE_ENV !== "production"
  );
}

export function saveDemoSubmission(
  type: DemoSubmission["type"],
  payload: Record<string, unknown>,
) {
  if (!isDevelopmentDemoMode()) {
    throw new Error("Development demo persistence is disabled.");
  }

  if (
    type === "booking" &&
    submissions.some(
      (item) =>
        item.type === "booking" && item.payload.timeSlot === payload.timeSlot,
    )
  ) {
    return { ok: false as const, reason: "slot_taken" };
  }

  const submission: DemoSubmission = {
    id: randomUUID(),
    type,
    createdAt: new Date().toISOString(),
    payload,
  };
  submissions.push(submission);
  return { ok: true as const, submission };
}

export function getDemoSubmissions() {
  return [...submissions];
}
