import { expect, test, type Page } from "@playwright/test";

// Screenshots of every main screen for the UI/UX review (iPhone, iPad portrait +
// landscape, desktop). Off by default; CI runs it with SCREENSHOTS=1 and uploads
// the images as the "screenshots" artifact.
test.skip(!process.env.SCREENSHOTS, "set SCREENSHOTS=1 to capture review screenshots");

const OWNER = { email: "owner@smilo.local", password: "smilo-dev-password" };
const DAY = "2026-10-20";
const MAKSAS = "0d000000-0000-4000-8000-000000000001";
const RASA = "0c000000-0000-4000-8000-000000000001";
// Reksas has his own services in seed.sql: the booking sheet shows the pre-fill
const JONAS = "0c000000-0000-4000-8000-000000000002";
const REKSAS = "0d000000-0000-4000-8000-000000000003";

async function shot(page: Page, project: string, name: string, fullPage = true) {
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: `screenshots/${project}/${name}.png`, fullPage });
}

test("capture main screens", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const sizes =
    testInfo.project.name === "tablet"
      ? [
          { suffix: "tablet-portrait", width: 820, height: 1180 },
          { suffix: "tablet-landscape", width: 1180, height: 820 },
        ]
      : [{ suffix: testInfo.project.name, width: 0, height: 0 }];

  await page.goto("/login");
  await shot(page, sizes[0].suffix, "00-login");
  await page.getByLabel("El. paštas").fill(OWNER.email);
  await page.getByLabel("Slaptažodis").fill(OWNER.password);
  await page.getByRole("button", { name: "Prisijungti" }).click();
  await expect(page).not.toHaveURL(/\/login/);

  for (const size of sizes) {
    if (size.width) await page.setViewportSize({ width: size.width, height: size.height });
    const p = size.suffix;
    await page.goto(`/calendar?date=${DAY}`);
    await shot(page, p, "01-day", false);
    await page.goto(`/calendar/week?date=${DAY}`);
    await shot(page, p, "02-week");
    await page.goto(`/calendar/month?date=${DAY}`);
    await shot(page, p, "03-month");
    await page.goto("/upcoming");
    await shot(page, p, "04-upcoming");
    await page.goto("/clients");
    await shot(page, p, "05-pets");
    await page.goto("/clients?view=owners");
    await shot(page, p, "06-owners");
    await page.goto(`/clients/${RASA}`);
    await shot(page, p, "07-client");
    await page.goto(`/pets/${MAKSAS}`);
    await shot(page, p, "08-pet");
    await page.goto(`/pets/${REKSAS}`);
    await shot(page, p, "08b-pet-own-services");
    await page.goto("/search");
    await page.getByRole("searchbox").first().fill("ma");
    await page.waitForTimeout(800);
    await shot(page, p, "09-search");
    await page.goto("/settings");
    await shot(page, p, "10-settings");

    // booking sheet opened from a pet page (pet pre-selected, own service filled in)
    await page.goto(`/calendar?client=${JONAS}&pet=${REKSAS}`);
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.waitForTimeout(400);
    await shot(page, p, "11-booking-sheet", false);

    // booking detail sheet
    await page.goto(`/calendar?date=${DAY}`);
    const card = page.getByRole("button", { name: /^\d\d:\d\d–\d\d:\d\d, / }).first();
    if (await card.count()) {
      await card.click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.waitForTimeout(400);
      await shot(page, p, "12-booking-detail", false);
    }
  }
});
