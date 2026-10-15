"use server";

import { requireUser } from "@/lib/auth";
import { formatPhone } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";

export type SearchHit = {
  kind: "client" | "pet";
  id: string;
  clientId: string;
  title: string;
  subtitle: string;
};

/** US-14: clients and pets by accent-free name or phone digits. A POST, so the query never lands in a URL. */
export async function searchDirectory(query: string): Promise<SearchHit[]> {
  await requireUser();
  const q = String(query ?? "")
    .trim()
    .slice(0, 100);
  if (q.length < 2) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_directory", { p_query: q, p_limit: 20 });
  if (error) {
    console.error("[action] searchDirectory failed", { code: error.code });
    return [];
  }
  return data.map((r) => ({
    kind: r.kind === "pet" ? "pet" : "client",
    id: r.id,
    clientId: r.client_id,
    title: r.title,
    subtitle: r.kind === "pet" ? r.subtitle : formatPhone(r.subtitle),
  }));
}
