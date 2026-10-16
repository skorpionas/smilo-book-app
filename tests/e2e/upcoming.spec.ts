import { expect, test, type Page } from "@playwright/test";

// Artimiausi (US-04) against the seeded local stack: seed.sql has weekday bookings
// from 2026-10-12 to 2026-11-08, so the next 14 days always contain some. Read-only.
const OWNER = { email: "owner@smilo.local", password: "smilo-dev-password" };

async function login(page: Page, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("El. paštas").fill(OWNER.email);
  await page.getByLabel("Slaptažodis").fill(OWNER.password);
  await page.getByRole("button", { name: "Prisijungti" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

test("upcoming bookings are grouped by date with a count per day (US-04)", async ({ page }) => {
  await login(page, "/upcoming");
  await expect(page.getByRole("heading", { level: 1, name: "Artimiausi vizitai" })).toBeVisible();
  await expect(page.getByText(/vizitų: \d+/).first()).toBeVisible();

  const list = page.getByRole("list", { name: "Artimiausi vizitai pagal dienas" });
  const days = list.locator(":scope > li:not([data-free])");
  await expect(days.first()).toBeVisible();

  // Dates ascending, at most 14 days, each day's count matches its rows.
  const dates = await days.evaluateAll((els) =>
    els.map((el) => el.querySelector("[id^='upcoming-']")!.id.replace("upcoming-", "")),
  );
  expect(dates.length).toBeLessThanOrEqual(14);
  expect([...dates].sort()).toEqual(dates);

  const firstDay = days.first();
  const rows = firstDay.locator(":scope ul > li");
  const count = await rows.count();
  expect(count).toBeGreaterThan(0);
  await expect(firstDay.getByText(`Vizitų: ${count}`)).toBeAttached();

  // Start times within a day are in order.
  const times = await rows.evaluateAll((els) => els.map((el) => el.textContent!.match(/\d{2}:\d{2}/)![0]));
  expect([...times].sort()).toEqual(times);

  // Tapping a booking opens its details.
  await rows.first().getByRole("button").click();
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("a day heading opens that day in the calendar", async ({ page }) => {
  await login(page, "/upcoming");
  const link = page
    .getByRole("list", { name: "Artimiausi vizitai pagal dienas" })
    .getByRole("link", { name: /^Atidaryti dieną / })
    .first();
  const href = await link.getAttribute("href");
  await link.click();
  await expect(page).toHaveURL(new RegExp(`${href!.replace("?", "\\?")}$`));
});

test("groomer filter keeps only that groomer's bookings", async ({ page }) => {
  await login(page, "/upcoming");
  const list = page.getByRole("list", { name: "Artimiausi vizitai pagal dienas" });
  await page
    .getByRole("group", { name: "Rodyti meistrę" })
    .getByRole("button", { name: /^Meistrė A/ })
    .click();
  const rows = list.locator(":scope > li ul > li").getByRole("button");
  await expect(rows.first()).toBeVisible();
  const names = await rows.evaluateAll((els) => els.map((el) => el.getAttribute("aria-label") ?? el.textContent ?? ""));
  expect(names.every((n) => n.includes("Meistrė A"))).toBe(true);
  await page.getByRole("button", { name: /^Visos/ }).click();
  await expect(list.getByRole("button", { name: /Meistrė B/ }).first()).toBeVisible();
});
