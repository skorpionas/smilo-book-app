import { expect, test } from "@playwright/test";

// US-01 Log in. Seed user from supabase/seed.sql (local stack only).
const OWNER = { email: "owner@smilo.local", password: "smilo-dev-password" };

test.describe("US-01 login", () => {
  test("logged-out visitors are redirected to /login", async ({ page }) => {
    await page.goto("/clients");
    await expect(page).toHaveURL(/\/login\?next=%2Fclients/);
    await expect(page.getByRole("heading", { name: "Prisijungimas" })).toBeVisible();
    // No sign-up link anywhere
    await expect(page.getByText(/registruotis|sukurti paskyrą/i)).toHaveCount(0);
  });

  test("wrong password shows a Lithuanian error", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("El. paštas").fill(OWNER.email);
    await page.getByLabel("Slaptažodis").fill("wrong-password-123");
    await page.getByRole("button", { name: "Prisijungti" }).click();
    // Next.js adds an empty role="alert" route announcer, so match by text
    await expect(page.getByText("Neteisingas el. paštas arba slaptažodis.")).toBeVisible();
  });

  test("owner logs in, lands on today's calendar, can navigate and log out", async ({ page, isMobile }) => {
    await page.goto("/clients");
    await page.getByLabel("El. paštas").fill(OWNER.email);
    await page.getByLabel("Slaptažodis").fill(OWNER.password);
    await page.getByRole("button", { name: "Prisijungti" }).click();

    // returns to the page that was asked for
    await expect(page).toHaveURL(/\/clients$/);

    const nav = page.getByRole("navigation", { name: "Pagrindinė navigacija" });
    await nav.getByRole("link", { name: "Kalendorius" }).click();
    await expect(page).toHaveURL(/\/calendar/);
    await expect(page.getByText("Meistrė A")).toBeVisible();
    await expect(page.getByText("Meistrė B")).toBeVisible();

    // all five sections reachable, touch targets ≥ 44 px
    for (const name of ["Artimiausi", "Paieška", "Klientai", "Nustatymai", "Kalendorius"]) {
      const link = nav.getByRole("link", { name });
      const box = await link.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
      await link.click();
      await expect(link).toHaveAttribute("aria-current", "page");
    }

    // /login while logged in -> calendar
    await page.goto("/login");
    await expect(page).toHaveURL(/\/calendar/);

    if (!isMobile) {
      await page.getByRole("button", { name: "Atsijungti" }).click();
      await expect(page).toHaveURL(/\/login/);
      await page.goto("/calendar");
      await expect(page).toHaveURL(/\/login/);
    }
  });

  test("sign-up API is disabled", async ({ request }) => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    test.skip(!url || !key, "Supabase env not set");
    const res = await request.post(`${url}/auth/v1/signup`, {
      headers: { apikey: key!, "Content-Type": "application/json" },
      data: { email: "intruder@example.com", password: "a-very-long-password-123" },
    });
    expect(res.ok()).toBe(false);
  });
});

test("day navigation keeps the date in the URL (DST day renders)", async ({ page }) => {
  await page.goto("/login?next=/calendar%3Fdate%3D2026-10-25");
  await page.getByLabel("El. paštas").fill(OWNER.email);
  await page.getByLabel("Slaptažodis").fill(OWNER.password);
  await page.getByRole("button", { name: "Prisijungti" }).click();
  await expect(page).toHaveURL(/date=2026-10-25/);
  await expect(page.getByText("sekmadienis")).toBeVisible();
  await page.getByRole("link", { name: "Kita diena" }).click();
  await expect(page).toHaveURL(/date=2026-10-26/);
  await expect(page.getByText("pirmadienis")).toBeVisible();
});
