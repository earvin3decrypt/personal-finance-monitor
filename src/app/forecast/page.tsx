import type { Metadata } from "next";
import { unstable_noStore as noStore } from "next/cache";
import { ForecastView } from "@/components/forecast-view";
import { getForecast } from "@/lib/forecast";

export const metadata: Metadata = {
  title: "Forecast | Personal Finance Monitor",
  description: "Project your net worth based on recurring monthly cashflow",
};

export default async function ForecastPage() {
  noStore();
  const forecast = await getForecast(60);

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Forecast</h1>
        <p className="mt-1 text-muted-foreground">
          Project your net worth based on recurring monthly income and expenses
        </p>
      </header>

      <ForecastView data={forecast} />
    </div>
  );
}
