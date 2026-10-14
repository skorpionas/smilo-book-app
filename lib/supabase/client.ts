import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

/** Browser client (Client Components). Reads stay server-side where possible. */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
