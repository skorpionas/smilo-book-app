import { expect, test, type Page } from "@playwright/test";

// Week 2 flows against the seeded local stack (supabase/seed.sql).
const OWNER = { email: "owner@smilo.local", password: "smilo-dev-password" };

/**
 * A Sunday `weeks` weeks after the coming one (YYYY-MM-DD). Sundays have no seeded bookings and
 * only Meistrė A works then; bookings must be today or later, so dates are relative to now.
 */
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

test("settings lists the seeded services and both groomers", async ({ page }) => {
  await login(page, "/settings");
  await expect(page.getByRole("heading", { name: "Paslaugos" })).toBeVisible();
  await expect(page.getByText("Pilnas kirpimas", { exact: true })).toBeVisible();
  await expect(page.getByText("2 val. · 40,00 €")).toBeVisible();
  await expect(page.getByRole("button", { name: "Redaguoti: Meistrė A" })).toBeVisible();
});

test("add a client and a pet (issues #15, #16)", async ({ page }) => {
  const name = `Testas Klientas ${Date.now().toString().slice(-6)}`;
  await login(page, "/clients?view=owners");
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
  await petSheet.getByLabel("Augintinio 1 vardas").fill("Žuikis");
  await petSheet.getByRole("button", { name: "Katė" }).click();
  await petSheet.getByRole("button", { name: "Išsaugoti" }).click();
  await expect(page.getByRole("heading", { level: 3, name: "Žuikis" })).toBeVisible();
  // details later, on the full pet form
  await page.getByRole("button", { name: "Redaguoti Žuikis" }).click();
  await petSheet.getByLabel("Pastabos").fill("Kanda kerpant letenas");
  await petSheet.getByRole("button", { name: "Išsaugoti" }).click();
  await expect(page.getByRole("heading", { level: 3, name: "Žuikis" })).toBeVisible();
  await expect(page.getByText("Kanda kerpant letenas")).toBeVisible();

  // pet-first list: local, accent-insensitive filter finds the pet with its owner
  await page.goto("/clients");
  await page.getByLabel("Ieškoti augintinio ar kliento").fill("zuikis");
  await expect(page.getByRole("link", { name: new RegExp(`Žuikis.*${name}`) })).toBeVisible();
  // owners view still lists the client
  await page.goto("/clients?view=owners");
  await page.getByLabel("Ieškoti kliento").fill("zuikis");
  await expect(page.getByRole("link", { name: new RegExp(name) })).toBeVisible();
});

test("book an existing client, then hit the overlap rule (US-05, US-09)", async ({ page }, testInfo) => {
  // Sundays have no seeded bookings. Each project / retry gets its own day so runs never collide.
  const day = futureSunday({ mobile: 2, desktop: 3, tablet: 10 }[testInfo.project.name] ?? 3);
  const hour = 9 + testInfo.retry * 4; // 09:00, then 13:00 on a retry
  const start = `${String(hour).padStart(2, "0")}:00`;
  const end = `${String(hour + 2).padStart(2, "0")}:00`;
  const overlapStart = `${String(hour + 1).padStart(2, "0")}:00`;

  await login(page, `/calendar?date=${day}`);
  await page.getByRole("button", { name: `Registruoti: Meistrė A, ${start}` }).click();

  const sheet = page.getByRole("dialog");
  await expect(sheet.getByRole("heading", { name: "Nauja registracija" })).toBeVisible();
  await sheet.getByPlaceholder("Augintinis, klientas ar telefonas").fill("Petrausk");
  await sheet.getByRole("button", { name: "Pasirinkti Maksas (Rasa Petrauskienė)" }).click();
  await sheet.getByLabel("Augintinis", { exact: true }).selectOption({ index: 1 });
  await sheet.getByLabel("Paslauga").selectOption({ label: "Pilnas kirpimas" });
  await expect(sheet.getByLabel("Visa trukmė")).toHaveValue("120");
  await sheet.getByRole("button", { name: "Išsaugoti" }).click();

  await expect(page.getByText("Registracija išsaugota").first()).toBeVisible();
  await expect(
    page.getByRole("button", { name: new RegExp(`^${start}–${end}, .+, Rasa Petrauskienė$`) }),
  ).toBeVisible();

  // Same groomer, overlapping time → asked first, naming the visit in the way; "Ne" saves nothing.
  await page.getByRole("button", { name: `Registruoti: Meistrė A, ${end}` }).click();
  await sheet.getByLabel("Pradžia").selectOption(overlapStart);
  await sheet.getByPlaceholder("Augintinis, klientas ar telefonas").fill("Petrausk");
  await sheet.getByRole("button", { name: "Pasirinkti Maksas (Rasa Petrauskienė)" }).click();
  await sheet.getByLabel("Augintinis", { exact: true }).selectOption({ index: 1 });
  await sheet.getByLabel("Paslauga").selectOption({ label: "Pilnas kirpimas" });
  await sheet.getByRole("button", { name: "Išsaugoti" }).click();
  const ask = page.getByRole("dialog", { name: "Šis laikas jau užimtas" });
  await expect(ask.getByText(`Meistrė A tuo metu jau turi: ${start}–${end} · Maksas`)).toBeVisible();
  await ask.getByRole("button", { name: "Ne, keisti laiką" }).click();
  await expect(ask).toHaveCount(0);
  await expect(page.getByRole("button", { name: new RegExp(`^${overlapStart}–`) })).toHaveCount(0);

  // Groomer B is free at that time.
  await sheet.getByLabel("Meistrė").selectOption({ label: "Meistrė B" });
  await sheet.getByRole("button", { name: "Išsaugoti" }).click();
  await expect(page.getByText("Registracija išsaugota").first()).toBeVisible();
});

test("overlapping visits for one groomer, after confirming", async ({ page }, testInfo) => {
  const day = futureSunday({ mobile: 6, desktop: 7, tablet: 12 }[testInfo.project.name] ?? 7);
  const hour = 9 + testInfo.retry * 4;
  const start = `${String(hour).padStart(2, "0")}:00`;
  const nails = `${String(hour).padStart(2, "0")}:30`;
  const sheet = page.getByRole("dialog").first();

  await login(page, `/calendar?date=${day}`);
  await page.getByRole("button", { name: `Registruoti: Meistrė A, ${start}` }).click();
  await sheet.getByPlaceholder("Augintinis, klientas ar telefonas").fill("Petrausk");
  await sheet.getByRole("button", { name: "Pasirinkti Maksas (Rasa Petrauskienė)" }).click();
  await sheet.getByLabel("Augintinis", { exact: true }).selectOption({ index: 1 });
  await sheet.getByLabel("Paslauga").selectOption({ label: "Pilnas kirpimas" });
  await sheet.getByRole("button", { name: "Išsaugoti" }).click();
  await expect(page.getByText("Registracija išsaugota").first()).toBeVisible();

  // From the visit: "Pridėti persidengiantį vizitą" opens a new booking at its start; any overlapping time works.
  await page.getByRole("button", { name: new RegExp(`^${start}–.+, Rasa Petrauskienė$`) }).click();
  await sheet.getByRole("button", { name: "Pridėti persidengiantį vizitą" }).click();
  await expect(sheet.getByRole("heading", { name: "Nauja registracija" })).toBeVisible();
  await expect(sheet.getByLabel("Pradžia")).toHaveValue(start);
  await sheet.getByLabel("Pradžia").selectOption(nails);
  await sheet.getByPlaceholder("Augintinis, klientas ar telefonas").fill("Petrausk");
  await sheet.getByRole("button", { name: "Pasirinkti Maksas (Rasa Petrauskienė)" }).click();
  await sheet.getByLabel("Augintinis", { exact: true }).selectOption({ index: 1 });
  await sheet.getByLabel("Paslauga").selectOption({ label: "Pilnas kirpimas" });
  await sheet.getByLabel("Visa trukmė").selectOption("30");
  await sheet.getByRole("button", { name: "Išsaugoti" }).click();

  const ask = page.getByRole("dialog", { name: "Šis laikas jau užimtas" });
  await ask.getByRole("button", { name: "Taip, registruoti" }).click();
  await expect(page.getByText("Užregistruota – persidengia su kitu vizitu").first()).toBeVisible();

  // Both visits stay on the grid, side by side.
  await expect(page.getByRole("button", { name: /· Persidengia$/ })).toHaveCount(2);
});

test("change the time, cancel and delete a booking (US-10)", async ({ page }, testInfo) => {
  const day = futureSunday({ mobile: 4, desktop: 5, tablet: 11 }[testInfo.project.name] ?? 5);
  const sheet = page.getByRole("dialog").first();

  async function book(start: string) {
    await page.getByRole("button", { name: `Registruoti: Meistrė A, ${start}` }).click();
    await sheet.getByPlaceholder("Augintinis, klientas ar telefonas").fill("Petrausk");
    await sheet.getByRole("button", { name: "Pasirinkti Maksas (Rasa Petrauskienė)" }).click();
    await sheet.getByLabel("Augintinis", { exact: true }).selectOption({ index: 1 });
    await sheet.getByLabel("Paslauga").selectOption({ label: "Pilnas kirpimas" });
    await sheet.getByRole("button", { name: "Išsaugoti" }).click();
    await expect(page.getByText("Registracija išsaugota").first()).toBeVisible();
  }
  const visit = (range: string) =>
    page.getByRole("button", { name: new RegExp(`^${range}, .+, Rasa Petrauskienė$`) });

  await login(page, `/calendar?date=${day}`);
  await book("09:00");

  // Move 09:00–11:00 → 12:00, 1 h 30 min.
  await visit("09:00–11:00").click();
  await sheet.getByRole("button", { name: "Keisti datą ar laiką" }).click();
  await sheet.getByLabel("Pradžia").selectOption("12:00");
  await sheet.getByLabel("Visa trukmė").selectOption("90");
  await sheet.getByRole("button", { name: "Išsaugoti" }).click();
  await expect(page.getByText("Vizitas perkeltas").first()).toBeVisible();
  await expect(visit("12:00–13:30")).toBeVisible();
  await expect(visit("09:00–11:00")).toHaveCount(0);

  // Cancel: gone from the grid (stays in history).
  await visit("12:00–13:30").click();
  await sheet.getByRole("button", { name: "Atšaukti vizitą" }).click();
  await page
    .getByRole("dialog", { name: "Atšaukti vizitą?" })
    .getByRole("button", { name: "Atšaukti vizitą" })
    .click();
  await expect(page.getByText("Vizitas atšauktas").first()).toBeVisible();
  await expect(visit("12:00–13:30")).toHaveCount(0);

  // Delete a booking made by mistake.
  await book("15:00");
  await visit("15:00–17:00").click();
  await sheet.getByRole("button", { name: "Ištrinti" }).click();
  await page
    .getByRole("dialog", { name: "Ištrinti registraciją?" })
    .getByRole("button", { name: "Ištrinti" })
    .click();
  await expect(page.getByText("Registracija ištrinta").first()).toBeVisible();
  await expect(visit("15:00–17:00")).toHaveCount(0);
});

test("past days offer no booking slots", async ({ page }) => {
  await login(page, "/calendar?date=2026-01-05");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("2026-01-05");
  await expect(page.getByRole("button", { name: /^Registruoti: / })).toHaveCount(0);
});

test("drag a booking to another time, then confirm", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "mouse drag; touch uses long-press");
  const day = futureSunday(6);
  const sheet = page.getByRole("dialog").first();
  await login(page, `/calendar?date=${day}`);

  await page.getByRole("button", { name: "Registruoti: Meistrė A, 09:00" }).click();
  await sheet.getByPlaceholder("Augintinis, klientas ar telefonas").fill("Petrausk");
  await sheet.getByRole("button", { name: "Pasirinkti Maksas (Rasa Petrauskienė)" }).click();
  await sheet.getByLabel("Augintinis", { exact: true }).selectOption({ index: 1 });
  await sheet.getByLabel("Paslauga").selectOption({ label: "Pilnas kirpimas" });
  await sheet.getByRole("button", { name: "Išsaugoti" }).click();
  const card = page.getByRole("button", { name: /^09:00–11:00, .+, Rasa Petrauskienė$/ });
  await expect(card).toBeVisible();

  // 15 min = 1 rem = 16 px: drag 3 h down (12 rows).
  const box = (await card.boundingBox())!;
  await page.mouse.move(box.x + 20, box.y + 8);
  await page.mouse.down();
  await page.mouse.move(box.x + 25, box.y + 30, { steps: 4 });
  await page.mouse.move(box.x + 20, box.y + 8 + 12 * 16, { steps: 10 });
  await page.mouse.up();

  const confirm = page.getByRole("dialog", { name: "Perkelti vizitą?" });
  await expect(confirm).toContainText(`${day} 12:00–14:00, Meistrė A`);
  await confirm.getByRole("button", { name: "Perkelti" }).click();
  await expect(page.getByText("Vizitas perkeltas").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /^12:00–14:00, .+, Rasa Petrauskienė$/ })).toBeVisible();
});

test("a booking after 19:00 widens the day grid and is shown", async ({ page }, testInfo) => {
  const day = futureSunday({ mobile: 21, tablet: 22, desktop: 23 }[testInfo.project.name] ?? 23);
  const start = `${20 + testInfo.retry}:00`;
  const end = `${21 + testInfo.retry}:00`;
  await login(page, `/calendar?date=${day}`);
  // 08:00–19:00 by default: no 20:00 row yet
  await expect(page.getByRole("button", { name: `Registruoti: Meistrė A, ${start}` })).toHaveCount(0);

  await page.getByRole("button", { name: "Registruoti: Meistrė A, 18:00" }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByLabel("Pradžia").selectOption(start);
  await sheet.getByPlaceholder("Augintinis, klientas ar telefonas").fill("Petrausk");
  await sheet.getByRole("button", { name: "Pasirinkti Maksas (Rasa Petrauskienė)" }).click();
  await sheet.getByLabel("Augintinis", { exact: true }).selectOption({ index: 1 });
  await sheet.getByLabel("Paslauga").selectOption({ label: "Higieninis kirpimas" });
  await sheet.getByLabel("Visa trukmė").selectOption("60");
  await sheet.getByRole("button", { name: "Išsaugoti" }).click();
  await expect(page.getByText("Registracija išsaugota").first()).toBeVisible();

  // The grid now runs past 19:00 and shows the visit
  await expect(
    page.getByRole("region", { name: "Dienos tvarkaraštis" }).getByRole("button", {
      name: new RegExp(`^${start}–${end}, .+, Rasa Petrauskienė$`),
    }),
  ).toBeVisible();
});

test("correct a finished visit: price, notes, then no-show (US-11)", async ({ page }, testInfo) => {
  // A past seeded day per project (the projects share one database).
  const day =
    { mobile: "2026-10-12", tablet: "2026-10-13", desktop: "2026-10-14" }[testInfo.project.name] ??
    "2026-10-14";
  const sheet = page.getByRole("dialog").first();
  await login(page, `/calendar?date=${day}`);

  const card = page.getByRole("button", { name: /^\d{2}:\d{2}–\d{2}:\d{2}, .+, .+$/ }).first();
  const name = (await card.getAttribute("aria-label"))!;
  const same = page.getByRole("button", { name, exact: true });

  // Done, with another price and a note.
  await card.click();
  await sheet.getByRole("button", { name: "Pataisyti vizitą" }).click();
  await sheet.getByRole("radio", { name: "Įvykdyta" }).click();
  await sheet.getByLabel("Kaina, €").first().fill("77");
  await sheet
    .getByLabel(/^Pastabos po vizito/)
    .first()
    .fill("Labai ramus");
  await sheet.getByRole("button", { name: "Išsaugoti" }).click();
  await expect(page.getByText("Vizito rezultatas išsaugotas").first()).toBeVisible();

  await same.click();
  await expect(sheet).toContainText("77,00 €");
  await expect(sheet).toContainText("Labai ramus");

  // It was really a no-show.
  await sheet.getByRole("button", { name: "Pataisyti vizitą" }).click();
  await sheet.getByRole("radio", { name: "Neatvyko" }).click();
  await expect(sheet.getByLabel("Kaina, €")).toHaveCount(0);
  await sheet.getByRole("button", { name: "Išsaugoti" }).click();
  await expect(page.getByText("Vizito rezultatas išsaugotas").first()).toBeVisible();
  await same.click();
  await expect(sheet.getByText("Neatvyko").first()).toBeVisible();
});

test("change a booking's service, length and price (owner feedback 2026-10-19)", async ({
  page,
}, testInfo) => {
  const day = futureSunday({ mobile: 15, tablet: 16, desktop: 24 }[testInfo.project.name] ?? 24);
  const sheet = page.getByRole("dialog").first();
  const visit = (range: string) =>
    page.getByRole("button", { name: new RegExp(`^${range}, .+, Rasa Petrauskienė$`) });

  await login(page, `/calendar?date=${day}`);
  await page.getByRole("button", { name: "Registruoti: Meistrė A, 09:00" }).click();
  await sheet.getByPlaceholder("Augintinis, klientas ar telefonas").fill("Petrausk");
  await sheet.getByRole("button", { name: "Pasirinkti Maksas (Rasa Petrauskienė)" }).click();
  await sheet.getByLabel("Augintinis", { exact: true }).selectOption({ index: 1 });
  await sheet.getByLabel("Paslauga").selectOption({ label: "Pilnas kirpimas" });
  await sheet.getByLabel("Trukmė", { exact: true }).selectOption("120");
  await sheet.getByRole("button", { name: "Išsaugoti" }).click();
  await expect(page.getByText("Registracija išsaugota").first()).toBeVisible();

  // Pilnas kirpimas 2 h → Maudymas 1 h 30 min for 33 €: the visit gets shorter.
  await visit("09:00–11:00").click();
  await sheet.getByRole("button", { name: "Keisti paslaugas" }).click();
  await expect(sheet.getByRole("heading", { name: "Keisti vizitą" })).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Keisti", exact: true })).toHaveCount(0);
  await sheet.getByLabel("Paslauga").selectOption({ label: "Maudymas ir džiovinimas" });
  await sheet.getByLabel("Trukmė", { exact: true }).selectOption("90");
  await sheet.getByLabel("Kaina, €").fill("33");
  await sheet.getByRole("button", { name: "Išsaugoti" }).click();

  await expect(page.getByText("Vizitas pakeistas").first()).toBeVisible();
  await expect(visit("09:00–10:30")).toBeVisible();
  await expect(visit("09:00–11:00")).toHaveCount(0);
  await visit("09:00–10:30").click();
  await expect(sheet.getByText("Maudymas ir džiovinimas")).toBeVisible();
  await expect(sheet.getByText("33,00 €")).toBeVisible();

  // The message sits at the top and closes by itself.
  await expect(page.getByText("Vizitas pakeistas").first()).toBeHidden({ timeout: 8000 });
});
