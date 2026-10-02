import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

const useSupabase = process.env.E2E_USE_SUPABASE === "true";
if (useSupabase && process.env.E2E_DISPOSABLE_SUPABASE !== "true") {
  throw new Error("Live browser tests require E2E_DISPOSABLE_SUPABASE=true and an isolated test project.");
}
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "on-first-retry",
    launchOptions: executablePath ? { executablePath, args: ["--no-sandbox", "--no-zygote", "--disable-dev-shm-usage"] } : undefined,
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], browserName: "chromium" },
      testMatch: /public-smoke\.spec\.ts/,
    },
  ],
  webServer: {
    command: "npm run dev -- --webpack --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: process.env.E2E_REUSE_SERVER === "true" && !process.env.CI,
    timeout: 120_000,
    env: {
      ...process.env,
      DEALEROS_DEMO_MODE: useSupabase ? "false" : "true",
      ...(!useSupabase ? { NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_ANON_KEY: "", SUPABASE_SERVICE_ROLE_KEY: "" } : {}),
      VEHICLE_LOOKUP_PROVIDER: "mock",
      DVLA_VES_API_KEY: "",
      AUTOTRADER_API_KEY: "",
      AUTOTRADER_API_SECRET: "",
      AUTOTRADER_ADVERTISER_ID: "",
      EMAIL_PROVIDER: "console",
      RESEND_API_KEY: "",
      NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3100",
      NEXT_FONT_GOOGLE_MOCKED_RESPONSES: path.resolve(
        process.cwd(),
        "tests/e2e/next-font-mocks.cjs",
      ),
    },
  },
});
