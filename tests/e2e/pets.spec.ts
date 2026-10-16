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
  const sheet = page.getByRole("dialog");
  const existing = page.getByRole("button", { name: "Redaguoti Pilnas kirpimas" });
  if (await existing.count()) {
    await existing.click(); // a retry: the row was saved by the first attempt
  } else {
    await page.getByRole("button", { name: "Pridėti paslaugą" }).first().click();
    await sheet.getByLabel("Paslauga").selectOption({ label: "Pilnas kirpimas" });
  }
  await sheet.getByLabel("Trukmė").selectOption("150");
  await sheet.getByLabel("Kaina, €").fill("55");
  await sheet.getByRole("button", { name: "Išsaugoti" }).click();
  await expect(page.getByText("Paslauga išsaugota").first()).toBeVisible();
  await expect(page.getByText("Įprasta", { exact: true })).toBeVisible();
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
  await sheet.getByPlaceholder("Augintinis, šeimininkas ar telefonas").fill(p.remember);
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

// Pets that always come together (owner feedback): one booking, one row per pet,
// each pet with its own service and price; duration = sum.
const FAMILIES: Record<string, { client: string; pets: [string, string]; weeks: number }> = {
  mobile: { client: "Ieva Urbonienė", pets: ["Mimi", "Oskaras"], weeks: 12 },
  tablet: { client: "Greta Vasiliauskaitė", pets: ["Bonis", "Kikis"], weeks: 13 },
  desktop: { client: "Eglė Butkienė", pets: ["Pūkas", "Tobis"], weeks: 14 },
};

test("book two pets that always come together in one tap", async ({ page }, testInfo) => {
  const f = FAMILIES[testInfo.project.name] ?? FAMILIES.desktop;
  const day = futureSunday(f.weeks);
  const start = `${String(9 + testInfo.retry * 4).padStart(2, "0")}:00`;
  const end = `${String(12 + testInfo.retry * 4).padStart(2, "0")}:00`;
  await login(page, `/calendar?date=${day}`);
  await page.getByRole("button", { name: `Registruoti: Meistrė A, ${start}` }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByPlaceholder("Augintinis, šeimininkas ar telefonas").fill(f.client);
  await sheet
    .getByRole("button", { name: `Pasirinkti visus kartu: ${f.pets.join(", ")} (${f.client})` })
    .click();

  // two rows, one per pet
  await expect(sheet.getByText("Augintinis 1")).toBeVisible();
  await expect(sheet.getByText("Augintinis 2")).toBeVisible();
  const petSelects = sheet.getByLabel("Augintinis", { exact: true });
  await expect(petSelects).toHaveCount(2);

  // remove the second, add it back with the one-tap chip
  await sheet.getByRole("button", { name: "Pašalinti augintinį 2" }).click();
  await expect(petSelects).toHaveCount(1);
  await sheet.getByRole("group", { name: "Pridėti kitą šio kliento augintinį" }).getByRole("button").click();
  await expect(petSelects).toHaveCount(2);

  const services = sheet.getByLabel("Paslauga");
  await services.nth(0).selectOption({ label: "Maudymas ir džiovinimas" });
  await services.nth(1).selectOption({ label: "Maudymas ir džiovinimas" });
  await expect(sheet.getByLabel("Visa trukmė")).toHaveValue("180");
  await sheet.getByRole("button", { name: "Išsaugoti" }).click();
  await expect(page.getByText("Registracija išsaugota").first()).toBeVisible();
  await expect(
    page.getByRole("button", { name: `${start}–${end}, ${f.pets.join(", ")}, ${f.client}` }),
  ).toBeVisible();
});

test("pet page books the whole family together", async ({ page }) => {
  await login(page, "/clients");
  await page.getByLabel("Ieškoti augintinio ar šeimininko").fill("Bela");
  await page.getByRole("link", { name: /Bela.*Jonas Kazlauskas/ }).click();
  await page.getByRole("link", { name: "Registruoti kartu su Reksas" }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByLabel("Augintinis", { exact: true })).toHaveCount(2);
  // both pets have their own services in seed.sql: 60 + 210 min, 25 + 75 €
  await expect(sheet.getByLabel("Visa trukmė")).toHaveValue("270");
  await expect(sheet.getByLabel("Kaina, €").nth(0)).toHaveValue("25,00");
  await expect(sheet.getByLabel("Kaina, €").nth(1)).toHaveValue("75,00");
});

// Pet first, client optional (owner feedback 2026-10-16)
const WEEKS_NO_CLIENT: Record<string, number> = { mobile: 15, tablet: 16, desktop: 17 };

test("a new pet needs no owner; a phone-only owner can be added later", async ({ page }) => {
  const name = `Testukas${Date.now().toString().slice(-6)}`;
  const phone = `86${String(Date.now()).slice(-7)}`;
  await login(page, "/clients");
  await page.getByRole("button", { name: "Naujas augintinis" }).first().click();
  const sheet = page.getByRole("dialog");
  await sheet.getByLabel("Vardas", { exact: true }).fill(name);
  await sheet.getByRole("button", { name: "Išsaugoti" }).click();

  await expect(page).toHaveURL(/\/pets\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  await expect(page.getByText(/Šeimininkas nenurodytas/)).toBeVisible();

  await page.getByRole("button", { name: "Pridėti šeimininką" }).click();
  const owner = page.getByRole("dialog");
  await owner.getByRole("button", { name: "Nauji kontaktai" }).click();
  await owner.getByRole("button", { name: "Išsaugoti" }).click();
  await expect(
    owner.getByText("Įrašykite bent vieną: vardą, telefoną arba el. paštą.").first(),
  ).toBeVisible();
  await owner.getByLabel("Telefonas").fill(phone);
  await owner.getByRole("button", { name: "Išsaugoti" }).click();
  await expect(page.getByText("Šeimininkas išsaugotas").first()).toBeVisible();
  await expect(page.getByRole("link", { name: /\+370 6/ }).first()).toBeVisible();
});

test("book a brand-new pet with no contact details at all", async ({ page }, testInfo) => {
  const day = futureSunday(WEEKS_NO_CLIENT[testInfo.project.name] ?? 17);
  const start = `${String(9 + testInfo.retry * 4).padStart(2, "0")}:00`;
  const end = `${String(11 + testInfo.retry * 4).padStart(2, "0")}:00`;
  const name = `Naujokas${Date.now().toString().slice(-6)}`;
  await login(page, `/calendar?date=${day}`);
  await page.getByRole("button", { name: `Registruoti: Meistrė A, ${start}` }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByPlaceholder("Augintinis, šeimininkas ar telefonas").fill(name);
  await sheet.getByRole("button", { name: "Naujas augintinis" }).click();
  await expect(sheet.getByLabel("Augintinio vardas")).toHaveValue(name);
  await sheet.getByLabel("Paslauga").selectOption({ label: "Pilnas kirpimas" });
  await sheet.getByRole("button", { name: "Išsaugoti" }).click();
  await expect(page.getByText("Registracija išsaugota").first()).toBeVisible();
  await expect(page.getByRole("button", { name: `${start}–${end}, ${name}` })).toBeVisible();
});
