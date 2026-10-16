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
  await page.getByLabel("Ieškoti augintinio ar kliento").fill("petrausk");
  // Rasa has a dog and a cat: one family block with both pets
  const family = page.getByRole("list", { name: "Kliento Rasa Petrauskienė augintiniai" });
  await expect(family.getByRole("link", { name: /Maksas/ })).toBeVisible();
  await expect(family.getByRole("link", { name: /Žuikis/ })).toBeVisible();
  await page.getByRole("button", { name: /^Katės/ }).click();
  await expect(page.getByRole("link", { name: /Maksas/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Žuikis/ })).toBeVisible();
  // tap-to-call on the row
  await expect(page.getByRole("link", { name: "Skambinti +370 612 34567" }).first()).toBeVisible();
});

test("pet's own service pre-fills the booking sheet", async ({ page }, testInfo) => {
  const p = PETS[testInfo.project.name] ?? PETS.desktop;
  await login(page, "/clients");
  await page.getByLabel("Ieškoti augintinio ar kliento").fill(p.own);
  await page.getByRole("link", { name: new RegExp(`^(Šuo|Katė) ${p.own}`) }).click();
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
  await sheet.getByPlaceholder("Augintinis, klientas ar telefonas").fill(p.remember);
  await sheet.getByRole("button", { name: new RegExp(`^Pasirinkti ${p.remember} \\(`) }).click();
  await sheet.getByLabel("Paslauga").selectOption({ label: "Maudymas ir džiovinimas" });
  await sheet.getByLabel("Kaina, €").fill("33");
  await sheet.getByLabel(new RegExp(`Įsiminti trukmę ir kainą: ${p.remember}`)).check();
  await sheet.getByRole("button", { name: "Išsaugoti" }).click();
  await expect(page.getByText("Registracija išsaugota").first()).toBeVisible();

  await page.goto("/clients");
  await page.getByLabel("Ieškoti augintinio ar kliento").fill(p.remember);
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
  await sheet.getByPlaceholder("Augintinis, klientas ar telefonas").fill(f.client);
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
  // one tap: the same service for the second pet
  await sheet.getByRole("button", { name: "„Maudymas ir džiovinimas“ visiems augintiniams" }).click();
  await expect(services.nth(1)).toHaveValue(await services.nth(0).inputValue());
  await expect(sheet.getByLabel("Visa trukmė")).toHaveValue("180");
  await sheet.getByRole("button", { name: "Išsaugoti" }).click();
  await expect(page.getByText("Registracija išsaugota").first()).toBeVisible();
  await expect(
    page.getByRole("button", { name: `${start}–${end}, ${f.pets.join(", ")}, ${f.client}` }),
  ).toBeVisible();
});

test("pet page books the whole family together", async ({ page }) => {
  await login(page, "/clients");
  await page.getByLabel("Ieškoti augintinio ar kliento").fill("Bela");
  await page.getByRole("link", { name: /^Šuo Bela/ }).click();
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

test("a new pet gets its own family; its contact can be added later", async ({ page }) => {
  const name = `Testukas${Date.now().toString().slice(-6)}`;
  const phone = `86${String(Date.now()).slice(-7)}`;
  await login(page, "/clients");
  await page.getByRole("button", { name: "Naujas augintinis" }).first().click();
  const sheet = page.getByRole("dialog");
  await sheet.getByLabel("Augintinio 1 vardas").fill(name);
  await sheet.getByRole("button", { name: "Išsaugoti" }).click();

  await expect(page).toHaveURL(/\/pets\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  // the family exists, without contact, shown by the pet's name
  const family = page.getByRole("region", { name: "Klientas" });
  await expect(family.getByText("Kontaktų nėra")).toBeVisible();
  await family.getByRole("link", { name: new RegExp(name) }).click();

  await expect(page).toHaveURL(/\/clients\/[0-9a-f-]{36}$/);
  await page.getByRole("button", { name: "Pridėti kontaktus" }).click();
  const contact = page.getByRole("dialog");
  await contact.getByLabel("Telefonas").fill(phone);
  await contact.getByRole("button", { name: "Išsaugoti" }).click();
  await expect(page.getByRole("heading", { level: 1, name: /\+370 6/ })).toBeVisible();
});

test("book a brand-new pet with no contact details at all", async ({ page }, testInfo) => {
  const day = futureSunday(WEEKS_NO_CLIENT[testInfo.project.name] ?? 17);
  const start = `${String(9 + testInfo.retry * 4).padStart(2, "0")}:00`;
  const end = `${String(11 + testInfo.retry * 4).padStart(2, "0")}:00`;
  const name = `Naujokas${Date.now().toString().slice(-6)}`;
  await login(page, `/calendar?date=${day}`);
  await page.getByRole("button", { name: `Registruoti: Meistrė A, ${start}` }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByPlaceholder("Augintinis, klientas ar telefonas").fill(name);
  await sheet.getByRole("button", { name: "Naujas augintinis" }).click();
  await expect(sheet.getByLabel("Augintinio vardas")).toHaveValue(name);
  await sheet.getByLabel("Paslauga").selectOption({ label: "Pilnas kirpimas" });
  await sheet.getByRole("button", { name: "Išsaugoti" }).click();
  await expect(page.getByText("Registracija išsaugota").first()).toBeVisible();
  // a family without contact: the card shows the pet only, not its name twice
  await expect(page.getByRole("button", { name: `${start}–${end}, ${name}` })).toBeVisible();
});

test("add a household of three pets in one go", async ({ page }) => {
  const tag = Date.now().toString().slice(-5);
  const names = [`Bim${tag}`, `Bom${tag}`, `Bum${tag}`];
  await login(page, "/clients");
  await page.getByRole("button", { name: "Naujas augintinis" }).first().click();
  const sheet = page.getByRole("dialog");
  // type, Enter, type, Enter, type — a new row each time
  await sheet.getByLabel("Augintinio 1 vardas").fill(names[0]);
  await sheet.getByLabel("Augintinio 1 vardas").press("Enter");
  await expect(sheet.getByLabel("Augintinio 2 vardas")).toBeFocused();
  await sheet.getByLabel("Augintinio 2 vardas").fill(names[1]);
  await sheet.getByLabel("Augintinio 2 vardas").press("Enter");
  await sheet.getByLabel("Augintinio 3 vardas").fill(names[2]);
  await sheet
    .getByRole("group", { name: "Augintinio 3 rūšis" })
    .getByRole("button", { name: "Katė" })
    .click();
  await expect(
    sheet.getByText(`Visi bus vieno kliento augintiniai: ${names.join(", ")}.`, { exact: false }),
  ).toBeVisible();
  await sheet.getByRole("button", { name: "Išsaugoti (3)" }).click();

  // no contact: kept together as one family card named after them
  await expect(page).toHaveURL(/\/clients\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1, name: names.join(", ") })).toBeVisible();
  for (const n of names) await expect(page.getByRole("heading", { level: 3, name: n })).toBeVisible();
});

// One service for several pets, remembered on the family (owner feedback 2026-10-16)
const SHARED: Record<string, { client: string; pets: [string, string]; weeks: number }> = {
  mobile: { client: "Tomas Paulauskas", pets: ["Lūna", "Ronis"], weeks: 18 },
  tablet: { client: "Lukas Stankevičius", pets: ["Džeris", "Sniegė"], weeks: 19 },
  desktop: { client: "Mantas Žukauskas", pets: ["Bruklinas", "Lė"], weeks: 20 },
};

test("one shared service for two pets: family price, one line, split per pet", async ({ page }, testInfo) => {
  const f = SHARED[testInfo.project.name] ?? SHARED.desktop;
  const day = futureSunday(f.weeks);
  const start = `${String(9 + testInfo.retry * 4).padStart(2, "0")}:00`;
  const end = `${String(11 + testInfo.retry * 4).padStart(2, "0")}:00`;

  // 1. the family's usual shared service: bath for both, 2 h, 50 €
  await login(page, "/clients?view=owners");
  await page.getByLabel("Ieškoti kliento").fill(f.client);
  await page
    .getByRole("link", { name: new RegExp(f.client) })
    .first()
    .click();
  const family = page.getByRole("region", { name: "Kliento paslaugos" });
  const existing = family.getByRole("button", { name: "Redaguoti Maudymas ir džiovinimas" });
  if (await existing.count()) await existing.click();
  else await family.getByRole("button", { name: "Pridėti kliento paslaugą" }).first().click();
  const sheet = page.getByRole("dialog");
  if (!(await existing.count()))
    await sheet.getByLabel("Paslauga").selectOption({ label: "Maudymas ir džiovinimas" });
  await sheet.getByLabel("Bendra trukmė").selectOption("120");
  await sheet.getByLabel("Bendra kaina, €").fill("50");
  await sheet.getByRole("button", { name: "Išsaugoti" }).click();
  await expect(family.getByText(/2 val\. · 50,00 €/)).toBeVisible();

  // 1b. "Registruoti vizitą" on the client page starts with the client's shared service
  await page.getByRole("link", { name: "Registruoti vizitą" }).click();
  await expect(sheet.getByText("Bendra paslauga")).toBeVisible();
  await expect(sheet.getByLabel("Bendra kaina, €")).toHaveValue("50,00");
  await expect(sheet.getByText("Kliento kaina")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();

  // 2. "Kartu" fills one shared row with the family price
  await page.goto(`/calendar?date=${day}`);
  await page.getByRole("button", { name: `Registruoti: Meistrė A, ${start}` }).click();
  await sheet.getByPlaceholder("Augintinis, klientas ar telefonas").fill(f.client);
  await sheet
    .getByRole("button", { name: `Pasirinkti visus kartu: ${f.pets.join(", ")} (${f.client})` })
    .click();
  await expect(sheet.getByText("Bendra paslauga")).toBeVisible();
  await expect(sheet.getByLabel("Bendra kaina, €")).toHaveValue("50,00");
  await expect(sheet.getByText("Kliento kaina")).toBeVisible();
  await expect(sheet.getByLabel("Visa trukmė")).toHaveValue("120");
  await sheet.getByRole("button", { name: "Išsaugoti" }).click();
  await expect(page.getByText("Registracija išsaugota").first()).toBeVisible();

  // 3. shown as one line: both pets, one service, 50 €
  await page.getByRole("button", { name: `${start}–${end}, ${f.pets.join(", ")}, ${f.client}` }).click();
  const detail = page.getByRole("dialog");
  await expect(detail.getByText(/Maudymas ir džiovinimas · 2 val\. · bendra paslauga/)).toBeVisible();
  await expect(detail.getByText("50,00 €")).toBeVisible();
});
