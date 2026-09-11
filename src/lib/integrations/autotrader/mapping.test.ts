import { describe, expect, it } from "vitest";

import {
  autoTraderSoldPayload,
  autoTraderUnpublishAllPayload,
  autoTraderWithdrawPayload,
  hashAutoTraderPayload,
  planAutoTraderVehicle,
} from "./mapping";
import { validAutoTraderVehicle } from "@/test/autotrader-fixtures";

describe("Auto Trader stock mapping", () => {
  it("maps the MOTOR.OS car model to documented stock fields", () => {
    const plan = planAutoTraderVehicle(validAutoTraderVehicle());

    expect(plan.intent).toBe("upsert");
    expect(plan.payload).toMatchObject({
      vehicle: {
        registration: "AB12CDE",
        make: "Volkswagen",
        model: "Golf",
        vehicleType: "Car",
        derivativeId: "test-derivative-placeholder",
        odometerReadingMiles: 20_000,
        owners: 2,
      },
      adverts: {
        forecourtPrice: { amountGBP: 15_995 },
        reservationStatus: null,
        retailAdverts: {
          suppliedPrice: { amountGBP: 15_995 },
          autotraderAdvert: { status: "NOT_PUBLISHED" },
        },
      },
      metadata: {
        externalStockId: "11111111-1111-4111-8111-111111111111",
        externalStockReference: "STOCK-001",
        lifecycleState: "FORECOURT",
      },
      features: [
        { name: "Air conditioning", type: "Standard" },
        { name: "Bluetooth", type: "Standard" },
        { name: "Winter pack", type: "Optional" },
      ],
      media: { video: { href: "https://www.youtube.com/watch?v=placeholder" } },
    });
    expect(plan.payload).not.toHaveProperty("media.images");
  });

  it("converts local previous-owner count to Auto Trader total owners", () => {
    const noPreviousOwners = planAutoTraderVehicle(
      validAutoTraderVehicle({ previousOwners: 0 }),
    );
    const twoPreviousOwners = planAutoTraderVehicle(
      validAutoTraderVehicle({ previousOwners: 2 }),
    );
    const unknownOwners = planAutoTraderVehicle(
      validAutoTraderVehicle({ previousOwners: null }),
    );

    expect(noPreviousOwners.payload).toHaveProperty("vehicle.owners", 1);
    expect(twoPreviousOwners.payload).toHaveProperty("vehicle.owners", 3);
    expect(unknownOwners.payload).not.toHaveProperty("vehicle.owners");
  });

  it("publishes only when the channel explicitly requests published", () => {
    const plan = planAutoTraderVehicle(
      validAutoTraderVehicle({
        channel: {
          status: "published",
          externalStockId: null,
          externalDerivativeId: "test-derivative-placeholder",
          metadata: {},
        },
      }),
    );

    expect(plan.payload).toHaveProperty(
      "adverts.retailAdverts.autotraderAdvert.status",
      "PUBLISHED",
    );
  });

  it("uses null to clear application-owned advert, reference and video fields", () => {
    const plan = planAutoTraderVehicle(
      validAutoTraderVehicle({
        stockNumber: "x".repeat(26),
        attentionGrabber: null,
        description: null,
        videoUrl: null,
      }),
    );

    expect(plan.payload).toMatchObject({
      metadata: { externalStockReference: null },
      adverts: {
        retailAdverts: { attentionGrabber: null, description: null },
      },
      media: { video: { href: null } },
    });
  });

  it.each([
    [{ retailPrice: 74 }, "at least £75"],
    [{ attentionGrabber: "x".repeat(31) }, "30 characters"],
    [{ description: "x".repeat(4_001) }, "4,000 characters"],
    [{ advertisedCondition: "new" as const }, "New unregistered stock"],
    [{ vin: "INVALIDVIN" }, "17-character VIN"],
  ])("skips invalid stock without throwing", (changes, reason) => {
    const plan = planAutoTraderVehicle(validAutoTraderVehicle(changes));
    expect(plan.intent).toBe("skip");
    expect(plan.skipReason).toContain(reason);
  });

  it("maps pause, sold and removed stock to the documented transitions", () => {
    const paused = planAutoTraderVehicle(
      validAutoTraderVehicle({
        channel: {
          status: "paused",
          externalStockId: "stock-1",
          externalDerivativeId: null,
          metadata: {},
        },
      }),
    );
    const sold = planAutoTraderVehicle(
      validAutoTraderVehicle({
        status: "sold",
        soldAt: "2026-08-28",
        actualSalePrice: 15_000,
      }),
    );
    const removed = planAutoTraderVehicle(
      validAutoTraderVehicle({ status: "returned" }),
    );

    expect(paused.payload).toEqual({
      adverts: { retailAdverts: { autotraderAdvert: { status: "NOT_PUBLISHED" } } },
    });
    expect(sold.payload).toEqual(autoTraderSoldPayload(sold.vehicle));
    expect(sold.payload).toMatchObject({ metadata: { lifecycleState: "SOLD" } });
    expect(removed.payload).toEqual(autoTraderWithdrawPayload());
    expect(removed.payload).toEqual({ metadata: { lifecycleState: "WASTEBIN" } });
    expect(autoTraderUnpublishAllPayload()).toHaveProperty(
      "adverts.retailAdverts.profileAdvert.status",
      "NOT_PUBLISHED",
    );
  });

  it("produces a stable payload hash independent of object key order", () => {
    expect(hashAutoTraderPayload({ a: 1, b: { c: 2 } })).toBe(
      hashAutoTraderPayload({ b: { c: 2 }, a: 1 }),
    );
  });
});
