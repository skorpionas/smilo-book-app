import { expect, test } from "@playwright/test";

// Security review 2026-10-16: nothing is reachable without a session.
const ANY_ID = "00000000-0000-4000-8000-000000000000";
const PRIVATE_ROUTES = [
  "/",
  "/calendar",
  "/calendar/week",
  "/calendar/month",
  "/upcoming",
  "/search",
  "/clients",
  "/clients?view=owners",
  `/clients/${ANY_ID}`,
  `/pets/${ANY_ID}`,
  "/settings",
  "/styleguide",
  "/account/new-password",
];

test.describe("security: logged-out visitor", () => {
  for (const route of PRIVATE_ROUTES) {
    test(`${route} redirects to /login and shows no data`, async ({ request }) => {
      const res = await request.get(route, { maxRedirects: 0 });
      expect([303, 307, 308]).toContain(res.status());
      expect(res.headers()["location"] ?? "").toMatch(/\/login(\?|$)/);
      expect(await res.text()).not.toMatch(/Petrauskien|Maksas|\+370/);
    });
  }

  test("a server action POST without a session returns no data", async ({ request }) => {
    // Without a valid session the proxy redirects before any action runs.
    const res = await request.post("/clients", {
      maxRedirects: 0,
      headers: { "Next-Action": "0".repeat(42), "Content-Type": "text/plain;charset=UTF-8" },
      data: '["ma"]',
    });
    expect(res.status()).not.toBe(200);
    expect(await res.text()).not.toMatch(/Petrauskien|Maksas|\+370/);
  });

  test("no password-reset pages: they need a session like everything else", async ({ request }) => {
    for (const path of ["/forgot-password", "/auth/confirm?next=https://evil.example"]) {
      const res = await request.get(path, { maxRedirects: 0 });
      expect(res.headers()["location"] ?? "").toMatch(/\/login(\?|$)/);
    }
  });

  test("login page is not frameable and sends security headers", async ({ request }) => {
    const res = await request.get("/login");
    const h = res.headers();
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["strict-transport-security"]).toContain("max-age=");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  });

  test("a crafted next= cannot send the owner to another site after login", async ({ page }) => {
    await page.goto("/login?next=" + encodeURIComponent("/\t/evil.example"));
    await page.getByLabel("El. paštas").fill("owner@smilo.local");
    await page.getByLabel("Slaptažodis").fill("smilo-dev-password");
    await page.getByRole("button", { name: "Prisijungti" }).click();
    await expect(page).toHaveURL(/localhost:\d+\/calendar/);
  });
});
