"use client";

import { toast } from "sonner";

// A thin wrapper over Sonner so every part of the app fires toasts with the
// same durations, tone and copy conventions. Prefer these helpers over
// importing sonner directly — it keeps the app's toast language consistent.

export const notify = {
  success(message: string, description?: string) {
    toast.success(message, {
      description,
      duration: 2400,
    });
  },
  error(message: string, description?: string) {
    toast.error(message, {
      description,
      duration: 6000,
    });
  },
  info(message: string, description?: string) {
    toast(message, {
      description,
      duration: 3500,
    });
  },
  // Fires an error toast when the response was not ok. Returns whether the
  // response was ok so callers can early-return on failure without a
  // second conditional.
  async fromResponse(
    response: Response,
    successMessage: string,
  ): Promise<boolean> {
    if (response.ok) {
      notify.success(successMessage);
      return true;
    }
    const result = (await response
      .json()
      .catch(() => null)) as { message?: string } | null;
    notify.error(result?.message ?? "Something went wrong. Please try again.");
    return false;
  },
};
