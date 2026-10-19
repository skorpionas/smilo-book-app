import { NextResponse, type NextRequest } from "next/server";
import { uuid } from "@/lib/schemas/common";
import { createClient } from "@/lib/supabase/server";
import { todayInVilnius } from "@/lib/time";

/**
 * GET /api/export?clientId=… — everything stored about one client as a JSON file
 * (GDPR access / portability request, requirements §15). Runs as the logged-in owner
 * under RLS; nothing is cached and nothing personal goes into logs or the file name.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const clientId = request.nextUrl.searchParams.get("clientId");
  if (!uuid.safeParse(clientId).success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const [client, pets, familyServices, bookings] = await Promise.all([
    supabase
      .from("clients")
      .select("id, full_name, phone_e164, email, notes, created_at, updated_at, archived_at, anonymized_at")
      .eq("id", clientId!)
      .maybeSingle(),
    supabase
      .from("pets")
      .select(
        "id, name, species, breed, size, weight_kg, birth_year, birth_month, notes, created_at, archived_at, pet_services(duration_min, price, services(name))",
      )
      .eq("client_id", clientId!)
      .order("name"),
    supabase
      .from("client_services")
      .select("duration_min, price, services(name)")
      .eq("client_id", clientId!)
      .order("position"),
    supabase
      .from("bookings")
      .select(
        "id, start_at, end_at, status, notes, cancelled_at, completed_at, groomers(name), booking_items(position, duration_min, planned_price, actual_price, visit_notes, pets(name), services(name))",
      )
      .eq("client_id", clientId!)
      .eq("kind", "booking")
      .order("start_at"),
  ]);

  const failed = [client, pets, familyServices, bookings].find((r) => r.error);
  if (failed) {
    console.error("[route] export failed", { code: failed.error?.code });
    return NextResponse.json({ error: "unknown" }, { status: 500 });
  }
  if (!client.data) return NextResponse.json({ error: "notFound" }, { status: 404 });

  const body = {
    exportedAt: new Date().toISOString(),
    client: client.data,
    pets: (pets.data ?? []).map(({ pet_services, ...pet }) => ({
      ...pet,
      services: pet_services.map((s) => ({
        service: s.services?.name ?? null,
        durationMin: s.duration_min,
        price: Number(s.price),
      })),
    })),
    clientServices: (familyServices.data ?? []).map((s) => ({
      service: s.services?.name ?? null,
      durationMin: s.duration_min,
      price: Number(s.price),
    })),
    visits: (bookings.data ?? []).map(({ groomers, booking_items, ...b }) => ({
      ...b,
      groomer: groomers?.name ?? null,
      items: [...booking_items]
        .sort((x, y) => x.position - y.position)
        .map((i) => ({
          pet: i.pets?.name ?? null,
          service: i.services?.name ?? null,
          durationMin: i.duration_min,
          plannedPrice: Number(i.planned_price),
          actualPrice: i.actual_price === null ? null : Number(i.actual_price),
          visitNotes: i.visit_notes,
        })),
    })),
  };

  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="smilo-klientas-${todayInVilnius()}.json"`,
      "Cache-Control": "no-store, private",
    },
  });
}
