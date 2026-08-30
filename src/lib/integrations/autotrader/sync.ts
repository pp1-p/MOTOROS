import "server-only";

import {
  autoTraderAdvertStatus,
  autoTraderExternalStockId,
  autoTraderProviderWarnings,
  autoTraderRegistration,
  autoTraderStockId,
  autoTraderUnpublishAllPayload,
  autoTraderVin,
  type AutoTraderVehiclePlan,
  type LocalAutoTraderVehicle,
  planAutoTraderVehicle,
} from "@/lib/integrations/autotrader/mapping";
import {
  AutoTraderApiError,
  type AutoTraderJsonObject,
  type AutoTraderStockClientContract,
  type AutoTraderStockItem,
} from "@/lib/integrations/autotrader/types";

export type AutoTraderSyncOutcome =
  | "created"
  | "updated"
  | "unchanged"
  | "skipped"
  | "failed";

export type AutoTraderSyncItemResult = {
  vehicleId: string;
  stockNumber: string;
  outcome: AutoTraderSyncOutcome;
  operation: string;
  externalStockId: string | null;
  message: string;
  warnings: string[];
};

export type AutoTraderSyncResult = {
  dryRun: boolean;
  total: number;
  created: number;
  updated: number;
  unchanged: number;
  skipped: number;
  failed: number;
  halted: boolean;
  haltReason: string | null;
  items: AutoTraderSyncItemResult[];
};

export type PersistedAutoTraderState = {
  vehicleId: string;
  externalStockId: string;
  publicationStatus:
    | "draft"
    | "pending"
    | "published"
    | "failed"
    | "removed";
  channelStatus:
    | "ready"
    | "published"
    | "paused"
    | "failed"
    | "removed"
    | "over_contracted";
  payloadHash: string | null;
  remoteLastUpdated: string | null;
  remoteVersionNumber: number | null;
  lastError: string | null;
  warnings: string[];
};

export interface AutoTraderSyncStore {
  listVehicles(input: {
    organisationId: string;
    vehicleId?: string;
  }): Promise<LocalAutoTraderVehicle[]>;
  beginRecord(input: {
    organisationId: string;
    vehicleId: string;
    operation: string;
    payloadHash: string | null;
    intent: string;
  }): Promise<string>;
  completeRecord(input: {
    recordId: string;
    status: "succeeded" | "failed" | "skipped";
    externalId: string | null;
    outcome: AutoTraderSyncOutcome;
    errorCode?: string | null;
    errorMessage?: string | null;
    warnings?: string[];
  }): Promise<void>;
  persistVehicleState(input: PersistedAutoTraderState): Promise<void>;
  markVehicleFailure(input: {
    vehicleId: string;
    errorCode: string;
    errorMessage: string;
  }): Promise<void>;
}

function asRecord(value: unknown): AutoTraderJsonObject | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as AutoTraderJsonObject)
    : null;
}

function equal(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

/**
 * Returns a JSON merge payload containing only values whose desired state is
 * different. Arrays are intentionally replaced as a unit because Auto Trader
 * requires complete image and feature arrays on every list change.
 */
export function diffAutoTraderPayload(
  desired: AutoTraderJsonObject,
  current: AutoTraderJsonObject,
): AutoTraderJsonObject {
  const diff: AutoTraderJsonObject = {};
  for (const [key, desiredValue] of Object.entries(desired)) {
    const currentValue = current[key];
    if (Array.isArray(desiredValue)) {
      const projected = Array.isArray(currentValue)
        ? currentValue.map((item, index) => {
            const desiredItem = desiredValue[index];
            if (
              desiredItem &&
              typeof desiredItem === "object" &&
              !Array.isArray(desiredItem) &&
              item &&
              typeof item === "object" &&
              !Array.isArray(item)
            ) {
              return projectToDesiredShape(
                item as AutoTraderJsonObject,
                desiredItem as AutoTraderJsonObject,
              );
            }
            return item;
          })
        : currentValue;
      if (!equal(projected, desiredValue)) diff[key] = desiredValue;
      continue;
    }

    if (
      desiredValue &&
      typeof desiredValue === "object" &&
      currentValue &&
      typeof currentValue === "object" &&
      !Array.isArray(currentValue)
    ) {
      const child = diffAutoTraderPayload(
        desiredValue as AutoTraderJsonObject,
        currentValue as AutoTraderJsonObject,
      );
      if (Object.keys(child).length > 0) diff[key] = child;
      continue;
    }

    if (!equal(desiredValue, currentValue)) diff[key] = desiredValue;
  }
  return diff;
}

function projectToDesiredShape(
  current: AutoTraderJsonObject,
  desired: AutoTraderJsonObject,
): AutoTraderJsonObject {
  return Object.fromEntries(
    Object.entries(desired).map(([key, desiredValue]) => {
      const currentValue = current[key];
      if (
        desiredValue &&
        typeof desiredValue === "object" &&
        !Array.isArray(desiredValue) &&
        currentValue &&
        typeof currentValue === "object" &&
        !Array.isArray(currentValue)
      ) {
        return [
          key,
          projectToDesiredShape(
            currentValue as AutoTraderJsonObject,
            desiredValue as AutoTraderJsonObject,
          ),
        ];
      }
      return [key, currentValue];
    }),
  );
}

function mergeAutoTraderState(
  current: AutoTraderStockItem,
  patch: AutoTraderJsonObject,
): AutoTraderStockItem {
  const output: AutoTraderJsonObject = { ...current };
  for (const [key, value] of Object.entries(patch)) {
    const existing = output[key];
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      existing &&
      typeof existing === "object" &&
      !Array.isArray(existing)
    ) {
      output[key] = mergeAutoTraderState(
        existing as AutoTraderStockItem,
        value as AutoTraderJsonObject,
      );
    } else {
      output[key] = value;
    }
  }
  return output as AutoTraderStockItem;
}

function findRemoteStock(
  plan: AutoTraderVehiclePlan,
  remoteStock: AutoTraderStockItem[],
) {
  const knownIds = [
    plan.vehicle.autotraderStockId,
    plan.vehicle.channel?.externalStockId,
  ].filter((value): value is string => Boolean(value));
  for (const knownId of knownIds) {
    const match = remoteStock.find((item) => autoTraderStockId(item) === knownId);
    if (match) return match;
  }

  const externalMatch = remoteStock.find(
    (item) => autoTraderExternalStockId(item) === plan.vehicle.id,
  );
  if (externalMatch) return externalMatch;

  const registration = plan.vehicle.registration
    ?.replace(/\s+/g, "")
    .toUpperCase();
  if (registration) {
    const registrationMatches = remoteStock.filter(
      (item) => autoTraderRegistration(item) === registration,
    );
    if (registrationMatches.length === 1) return registrationMatches[0]!;
  }

  const vin = plan.vehicle.vin?.toUpperCase();
  if (vin) {
    const vinMatches = remoteStock.filter((item) => autoTraderVin(item) === vin);
    if (vinMatches.length === 1) return vinMatches[0]!;
  }
  return null;
}

function remoteMetadata(item: AutoTraderStockItem) {
  const metadata = asRecord(item.metadata);
  return {
    lastUpdated:
      typeof metadata?.lastUpdated === "string" ? metadata.lastUpdated : null,
    versionNumber:
      typeof metadata?.versionNumber === "number"
        ? metadata.versionNumber
        : null,
  };
}

function publicationState(input: {
  plan: AutoTraderVehiclePlan;
  remote: AutoTraderStockItem;
  failed?: boolean;
}) {
  if (input.failed) {
    return {
      publicationStatus: "failed" as const,
      channelStatus: "failed" as const,
    };
  }
  if (input.plan.intent === "withdraw" || input.plan.intent === "sold") {
    return {
      publicationStatus: "removed" as const,
      channelStatus: "removed" as const,
    };
  }
  if (input.plan.intent === "pause") {
    return {
      publicationStatus: "draft" as const,
      channelStatus: "paused" as const,
    };
  }

  const status = autoTraderAdvertStatus(input.remote);
  if (status === "PUBLISHED") {
    return {
      publicationStatus: "published" as const,
      channelStatus: "published" as const,
    };
  }
  if (status === "CAPPED") {
    return {
      publicationStatus: "failed" as const,
      channelStatus: "over_contracted" as const,
    };
  }
  if (status === "REJECTED") {
    return {
      publicationStatus: "failed" as const,
      channelStatus: "failed" as const,
    };
  }
  return {
    publicationStatus: "draft" as const,
    channelStatus: "ready" as const,
  };
}

function safeErrorMessage(error: unknown) {
  if (error instanceof AutoTraderApiError) {
    return [error.message, error.providerMessage]
      .filter(Boolean)
      .join(" ")
      .slice(0, 500);
  }
  return error instanceof Error
    ? error.message.slice(0, 500)
    : "The stock sync failed unexpectedly.";
}

function shouldHalt(error: unknown) {
  return (
    error instanceof AutoTraderApiError &&
    [
      "authentication_failed",
      "permission_missing",
      "rate_limited",
      "service_unavailable",
    ].includes(error.code)
  );
}

function emptyResult(dryRun: boolean): AutoTraderSyncResult {
  return {
    dryRun,
    total: 0,
    created: 0,
    updated: 0,
    unchanged: 0,
    skipped: 0,
    failed: 0,
    halted: false,
    haltReason: null,
    items: [],
  };
}

function addResult(
  result: AutoTraderSyncResult,
  item: AutoTraderSyncItemResult,
) {
  result.items.push(item);
  result[item.outcome] += 1;
}

async function persistState(input: {
  store: AutoTraderSyncStore;
  plan: AutoTraderVehiclePlan;
  remote: AutoTraderStockItem;
  stockId: string;
  warnings: string[];
  lastError?: string | null;
}) {
  const state = publicationState({
    plan: input.plan,
    remote: input.remote,
    failed: Boolean(input.lastError),
  });
  const metadata = remoteMetadata(input.remote);
  await input.store.persistVehicleState({
    vehicleId: input.plan.vehicle.id,
    externalStockId: input.stockId,
    publicationStatus: state.publicationStatus,
    channelStatus: state.channelStatus,
    payloadHash: input.plan.payloadHash,
    remoteLastUpdated: metadata.lastUpdated,
    remoteVersionNumber: metadata.versionNumber,
    lastError: input.lastError ?? null,
    warnings: input.warnings,
  });
}

async function updateRemote(input: {
  client: AutoTraderStockClientContract;
  plan: AutoTraderVehiclePlan;
  remote: AutoTraderStockItem;
  dryRun: boolean;
}) {
  const stockId = autoTraderStockId(input.remote);
  if (!stockId) {
    throw new Error("The matched Auto Trader stock record has no stockId.");
  }
  let remote = input.remote;
  let changed = false;

  if (input.plan.intent === "sold" || input.plan.intent === "withdraw") {
    const unpublish = autoTraderUnpublishAllPayload();
    const unpublishDiff = diffAutoTraderPayload(unpublish, remote);
    if (Object.keys(unpublishDiff).length > 0) {
      changed = true;
      if (!input.dryRun) {
        const response = await input.client.updateStock(stockId, unpublishDiff);
        remote = mergeAutoTraderState(remote, unpublishDiff);
        remote = mergeAutoTraderState(remote, response.data);
      } else {
        remote = mergeAutoTraderState(remote, unpublishDiff);
      }
    }
  }

  const desired = input.plan.payload ?? {};
  const diff = diffAutoTraderPayload(desired, remote);
  if (Object.keys(diff).length > 0) {
    changed = true;
    if (!input.dryRun) {
      const response = await input.client.updateStock(stockId, diff);
      remote = mergeAutoTraderState(remote, diff);
      remote = mergeAutoTraderState(remote, response.data);
    } else {
      remote = mergeAutoTraderState(remote, diff);
    }
  }

  return { stockId, remote, changed };
}

export async function syncAutoTraderStock(input: {
  organisationId: string;
  vehicleId?: string;
  dryRun?: boolean;
  client: AutoTraderStockClientContract;
  store: AutoTraderSyncStore;
}) {
  const dryRun = Boolean(input.dryRun);
  const result = emptyResult(dryRun);
  const vehicles = await input.store.listVehicles({
    organisationId: input.organisationId,
    vehicleId: input.vehicleId,
  });
  result.total = vehicles.length;

  let remoteStock: AutoTraderStockItem[];
  try {
    remoteStock = await input.client.listAllStock(20);
  } catch (error) {
    result.halted = true;
    result.haltReason = safeErrorMessage(error);
    for (const vehicle of vehicles) {
      addResult(result, {
        vehicleId: vehicle.id,
        stockNumber: vehicle.stockNumber,
        outcome: "failed",
        operation: "baseline",
        externalStockId: vehicle.autotraderStockId,
        message: result.haltReason,
        warnings: [],
      });
    }
    return result;
  }

  for (let index = 0; index < vehicles.length; index += 1) {
    const vehicle = vehicles[index]!;
    if (result.halted) {
      addResult(result, {
        vehicleId: vehicle.id,
        stockNumber: vehicle.stockNumber,
        outcome: "skipped",
        operation: "halted",
        externalStockId: vehicle.autotraderStockId,
        message: "Skipped because the advertiser sync was halted after a provider error.",
        warnings: [],
      });
      continue;
    }

    let plan: AutoTraderVehiclePlan;
    try {
      plan = planAutoTraderVehicle(vehicle);
    } catch (error) {
      addResult(result, {
        vehicleId: vehicle.id,
        stockNumber: vehicle.stockNumber,
        outcome: "skipped",
        operation: "validation",
        externalStockId: vehicle.autotraderStockId,
        message:
          error instanceof Error
            ? `Local stock validation failed: ${error.message}`
            : "Local stock validation failed.",
        warnings: [],
      });
      continue;
    }

    const matchedRemote = findRemoteStock(plan, remoteStock);
    const matchedStockId = autoTraderStockId(matchedRemote);
    if (plan.intent === "skip") {
      if (!dryRun) {
        const recordId = await input.store.beginRecord({
          organisationId: input.organisationId,
          vehicleId: vehicle.id,
          operation: "skip",
          payloadHash: null,
          intent: "skip",
        });
        await input.store.completeRecord({
          recordId,
          status: "skipped",
          externalId: matchedStockId,
          outcome: "skipped",
          errorMessage: plan.skipReason,
          warnings: plan.warnings,
        });
      }
      addResult(result, {
        vehicleId: vehicle.id,
        stockNumber: vehicle.stockNumber,
        outcome: "skipped",
        operation: "skip",
        externalStockId: matchedStockId,
        message: plan.skipReason ?? "Vehicle is not eligible for sync.",
        warnings: plan.warnings,
      });
      continue;
    }

    if (
      !matchedRemote &&
      ["pause", "sold", "withdraw"].includes(plan.intent)
    ) {
      addResult(result, {
        vehicleId: vehicle.id,
        stockNumber: vehicle.stockNumber,
        outcome: "skipped",
        operation: plan.intent,
        externalStockId: null,
        message: `No Auto Trader stock record exists to ${plan.intent}.`,
        warnings: plan.warnings,
      });
      continue;
    }

    const operation = matchedRemote ? plan.intent : "create";
    const recordId = dryRun
      ? null
      : await input.store.beginRecord({
          organisationId: input.organisationId,
          vehicleId: vehicle.id,
          operation,
          payloadHash: plan.payloadHash,
          intent: plan.intent,
        });

    try {
      let outcome: AutoTraderSyncOutcome;
      let stockId: string;
      let remote: AutoTraderStockItem;

      if (matchedRemote) {
        const update = await updateRemote({
          client: input.client,
          plan,
          remote: matchedRemote,
          dryRun,
        });
        stockId = update.stockId;
        remote = update.remote;
        outcome = update.changed ? "updated" : "unchanged";
      } else if (dryRun) {
        stockId = "dry-run";
        remote = (plan.payload ?? {}) as AutoTraderStockItem;
        outcome = "created";
      } else {
        try {
          const created = await input.client.createStock(plan.payload ?? {});
          stockId = autoTraderStockId(created.data) ?? "";
          if (!stockId) {
            throw new Error(
              "Auto Trader created stock but did not return metadata.stockId.",
            );
          }
          remote = created.data;
          outcome = "created";
          remoteStock.push(remote);
        } catch (error) {
          if (
            !(error instanceof AutoTraderApiError) ||
            error.code !== "duplicate_stock" ||
            !error.existingStockId
          ) {
            throw error;
          }
          const existing = await input.client.getStockById(error.existingStockId);
          if (!existing) {
            throw new Error(
              "Auto Trader reported duplicate stock but the existing record could not be read.",
            );
          }
          const update = await updateRemote({
            client: input.client,
            plan,
            remote: existing,
            dryRun: false,
          });
          stockId = update.stockId;
          remote = update.remote;
          outcome = update.changed ? "updated" : "unchanged";
          remoteStock.push(remote);
        }
      }

      const providerWarnings = autoTraderProviderWarnings(remote);
      const warnings = [...plan.warnings, ...providerWarnings];
      if (!dryRun) {
        await persistState({
          store: input.store,
          plan,
          remote,
          stockId,
          warnings,
        });
        await input.store.completeRecord({
          recordId: recordId!,
          status: "succeeded",
          externalId: stockId,
          outcome,
          warnings,
        });
      }
      addResult(result, {
        vehicleId: vehicle.id,
        stockNumber: vehicle.stockNumber,
        outcome,
        operation,
        externalStockId: dryRun ? matchedStockId : stockId,
        message:
          dryRun && outcome === "created"
            ? "Would create unpublished or explicitly requested stock in the Auto Trader sandbox."
            : dryRun && outcome === "updated"
              ? "Would update the matching Auto Trader sandbox stock record."
              : outcome === "created"
                ? "Auto Trader sandbox stock was created."
                : outcome === "updated"
                  ? "Auto Trader sandbox stock was updated."
                  : "Auto Trader sandbox stock already matches MOTOR.OS.",
        warnings,
      });
    } catch (error) {
      const message = safeErrorMessage(error);
      if (!dryRun && recordId) {
        const errorCode =
          error instanceof AutoTraderApiError ? error.code : "sync_failed";
        await input.store.completeRecord({
          recordId,
          status: "failed",
          externalId: matchedStockId,
          outcome: "failed",
          errorCode,
          errorMessage: message,
          warnings: plan.warnings,
        });
        await input.store.markVehicleFailure({
          vehicleId: vehicle.id,
          errorCode,
          errorMessage: message,
        });
      }
      addResult(result, {
        vehicleId: vehicle.id,
        stockNumber: vehicle.stockNumber,
        outcome: "failed",
        operation,
        externalStockId: matchedStockId,
        message,
        warnings: plan.warnings,
      });
      if (shouldHalt(error)) {
        result.halted = true;
        result.haltReason = message;
      }
    }
  }

  return result;
}
