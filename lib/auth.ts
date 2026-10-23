import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Pastikan user login & terdaftar sebagai penjual. Dipakai di layout dan setiap server action dashboard. */
export async function requireSeller() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: seller } = await supabase.from("sellers").select("id,store_name").eq("auth_user_id", user.id).maybeSingle();
  return { supabase, user, seller };
}
