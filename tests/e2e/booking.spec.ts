import { expect, test, type Page } from "@playwright/test";

// Week 2 flows against the seeded local stack (supabase/seed.sql).
const OWNER = { email: "owner@smilo.local", password: "smilo-dev-password" };

async function login(page: Page, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("El. paštas").fill(OWNER.email);
  await page.getByLabel("Slaptažodis").fill(OWNER.password);
  await page.getByRole("button", { name: "Prisijungti" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

test("settings lists the seeded services and both groomers", async ({ page }) => {
  await login(page, "/settings");
  await expect(page.getByRole("heading", { name: "Paslaugos" })).toBeVisible();
  await expect(page.getByText("Pilnas kirpimas", { exact: true })).toBeVisible();
  await expect(page.getByText("2 val. · 40,00 €")).toBeVisible();
  await expect(page.getByRole("button", { name: "Redaguoti: Meistrė A" })).toBeVisible();
});

test("add a client and a pet (issues #15, #16)", async ({ page }) => {
  const name = `Testas Klientas ${Date.now().toString().slice(-6)}`;
  await login(page, "/clients");
  await page.getByRole("button", { name: "Naujas klientas" }).first().click();
  const sheet = page.getByRole("dialog");
  await sheet.getByLabel("Vardas ir pavardė").fill(name);
  await sheet.getByLabel("Telefonas").fill("123");
  await sheet.getByRole("button", { name: "Išsaugoti" }).click();
  await expect(sheet.getByText("Neteisingas telefono numeris.")).toBeVisible();
  await sheet.getByLabel("Telefonas").fill("");
  await sheet.getByRole("button", { name: "Išsaugoti" }).click();

  await expect(page).toHaveURL(/\/clients\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();

  await page.getByRole("button", { name: "Pridėti augintinį" }).click();
  const petSheet = page.getByRole("dialog");
  await petSheet.getByLabel("Vardas").fill("Žuikis");
  await petSheet.getByText("Katė", { exact: true }).click();
  await petSheet.getByLabel("Pastabos").fill("Kanda kerpant letenas");
  await petSheet.getByRole("button", { name: "Išsaugoti" }).click();
  await expect(page.getByRole("heading", { level: 3, name: "Žuikis" })).toBeVisible();
  await expect(page.getByText("Kanda kerpant letenas")).toBeVisible();

  // local, accent-insensitive filter on the list
  await page.goto("/clients");
  await page.getByLabel("Ieškoti klientų").fill("zuikis");
  await expect(page.getByRole("link", { name: new RegExp(name) })).toBeVisible();
});

test("book an existing client, then hit the overlap rule (US-05, US-09)", async ({ page }, testInfo) => {
  // Sundays have no seeded bookings. Each project / retry gets its own day so runs never collide.
  const day = testInfo.project.name === "mobile" ? "2026-11-01" : "2026-11-08";
  const hour = 9 + testInfo.retry * 4; // 09:00, then 13:00 on a retry
  const start = `${String(hour).padStart(2, "0")}:00`;
  const end = `${String(hour + 2).padStart(2, "0")}:00`;
  const overlapStart = `${String(hour + 1).padStart(2, "0")}:00`;

  await login(page, `/calendar?date=${day}`);
  await page.getByRole("button", { name: `Registruoti: Meistrė A, ${start}` }).click();

  const sheet = page.getByRole("dialog");
  await expect(sheet.getByRole("heading", { name: "Nauja registracija" })).toBeVisible();
  await sheet.getByPlaceholder("Vardas, augintinis ar telefonas").fill("Petrausk");
  await sheet.getByRole("button", { name: "Pasirinkti Rasa Petrauskienė" }).click();
  await sheet.getByLabel("Augintinis", { exact: true }).selectOption({ index: 1 });
  await sheet.getByLabel("Paslauga").selectOption({ label: "Pilnas kirpimas" });
  await expect(sheet.getByLabel("Visa trukmė")).toHaveValue("120");
  await sheet.getByRole("button", { name: "Išsaugoti" }).click();

  await expect(page.getByText("Registracija išsaugota").first()).toBeVisible();
  await expect(
    page.getByRole("button", { name: new RegExp(`^${start}–${end}, .+, Rasa Petrauskienė$`) }),
  ).toBeVisible();

  // Same groomer, overlapping time → nothing saved, Lithuanian message naming the conflict.
  await page.getByRole("button", { name: `Registruoti: Meistrė A, ${end}` }).click();
  await sheet.getByLabel("Pradžia").selectOption(overlapStart);
  await sheet.getByPlaceholder("Vardas, augintinis ar telefonas").fill("Petrausk");
  await sheet.getByRole("button", { name: "Pasirinkti Rasa Petrauskienė" }).click();
  await sheet.getByLabel("Augintinis", { exact: true }).selectOption({ index: 1 });
  await sheet.getByLabel("Paslauga").selectOption({ label: "Pilnas kirpimas" });
  await sheet.getByRole("button", { name: "Išsaugoti" }).click();
  await expect(sheet.getByText(`Šis laikas jau užimtas: ${start}–${end}`)).toBeVisible();

  // Groomer B is free at that time.
  await sheet.getByLabel("Meistrė").selectOption({ label: "Meistrė B" });
  await sheet.getByRole("button", { name: "Išsaugoti" }).click();
  await expect(page.getByText("Registracija išsaugota").first()).toBeVisible();
});
