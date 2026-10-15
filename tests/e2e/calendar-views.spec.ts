import { expect, test, type Page } from "@playwright/test";

// Working days, week and month views against the seeded local stack (supabase/seed.sql):
// Meistrė A works every day, Meistrė B Monday–Saturday. Read-only: nothing is saved.
const OWNER = { email: "owner@smilo.local", password: "smilo-dev-password" };
/** Next Sunday (YYYY-MM-DD); slots are only offered for today and later. */
function nextSunday(): string {
  const d = new Date();
  d.setUTCHours(12, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + ((7 - d.getUTCDay()) % 7 || 7));
  return d.toISOString().slice(0, 10);
}
const shift = (date: string, days: number) => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const SUNDAY = nextSunday();
const SATURDAY = shift(SUNDAY, -1);
const MONDAY = shift(SUNDAY, -6);

async function login(page: Page, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("El. paštas").fill(OWNER.email);
  await page.getByLabel("Slaptažodis").fill(OWNER.password);
  await page.getByRole("button", { name: "Prisijungti" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

test("day view shows a lane only for groomers working that weekday", async ({ page }) => {
  await login(page, `/calendar?date=${SUNDAY}`);
  await expect(page.getByRole("button", { name: "Registruoti: Meistrė A, 10:00" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Registruoti: Meistrė B,/ })).toHaveCount(0);

  // A weekday has both lanes.
  await page.getByRole("link", { name: "Ankstesnė diena" }).click();
  await expect(page).toHaveURL(new RegExp(`date=${SATURDAY}`));
  await expect(page.getByRole("button", { name: /^Registruoti: Meistrė B,/ }).first()).toBeAttached();
});

test("switch to the week view and back to a day", async ({ page }, testInfo) => {
  await login(page, `/calendar?date=${SUNDAY}`);
  await page
    .getByRole("navigation", { name: "Kalendoriaus vaizdas" })
    .getByRole("link", { name: "Savaitė" })
    .click();
  await expect(page).toHaveURL(new RegExp(`/calendar/week\\?date=${SUNDAY}`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`${MONDAY.slice(5)} – ${SUNDAY.slice(5)}`);
  await expect(page.getByText(/\d+ savaitė/)).toBeVisible();

  if (testInfo.project.name === "desktop") {
    const grid = page.getByRole("region", { name: "Savaitės tvarkaraštis" });
    await expect(
      grid.getByRole("button", { name: `Registruoti: sekmadienis ${SUNDAY}, Meistrė A, 10:00` }),
    ).toBeAttached();
    await expect(
      grid.getByRole("button", { name: new RegExp(`^Registruoti: sekmadienis ${SUNDAY}, Meistrė B`) }),
    ).toHaveCount(0);
    await expect(
      grid
        .getByRole("button", { name: new RegExp(`^Registruoti: šeštadienis ${SATURDAY}, Meistrė B`) })
        .first(),
    ).toBeAttached();
  }

  await page
    .getByRole("link", { name: `Atidaryti dieną sekmadienis ${SUNDAY}` })
    .locator("visible=true")
    .click();
  await expect(page).toHaveURL(new RegExp(`/calendar\\?date=${SUNDAY}$`));
});

test("month view opens a day", async ({ page }) => {
  await login(page, "/calendar/month?date=2026-10-15");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("2026 m. spalis");
  const cell = page.getByRole("link", { name: /^ketvirtadienis 2026-10-15: vizitų \d+$/ });
  await expect(cell).toBeVisible();

  await page.getByRole("link", { name: "Kitas mėnuo" }).click();
  await expect(page).toHaveURL(/\/calendar\/month\?date=2026-11-01/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("2026 m. lapkritis");
  await page.getByRole("link", { name: /^pirmadienis 2026-11-02: vizitų \d+$/ }).click();
  await expect(page).toHaveURL(/\/calendar\?date=2026-11-02$/);
});

test("groomer settings show working days", async ({ page }) => {
  await login(page, "/settings");
  await expect(page.getByText("Pr–Št")).toBeVisible(); // Meistrė B
  await page.getByRole("button", { name: "Redaguoti: Meistrė B" }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByRole("button", { name: "pirmadienis" })).toHaveAttribute("aria-pressed", "true");
  await expect(sheet.getByRole("button", { name: "sekmadienis" })).toHaveAttribute("aria-pressed", "false");
});
