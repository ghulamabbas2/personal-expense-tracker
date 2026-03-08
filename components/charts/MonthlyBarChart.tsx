"use client"

import { Bar } from "react-chartjs-2"
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  type ChartOptions,
} from "chart.js"
import { useMemo } from "react"
import { useTheme } from "next-themes"
import { getChartColors } from "@/lib/chartColors"
import type { MonthlyTrend } from "@/app/(dashboard)/page"

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend)

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function MonthlyBarChart({ data }: { data: MonthlyTrend[] }) {
  const { resolvedTheme } = useTheme()
  const colors = useMemo(
    () => getChartColors((resolvedTheme as "light" | "dark") ?? "light"),
    [resolvedTheme]
  )

  const chartData = useMemo(
    () => ({
      labels: data.map((d) => d.month),
      datasets: [
        {
          label: "Income",
          data: data.map((d) => d.income),
          backgroundColor: colors.success,
          borderRadius: 5,
          borderSkipped: false as const,
        },
        {
          label: "Expenses",
          data: data.map((d) => d.expenses),
          backgroundColor: colors.danger,
          borderRadius: 5,
          borderSkipped: false as const,
        },
      ],
    }),
    [data, colors]
  )

  const options = useMemo<ChartOptions<"bar">>(
    () => ({
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          position: "top",
          align: "end",
          labels: {
            color: colors.tickLabel,
            usePointStyle: true,
            pointStyleWidth: 8,
            font: { size: 12 },
          },
        },
        tooltip: {
          backgroundColor: colors.tooltipBg,
          borderColor: colors.tooltipBorder,
          borderWidth: 1,
          titleColor: colors.tooltipText,
          bodyColor: colors.tooltipText,
          callbacks: {
            label: (ctx) =>
              `  ${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y ?? 0)}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: colors.tickLabel },
          border: { display: false },
        },
        y: {
          grid: { color: colors.gridLine },
          ticks: {
            color: colors.tickLabel,
            callback: (val) => (val !== null ? `$${val}` : ""),
          },
          border: { display: false },
        },
      },
    }),
    [colors]
  )

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-72 gap-2">
        <p className="text-default-400 text-sm">No data available</p>
        <p className="text-default-300 text-xs">
          Add expenses to see your monthly trend
        </p>
      </div>
    )
  }

  return (
    <div
      className="w-full h-72"
      role="img"
      aria-label="Monthly income and expenses bar chart"
    >
      <Bar id="monthly-bar" data={chartData} options={options} />
    </div>
  )
}
