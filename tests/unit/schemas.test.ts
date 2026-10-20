import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  blockSchema,
  bookingSchema,
  completeVisitSchema,
  rescheduleSchema,
  updateBookingSchema,
  sumDurations,
} from "@/lib/schemas/booking";
import { issuesToFieldErrors } from "@/lib/schemas/common";
import { clientSchema, groomerSchema, petSchema, serviceSchema } from "@/lib/schemas/entities";
import lt from "@/messages/lt.json";

const ID = "0c000000-0000-4000-8000-000000000001";
const ID2 = "0d000000-0000-4000-8000-000000000001";
const SVC = "0f000000-0000-4000-8000-000000000001";

function errors(result: { success: boolean; error?: { issues: Parameters<typeof issuesToFieldErrors>[0] } }) {
  return result.success ? {} : issuesToFieldErrors(result.error!.issues);
}

describe("serviceSchema", () => {
  it("parses form strings", () => {
    const r = serviceSchema.parse({
      name: " Pilnas kirpimas ",
      defaultDurationMin: "120",
      defaultPrice: "40,50",
    });
    expect(r).toEqual({
      id: undefined,
      name: "Pilnas kirpimas",
      defaultDurationMin: 120,
      defaultPrice: 40.5,
    });
  });

  it("treats an empty id as a new row", () => {
    expect(
      serviceSchema.parse({ id: "", name: "A", defaultDurationMin: 15, defaultPrice: 0 }).id,
    ).toBeUndefined();
  });

  it.each([
    [{ name: "", defaultDurationMin: "120", defaultPrice: "40" }, "name", "required"],
    [{ name: "x".repeat(81), defaultDurationMin: "120", defaultPrice: "40" }, "name", "tooLong"],
    [{ name: "A", defaultDurationMin: "100", defaultPrice: "40" }, "defaultDurationMin", "invalidDuration"],
    [{ name: "A", defaultDurationMin: "615", defaultPrice: "40" }, "defaultDurationMin", "invalidDuration"],
    [{ name: "A", defaultDurationMin: "60", defaultPrice: "-1" }, "defaultPrice", "invalidPrice"],
    [{ name: "A", defaultDurationMin: "60", defaultPrice: "10000" }, "defaultPrice", "invalidPrice"],
    [{ name: "A", defaultDurationMin: "60", defaultPrice: "abc" }, "defaultPrice", "invalidPrice"],
    [{ id: "nope", name: "A", defaultDurationMin: "60", defaultPrice: "1" }, "id", "invalid"],
  ])("rejects %j", (input, field, key) => {
    expect(errors(serviceSchema.safeParse(input))[field]).toBe(key);
  });

  it("rejects a missing name (null from FormData)", () => {
    expect(
      errors(serviceSchema.safeParse({ name: null, defaultDurationMin: 60, defaultPrice: 1 })).name,
    ).toBe("required");
  });
});

describe("groomerSchema", () => {
  it("lower-cases the colour and reads the checkbox", () => {
    expect(
      groomerSchema.parse({ name: "Rasa", color: "#0D9488", isActive: "on", workDays: "1,2,3,4,5,6" }),
    ).toMatchObject({
      color: "#0d9488",
      isActive: true,
      workDays: [1, 2, 3, 4, 5, 6],
    });
    expect(groomerSchema.parse({ name: "Rasa", color: "#0d9488", workDays: "1" }).isActive).toBe(false);
  });

  it("normalises working days and requires at least one", () => {
    expect(groomerSchema.parse({ name: "Rasa", color: "#0d9488", workDays: "5, 1,3,1" }).workDays).toEqual([
      1, 3, 5,
    ]);
    expect(errors(groomerSchema.safeParse({ name: "Rasa", color: "#0d9488", workDays: "" }))).toEqual({
      workDays: "workDaysRequired",
    });
    expect(errors(groomerSchema.safeParse({ name: "Rasa", color: "#0d9488" }))).toEqual({
      workDays: "workDaysRequired",
    });
    expect(errors(groomerSchema.safeParse({ name: "Rasa", color: "#0d9488", workDays: "0,8" }))).toEqual({
      workDays: "invalid",
    });
    expect(errors(groomerSchema.safeParse({ name: "Rasa", color: "#0d9488", workDays: "1,x" }))).toEqual({
      workDays: "invalid",
    });
  });

  it("rejects a bad colour", () => {
    expect(errors(groomerSchema.safeParse({ name: "Rasa", color: "teal" })).color).toBe("invalidColor");
  });
});

describe("clientSchema", () => {
  it("normalises phone and e-mail, empties to null", () => {
    expect(
      clientSchema.parse({
        fullName: "Rasa Petrauskienė",
        phone: "8 612 34567",
        email: " Rasa@Example.LT ",
        notes: "",
      }),
    ).toMatchObject({ phone: "+37061234567", email: "rasa@example.lt" });
    expect(clientSchema.parse({ fullName: "Ra", phone: "", email: "", notes: "" })).toMatchObject({
      phone: null,
      email: null,
    });
  });

  it.each([
    [{ fullName: "Rasa", phone: "123", email: "" }, "phone", "invalidPhone"],
    [{ fullName: "Rasa", phone: "", email: "rasa@" }, "email", "invalidEmail"],
  ])("rejects %j", (input, field, key) => {
    expect(errors(clientSchema.safeParse(input))[field]).toBe(key);
  });

  it("a family may have no contact at all", () => {
    expect(clientSchema.parse({ fullName: "", phone: "", email: "", notes: "" })).toMatchObject({
      fullName: null,
      phone: null,
      email: null,
    });
  });

  it("accepts a contact card with only a phone or only an e-mail (pet first)", () => {
    expect(clientSchema.parse({ fullName: "", phone: "861234567", email: "", notes: "" })).toMatchObject({
      fullName: null,
      phone: "+37061234567",
    });
    expect(clientSchema.parse({ fullName: "", phone: "", email: "a@b.lt", notes: "" })).toMatchObject({
      fullName: null,
      email: "a@b.lt",
    });
  });
});

describe("petSchema owner", () => {
  it("a pet needs no owner", () => {
    const r = petSchema.parse({
      name: "Rudis",
      species: "dog",
      breed: "",
      size: "",
      weightKg: "",
      birthYear: "",
      birthMonth: "",
      notes: "",
    });
    expect(r.clientId).toBeUndefined();
    expect(r.ownerName).toBeNull();
    expect(r.ownerPhone).toBeNull();
  });
});

describe("petSchema", () => {
  const base = {
    clientId: ID,
    name: "Maksas",
    species: "dog",
    breed: "",
    size: "",
    weightKg: "",
    birthYear: "",
    birthMonth: "",
    notes: "",
  };

  it("parses optional fields as null", () => {
    expect(petSchema.parse(base)).toMatchObject({
      size: null,
      weightKg: null,
      birthYear: null,
      birthMonth: null,
    });
  });

  it("parses weight with a comma and a birth year with optional month", () => {
    expect(
      petSchema.parse({ ...base, weightKg: "7,55", birthYear: "2020", birthMonth: "3", size: "m" }),
    ).toMatchObject({
      weightKg: 7.6,
      birthYear: 2020,
      birthMonth: 3,
      size: "m",
    });
    expect(petSchema.parse({ ...base, birthYear: "2020" })).toMatchObject({
      birthYear: 2020,
      birthMonth: null,
    });
  });

  it.each([
    [{ species: "rabbit" }, "species", "required"],
    [{ weightKg: "0,2" }, "weightKg", "invalidWeight"],
    [{ weightKg: "abc" }, "weightKg", "invalidWeight"],
    [{ birthYear: "2999" }, "birthYear", "futureDate"],
    [{ birthYear: "1980" }, "birthYear", "invalid"],
    [{ birthYear: "abc" }, "birthYear", "invalid"],
    [{ birthMonth: "5" }, "birthYear", "required"],
    [{ birthYear: "2020", birthMonth: "13" }, "birthMonth", "invalid"],
    [{ birthYear: String(new Date().getFullYear() + 1), birthMonth: "1" }, "birthYear", "futureDate"],
    [{ size: "huge" }, "size", "invalid"],
    [{ clientId: "x" }, "clientId", "invalid"],
  ])("rejects %j", (patch, field, key) => {
    expect(errors(petSchema.safeParse({ ...base, ...patch }))[field]).toBe(key);
  });
});

describe("bookingSchema", () => {
  // "Today" in Vilnius is 2026-10-15 for these tests (no bookings on past days).
  beforeAll(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-15T20:30:00Z")); // 23:30 in Vilnius
  });
  afterAll(() => vi.useRealTimers());

  const valid = {
    groomerId: ID,
    date: "2026-10-20",
    startTime: "10:00",
    durationMin: 120,
    client: { mode: "existing", id: ID },
    items: [{ pet: { mode: "existing", id: ID2 }, serviceId: SVC, durationMin: 120, plannedPrice: "45" }],
    notes: "",
  } as const;

  it("accepts today, even an earlier hour", () => {
    expect(bookingSchema.safeParse({ ...valid, date: "2026-10-15", startTime: "08:00" }).success).toBe(true);
  });

  it("validates a reschedule the same way", () => {
    const move = { id: ID, groomerId: ID, date: "2026-10-15", startTime: "09:00", durationMin: 90 };
    expect(rescheduleSchema.parse(move)).toEqual({ ...move, allowOverlap: false });
    expect(rescheduleSchema.parse({ ...move, allowOverlap: true }).allowOverlap).toBe(true);
    expect(errors(rescheduleSchema.safeParse({ ...move, date: "2026-10-01" }))).toEqual({ date: "pastDate" });
    expect(errors(rescheduleSchema.safeParse({ ...move, startTime: "09:05" }))).toEqual({
      startTime: "offGrid",
    });
  });

  it("accepts an existing client with one pet", () => {
    const r = bookingSchema.parse(valid);
    expect(r.items[0].plannedPrice).toBe(45);
  });

  it("accepts a booking with no client at all (pet first)", () => {
    const r = bookingSchema.parse({
      ...valid,
      client: { mode: "none" },
      items: [
        {
          pet: { mode: "new", name: "Rudis", species: "dog", breed: "" },
          serviceId: SVC,
          durationMin: 60,
          plannedPrice: 30,
        },
      ],
    });
    expect(r.client).toEqual({ mode: "none" });
  });

  it("a new contact needs one of name / phone / e-mail; phone alone is enough", () => {
    const base = { ...valid, items: valid.items };
    expect(
      bookingSchema.parse({ ...base, client: { mode: "new", fullName: "", phone: "861234567", email: "" } })
        .client,
    ).toMatchObject({ fullName: null, phone: "+37061234567" });
    expect(
      errors(
        bookingSchema.safeParse({ ...base, client: { mode: "new", fullName: "", phone: "", email: "" } }),
      ),
    ).toEqual({ "client.fullName": "contactRequired" });
  });

  it("accepts a new client with a new pet", () => {
    const r = bookingSchema.parse({
      ...valid,
      client: { mode: "new", fullName: "Rasa Petrauskienė", phone: "612 34567", email: "" },
      items: [
        {
          pet: { mode: "new", name: "Maksas", species: "dog", breed: "" },
          serviceId: SVC,
          durationMin: 90,
          plannedPrice: 40,
        },
      ],
    });
    expect(r.client).toEqual({
      mode: "new",
      fullName: "Rasa Petrauskienė",
      phone: "+37061234567",
      email: null,
    });
  });

  it.each([
    [{ startTime: "10:10" }, "startTime", "offGrid"],
    [{ startTime: "25:00" }, "startTime", "invalidTime"],
    [{ date: "2026-02-30" }, "date", "invalidDate"],
    [{ date: "2026-10-14" }, "date", "pastDate"],
    [{ durationMin: 20 }, "durationMin", "invalidDuration"],
    [{ client: undefined }, "client", "required"],
    [{ items: [] }, "items", "itemsRequired"],
  ])("rejects %j", (patch, field, key) => {
    expect(errors(bookingSchema.safeParse({ ...valid, ...patch }))[field]).toBe(key);
  });

  it("reports item errors by index", () => {
    const e = errors(
      bookingSchema.safeParse({
        ...valid,
        items: [
          valid.items[0],
          {
            pet: { mode: "new", name: "", species: "cat", breed: "" },
            serviceId: "",
            durationMin: 120,
            plannedPrice: "x",
          },
        ],
      }),
    );
    expect(e["items.1.pet.name"]).toBe("required");
    expect(e["items.1.serviceId"]).toBe("required");
    expect(e["items.1.plannedPrice"]).toBe("invalidPrice");
  });

  it("rejects the same pet + service twice", () => {
    const e = errors(bookingSchema.safeParse({ ...valid, items: [valid.items[0], valid.items[0]] }));
    expect(e["items.1.serviceId"]).toBe("invalid");
  });

  it("sums item durations", () => {
    expect(sumDurations([{ durationMin: 90 }, { durationMin: 60 }])).toBe(150);
  });
});

describe("error keys", () => {
  it("every schema error key has a Lithuanian message", () => {
    const keys = [
      "required",
      "tooLong",
      "invalidPhone",
      "invalidEmail",
      "invalidDate",
      "invalidTime",
      "offGrid",
      "invalidDuration",
      "invalidPrice",
      "invalidWeight",
      "futureDate",
      "invalidColor",
      "itemsRequired",
      "invalid",
    ];
    for (const k of keys) expect(lt.errors).toHaveProperty(k);
  });

  it("unknown messages fall back to 'invalid' and the first issue per field wins", () => {
    expect(
      issuesToFieldErrors([
        { code: "custom", message: "something else", path: ["a"], input: 1 },
        { code: "custom", message: "required", path: ["a"], input: 1 },
        { code: "custom", message: "required", path: [], input: 1 },
      ]),
    ).toEqual({ a: "invalid", _form: "required" });
  });
});

describe("completeVisitSchema (US-11)", () => {
  const id = "0e000000-0000-4000-8000-000000000001";
  const item = "0f000000-0000-4000-8000-000000000001";

  it("needs an actual price when the visit took place", () => {
    const r = completeVisitSchema.safeParse({
      id,
      status: "completed",
      items: [{ id: item, visitNotes: "" }],
    });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path).toEqual(["items", 0, "actualPrice"]);
  });

  it("accepts a Lithuanian price and trims notes", () => {
    const r = completeVisitSchema.parse({
      id,
      status: "completed",
      items: [{ id: item, actualPrice: "45,50", visitNotes: "  Kailis susivėlęs " }],
    });
    expect(r.items[0]).toEqual({ id: item, actualPrice: 45.5, visitNotes: "Kailis susivėlęs" });
  });

  it("no-show needs no price", () => {
    expect(
      completeVisitSchema.safeParse({ id, status: "no_show", items: [{ id: item, visitNotes: "" }] }).success,
    ).toBe(true);
  });

  it("only visit results are allowed", () => {
    expect(completeVisitSchema.safeParse({ id, status: "scheduled", items: [] }).success).toBe(false);
  });
});

describe("blockSchema (US-16)", () => {
  beforeAll(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-15T07:00:00Z"));
  });
  afterAll(() => vi.useRealTimers());

  const block = {
    groomerIds: [ID],
    date: "2026-10-16",
    startTime: "12:00",
    endTime: "13:00",
    reason: " Pietūs ",
  };

  it("accepts one or both groomers and trims the reason", () => {
    expect(blockSchema.parse(block).reason).toBe("Pietūs");
    expect(blockSchema.parse({ ...block, groomerIds: [ID, ID2] }).groomerIds).toHaveLength(2);
  });

  it("needs a groomer, an end after the start and a day that is not past", () => {
    expect(errors(blockSchema.safeParse({ ...block, groomerIds: [] }))).toEqual({ groomerIds: "required" });
    expect(errors(blockSchema.safeParse({ ...block, endTime: "12:00" }))).toEqual({
      endTime: "endBeforeStart",
    });
    expect(errors(blockSchema.safeParse({ ...block, date: "2026-10-14" }))).toEqual({ date: "pastDate" });
    expect(errors(blockSchema.safeParse({ ...block, startTime: "12:10" }))).toEqual({ startTime: "offGrid" });
    expect(blockSchema.safeParse({ ...block, groomerIds: [ID, ID] }).success).toBe(false);
  });

  it("takes a period: the last day defaults to the first", () => {
    expect(blockSchema.parse(block).dateTo).toBe("2026-10-16");
    expect(blockSchema.parse({ ...block, dateTo: "" }).dateTo).toBe("2026-10-16");
    expect(blockSchema.parse({ ...block, dateTo: "2026-10-26" }).dateTo).toBe("2026-10-26");
  });

  it("rejects a period that ends before it starts or is longer than 62 days", () => {
    expect(errors(blockSchema.safeParse({ ...block, dateTo: "2026-10-15" }))).toEqual({
      dateTo: "dateToBeforeFrom",
    });
    expect(blockSchema.safeParse({ ...block, dateTo: "2026-12-16" }).success).toBe(true); // 62 days
    expect(errors(blockSchema.safeParse({ ...block, dateTo: "2026-12-17" }))).toEqual({
      dateTo: "periodTooLong",
    });
    expect(errors(blockSchema.safeParse({ ...block, dateTo: "2026-13-01" }))).toEqual({
      dateTo: "invalidDate",
    });
  });
});

describe("updateBookingSchema (change a visit's services)", () => {
  const change = {
    id: ID,
    groomerId: ID2,
    // a completed visit keeps its (past) date: the action allows it when unchanged
    date: "2026-10-01",
    startTime: "10:00",
    durationMin: 120,
    items: [
      {
        pet: { mode: "existing", id: ID },
        serviceId: SVC,
        durationMin: 60,
        plannedPrice: "35",
        sharedGroup: 1,
      },
      {
        pet: { mode: "existing", id: ID2 },
        serviceId: SVC,
        durationMin: 60,
        plannedPrice: "35",
        sharedGroup: 1,
      },
    ],
    notes: "",
  };

  it("accepts a family (shared) change, past dates included", () => {
    const r = updateBookingSchema.parse(change);
    expect(r.items.map((i) => i.plannedPrice)).toEqual([35, 35]);
    expect(r.rememberFamily).toEqual([]);
  });

  it("needs at least one pet and no duplicate pet + service", () => {
    expect(errors(updateBookingSchema.safeParse({ ...change, items: [] }))).toEqual({
      items: "itemsRequired",
    });
    expect(
      errors(updateBookingSchema.safeParse({ ...change, items: [change.items[0], change.items[0]] })),
    ).toEqual({ "items.1.serviceId": "invalid" });
  });
});
