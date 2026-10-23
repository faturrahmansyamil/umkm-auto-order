"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ email: z.email(), password: z.string().min(6).max(128) });

export async function login(_: string | null, fd: FormData): Promise<string | null> {
  const parsed = schema.safeParse({ email: fd.get("email"), password: fd.get("password") });
  if (!parsed.success) return "Email atau password tidak valid";
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return "Email atau password salah"; // pesan generik
  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
