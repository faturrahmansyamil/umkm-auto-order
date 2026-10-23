"use client";
import { useActionState } from "react";
import { login } from "./actions";

export default function LoginPage() {
  const [error, action, pending] = useActionState(login, null);
  return (
    <main className="mx-auto w-full max-w-sm p-6">
      <h1 className="mb-4 text-2xl font-bold">Login Penjual</h1>
      <form action={action} className="grid gap-3">
        <input name="email" type="email" required placeholder="Email" className="rounded border p-2" />
        <input name="password" type="password" required placeholder="Password" className="rounded border p-2" />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button disabled={pending} className="rounded bg-black py-2 text-white disabled:opacity-50">Masuk</button>
      </form>
    </main>
  );
}
