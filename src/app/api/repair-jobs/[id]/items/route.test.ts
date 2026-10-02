import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ staff: vi.fn(), client: vi.fn() }));
vi.mock("@/lib/auth/permissions", async (original) => ({
  ...(await original<typeof import("@/lib/auth/permissions")>()),
  getStaffContext: mocks.staff,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabaseClient: mocks.client,
}));
vi.mock("@/lib/env", () => ({
  getServerEnv: () => ({ NEXT_PUBLIC_APP_URL: "http://localhost:3000" }),
}));
import { POST, PATCH, DELETE } from "./route";

const jobId = "00000000-0000-4000-8000-000000000111";
const itemId = "00000000-0000-4000-8000-000000000222";
const organisationId = "00000000-0000-4000-8000-000000000001";
const otherOrganisation = "00000000-0000-4000-8000-000000000002";
const timestamp = "2026-10-02T17:00:00+00:00";
const fields = {
  itemType: "labour",
  description: "Diagnostic inspection",
  quantity: 1.5,
  unitPrice: 78,
  vatRate: 20,
  status: "planned",
  changeReason: "Initial estimate",
};
type Row = Record<string, unknown>;
type Result = {
  data: Row | null;
  error: { code?: string; message: string } | null;
};
let jobs: Row[];
let items: Row[];
let audits: Row[];
let failingTable: string | null;
let auditThrows: boolean;
let queries: {
  table: string;
  operation: string;
  filters: [string, unknown][];
  values?: Row;
}[];

function builder(table: string, operation: string, values?: Row) {
  const trace = {
    table,
    operation,
    values,
    filters: [] as [string, unknown][],
  };
  queries.push(trace);
  function run(): Result {
    if (table === "audit_logs" && auditThrows)
      throw new Error("private database detail");
    if (failingTable === table)
      return { data: null, error: { message: "private database detail" } };
    if (table === "audit_logs") {
      audits.push(values ?? {});
      return { data: null, error: null };
    }
    const rows = table === "repair_jobs" ? jobs : items;
    if (operation === "insert") {
      if (items.some((row) => row.id === values?.id))
        return { data: null, error: { code: "23505", message: "duplicate" } };
      const row = {
        ...values,
        deleted_at: null,
        supplier: values?.supplier ?? null,
        part_number: values?.part_number ?? null,
        updated_at: timestamp,
        line_total: 117,
      };
      items.push(row);
      return { data: row, error: null };
    }
    const row = rows.find((candidate) =>
      trace.filters.every(([field, value]) => candidate[field] === value),
    );
    if (row && operation === "update")
      Object.assign(row, values, { updated_at: "2026-10-02T17:01:00+00:00" });
    return { data: row ?? null, error: null };
  }
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn((field: string, value: unknown) => {
      trace.filters.push([field, value]);
      return chain;
    }),
    is: vi.fn((field: string, value: unknown) => {
      trace.filters.push([field, value]);
      return chain;
    }),
    single: vi.fn(async () => run()),
    maybeSingle: vi.fn(async () => run()),
    then: (
      resolve: (value: Result) => unknown,
      reject: (reason: unknown) => unknown,
    ) => Promise.resolve().then(run).then(resolve, reject),
  };
  return chain;
}
function send(
  method: "POST" | "PATCH" | "DELETE",
  body: unknown,
  id = jobId,
  origin = "http://localhost:3000",
) {
  return { POST, PATCH, DELETE }[method](
    new Request(`http://localhost:3000/api/repair-jobs/${id}/items`, {
      method,
      headers: { "content-type": "application/json", origin },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );
}
function storedItem(extra: Row = {}): Row {
  return {
    id: itemId,
    organisation_id: organisationId,
    repair_job_id: jobId,
    item_type: "labour",
    description: fields.description,
    quantity: 1.5,
    unit_price: 78,
    vat_rate: 20,
    status: "planned",
    supplier: null,
    part_number: null,
    updated_at: timestamp,
    deleted_at: null,
    ...extra,
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  jobs = [
    {
      id: jobId,
      organisation_id: organisationId,
      status: "diagnosing",
      deleted_at: null,
    },
  ];
  items = [];
  audits = [];
  queries = [];
  failingTable = null;
  auditThrows = false;
  mocks.staff.mockResolvedValue({
    role: "owner",
    userId: jobId,
    organisationId,
  });
  mocks.client.mockReturnValue({
    from: (table: string) => ({
      select: () => builder(table, "select"),
      insert: (values: Row) => builder(table, "insert", values),
      update: (values: Row) => builder(table, "update", values),
    }),
  });
});

describe("repair item mutations", () => {
  it("rejects cross-origin requests before touching records", async () => {
    expect(
      (
        await send(
          "POST",
          { ...fields, id: itemId },
          jobId,
          "https://other.test",
        )
      ).status,
    ).toBe(403);
    expect(mocks.staff).not.toHaveBeenCalled();
  });
  it("requires sign-in", async () => {
    mocks.staff.mockResolvedValue(null);
    expect((await send("POST", { ...fields, id: itemId })).status).toBe(401);
  });
  it.each(["technician", "salesperson", "website_editor"])(
    "denies %s item pricing changes",
    async (role) => {
      mocks.staff.mockResolvedValue({ role, organisationId });
      expect((await send("POST", { ...fields, id: itemId })).status).toBe(403);
      expect(mocks.client).not.toHaveBeenCalled();
    },
  );
  it.each(["owner", "manager", "service_advisor"])(
    "allows existing %s repair management permission",
    async (role) => {
      mocks.staff.mockResolvedValue({ role, organisationId, userId: jobId });
      expect((await send("POST", { ...fields, id: itemId })).status).toBe(201);
    },
  );
  it("does not accept reassignment or generated totals from a payload", async () => {
    expect(
      (
        await send("POST", {
          ...fields,
          id: itemId,
          organisation_id: otherOrganisation,
          line_total: 0,
        })
      ).status,
    ).toBe(400);
    expect(items).toHaveLength(0);
  });
  it("rejects malformed IDs and JSON without querying", async () => {
    expect((await send("POST", null)).status).toBe(400);
    expect((await send("POST", fields, "invalid")).status).toBe(400);
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it("cannot add an item to another dealership's or a removed job", async () => {
    jobs[0]!.organisation_id = otherOrganisation;
    expect((await send("POST", { ...fields, id: itemId })).status).toBe(404);
    jobs[0]!.organisation_id = organisationId;
    jobs[0]!.deleted_at = timestamp;
    expect((await send("POST", { ...fields, id: itemId })).status).toBe(404);
    expect(items).toHaveLength(0);
  });
  it.each(["collected", "cancelled"])(
    "requires reopening a %s job",
    async (status) => {
      jobs[0]!.status = status;
      expect((await send("POST", { ...fields, id: itemId })).status).toBe(409);
    },
  );
  it("fails closed when the parent job cannot be checked", async () => {
    failingTable = "repair_jobs";
    const response = await send("POST", { ...fields, id: itemId });
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain(
      "private database detail",
    );
    expect(items).toHaveLength(0);
  });
  it("scopes and records a create without customer data or a generated total write", async () => {
    const response = await send("POST", { ...fields, id: itemId });
    expect(response.status).toBe(201);
    expect(items[0]).toMatchObject({
      organisation_id: organisationId,
      repair_job_id: jobId,
      created_by: jobId,
    });
    expect(
      queries.find(
        (query) =>
          query.operation === "insert" && query.table === "repair_job_items",
      )?.values,
    ).not.toHaveProperty("line_total");
    expect(audits[0]).toMatchObject({
      entity_id: jobId,
      action: "repair_job.item_created",
      new_values: { item_id: itemId, operation: "created" },
    });
  });
  it("repeating the same create returns the existing item without duplicates or repeated audits", async () => {
    await send("POST", { ...fields, id: itemId });
    const response = await send("POST", { ...fields, id: itemId });
    expect(response.status).toBe(200);
    expect(items).toHaveLength(1);
    expect(audits).toHaveLength(1);
  });
  it("does not reuse a collision from another job, or resurrect a removed row", async () => {
    items = [storedItem({ repair_job_id: itemId })];
    expect((await send("POST", { ...fields, id: itemId })).status).toBe(409);
    items = [storedItem({ deleted_at: timestamp })];
    expect((await send("POST", { ...fields, id: itemId })).status).toBe(409);
    expect(items[0]!.deleted_at).toBe(timestamp);
  });
  it("does not report a changed payload as a confirmed repeated create", async () => {
    items = [storedItem()];
    expect(
      (await send("POST", { ...fields, quantity: 2, id: itemId })).status,
    ).toBe(409);
    expect(items[0]!.quantity).toBe(1.5);
  });
  it("scopes updates to the item, parent, tenant and version", async () => {
    items = [storedItem()];
    const response = await send("PATCH", {
      ...fields,
      id: itemId,
      unitPrice: 90,
      expectedUpdatedAt: timestamp,
    });
    expect(response.status).toBe(200);
    const filters = queries.find(
      (query) => query.operation === "update",
    )?.filters;
    expect(filters).toEqual(
      expect.arrayContaining([
        ["id", itemId],
        ["repair_job_id", jobId],
        ["organisation_id", organisationId],
        ["updated_at", timestamp],
        ["deleted_at", null],
      ]),
    );
    expect(items[0]!.unit_price).toBe(90);
  });
  it("cannot update an item belonging to another job or dealership", async () => {
    items = [storedItem({ organisation_id: otherOrganisation })];
    expect(
      (
        await send("PATCH", {
          ...fields,
          id: itemId,
          expectedUpdatedAt: timestamp,
        })
      ).status,
    ).toBe(404);
    items = [storedItem({ repair_job_id: itemId })];
    expect(
      (
        await send("DELETE", {
          id: itemId,
          changeReason: "Wrong part",
          expectedUpdatedAt: timestamp,
        })
      ).status,
    ).toBe(404);
    expect(audits).toHaveLength(0);
  });
  it("rejects stale updates without overwriting another staff member's change", async () => {
    items = [
      storedItem({ updated_at: "2026-10-02T17:02:00+00:00", unit_price: 100 }),
    ];
    expect(
      (
        await send("PATCH", {
          ...fields,
          id: itemId,
          expectedUpdatedAt: timestamp,
        })
      ).status,
    ).toBe(409);
    expect(items[0]!.unit_price).toBe(100);
    expect(audits).toHaveLength(0);
  });
  it("soft removes an item and keeps its history", async () => {
    items = [storedItem()];
    expect(
      (
        await send("DELETE", {
          id: itemId,
          expectedUpdatedAt: timestamp,
          changeReason: "Duplicate part",
        })
      ).status,
    ).toBe(200);
    expect(items).toHaveLength(1);
    expect(items[0]!.deleted_at).toEqual(expect.any(String));
    expect(audits[0]!.action).toBe("repair_job.item_removed");
  });
  it("does not change an unsupported fee/discount row through this editor", async () => {
    items = [storedItem({ item_type: "discount" })];
    expect(
      (
        await send("PATCH", {
          ...fields,
          id: itemId,
          expectedUpdatedAt: timestamp,
        })
      ).status,
    ).toBe(400);
  });
  it("does not claim a failed item write succeeded", async () => {
    failingTable = "repair_job_items";
    const response = await send("POST", { ...fields, id: itemId });
    expect(response.status).toBe(500);
    expect(items).toHaveLength(0);
    expect(audits).toHaveLength(0);
  });
  it.each([false, true])(
    "returns a confirmed save with a warning if audit recording fails (throws=%s)",
    async (throws) => {
      if (throws) auditThrows = true;
      else failingTable = "audit_logs";
      const response = await send("POST", { ...fields, id: itemId });
      const result = await response.json();
      expect(response.status).toBe(201);
      expect(result.ok).toBe(true);
      expect(result.warning).toBe("audit_unavailable");
      expect(result.message).toContain("do not submit it again");
      expect(items).toHaveLength(1);
    },
  );
});
