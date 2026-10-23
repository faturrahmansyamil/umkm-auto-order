"use client";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export default function RevenueChart({ data }: { data: { date: string; omzet: number }[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(5)} />
          <YAxis />
          <Tooltip />
          <Bar dataKey="omzet" fill="#16a34a" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
