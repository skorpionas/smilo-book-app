import { expect, test, type Page } from "@playwright/test";

// Pet-first directory, pet page and per-pet services (owner feedback 2026-10-16).
// Each project works on its own seeded pets so parallel runs never collide.
const OWNER = { email: "owner@smilo.local", password: "smilo-dev-password" };
const PETS: Record<string, { own: string; owner: string; remember: string; weeks: number }> = {
  mobile: { own: "Ares", owner: "Darius Navickas", remember: "Herkus", weeks: 7 },
  tablet: { own: "Mila", owner: "Laura Adomaitienė", remember: "Pupa", weeks: 8 },
  desktop: { own: "Dora", owner: "Darius Navickas", remember: "Rudis", weeks: 9 },
};

function futureSunday(weeks: number): string {
  const d = new Date();
  d.setUTCHours(12, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + ((7 - d.getUTCDay()) % 7 || 7) + weeks * 7);
  return d.toISOString().slice(0, 10);
}

async function login(page: Page, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("El. paštas").fill(OWNER.email);
  await page.getByLabel("Slaptažodis").fill(OWNER.password);
  await page.getByRole("button", { name: "Prisijungti" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

test("pet list: species filter and search, one row per pet with its owner", async ({ page }) => {
  await login(page, "/clients");
  await expect(page.getByRole("heading", { level: 1, name: "Augintiniai" })).toBeVisible();
  // Rasa has a dog and a cat: two rows, both naming her
  await page.getByLabel("Ieškoti augintinio ar šeimininko").fill("petrausk");
  await expect(page.getByRole("link", { name: /Maksas.*Rasa Petrauskienė/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Žuikis.*Rasa Petrauskienė/ })).toBeVisible();
  await page.getByRole("button", { name: /^Katės/ }).click();
  await expect(page.getByRole("link", { name: /Maksas/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Žuikis/ })).toBeVisible();
  // tap-to-call on the row
  await expect(page.getByRole("link", { name: "Skambinti +370 612 34567" }).first()).toBeVisible();
});

test("pet's own service pre-fills the booking sheet", async ({ page }, testInfo) => {
  const p = PETS[testInfo.project.name] ?? PETS.desktop;
  await login(page, "/clients");
  await page.getByLabel("Ieškoti augintinio ar šeimininko").fill(p.own);
  await page.getByRole("link", { name: new RegExp(`${p.own}.*${p.owner}`) }).click();
  await expect(page).toHaveURL(/\/pets\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1, name: p.own })).toBeVisible();
  await expect(page.getByRole("link", { name: new RegExp(p.owner) })).toBeVisible();

  // Add "Pilnas kirpimas" for this pet: 2 h 30 min, 55 €
  await page.getByRole("button", { name: "Pridėti paslaugą" }).first().click();
  const sheet = page.getByRole("dialog");
  await sheet.getByLabel("Paslauga").selectOption({ label: "Pilnas kirpimas" });
  await sheet.getByLabel("Trukmė").selectOption("150");
  await sheet.getByLabel("Kaina, €").fill("55");
  await sheet.getByRole("button", { name: "Išsaugoti" }).click();
  await expect(page.getByText("Paslauga išsaugota").first()).toBeVisible();
  await expect(page.getByText("Įprasta")).toBeVisible();
  await expect(page.getByText(/2 val\. 30 min\. · 55,00 €/)).toBeVisible();

  // Book from the pet page: pet, service, duration and price are filled in
  await page.getByRole("link", { name: `Registruoti ${p.own}` }).click();
  const booking = page.getByRole("dialog");
  await expect(booking.getByRole("heading", { name: "Nauja registracija" })).toBeVisible();
  await expect(booking.getByText(p.owner)).toBeVisible();
  await expect(booking.getByLabel("Paslauga")).toHaveValue(/.+/);
  await expect(booking.getByLabel("Visa trukmė")).toHaveValue("150");
  await expect(booking.getByLabel("Kaina, €")).toHaveValue("55,00");
  await expect(booking.getByText("Šio augintinio kaina")).toBeVisible();
});

test("remember a custom price while booking", async ({ page }, testInfo) => {
  const p = PETS[testInfo.project.name] ?? PETS.desktop;
  const day = futureSunday(p.weeks);
  const start = `${String(9 + testInfo.retry * 4).padStart(2, "0")}:00`;
  await login(page, `/calendar?date=${day}`);
  await page.getByRole("button", { name: `Registruoti: Meistrė A, ${start}` }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByPlaceholder("Vardas, augintinis ar telefonas").fill(p.remember);
  await sheet.getByRole("button", { name: new RegExp(`^Pasirinkti ${p.remember} \\(`) }).click();
  await sheet.getByLabel("Paslauga").selectOption({ label: "Maudymas ir džiovinimas" });
  await sheet.getByLabel("Kaina, €").fill("33");
  await sheet.getByLabel(new RegExp(`Įsiminti trukmę ir kainą: ${p.remember}`)).check();
  await sheet.getByRole("button", { name: "Išsaugoti" }).click();
  await expect(page.getByText("Registracija išsaugota").first()).toBeVisible();

  await page.goto("/clients");
  await page.getByLabel("Ieškoti augintinio ar šeimininko").fill(p.remember);
  await page
    .getByRole("link", { name: new RegExp(`^.*${p.remember}`) })
    .first()
    .click();
  const services = page.getByRole("region", { name: "Paslaugos ir kainos" });
  await expect(services.getByText("Maudymas ir džiovinimas")).toBeVisible();
  await expect(services.getByText(/33,00 €/)).toBeVisible();
});
