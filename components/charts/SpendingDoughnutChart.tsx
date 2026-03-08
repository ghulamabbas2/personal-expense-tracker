"use client"

import { Doughnut } from "react-chartjs-2"
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  type ChartOptions,
  type Plugin,
} from "chart.js"
import { useMemo } from "react"
import { useTheme } from "next-themes"
import { getChartColors } from "@/lib/chartColors"
import type { CategorySpend } from "@/app/(dashboard)/page"

ChartJS.register(ArcElement, Tooltip, Legend)

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function SpendingDoughnutChart({
  data,
}: {
  data: CategorySpend[]
}) {
  const { resolvedTheme } = useTheme()
  const colors = useMemo(
    () => getChartColors((resolvedTheme as "light" | "dark") ?? "light"),
    [resolvedTheme]
  )

  const total = useMemo(
    () => data.reduce((sum, d) => sum + d.total, 0),
    [data]
  )

  const centerTextPlugin = useMemo<Plugin<"doughnut">>(
    () => ({
      id: "centerText",
      beforeDraw(chart) {
        const {
          ctx,
          chartArea: { top, right, bottom, left },
        } = chart
        const cx = (left + right) / 2
        const cy = (top + bottom) / 2
        ctx.save()
        ctx.font = "bold 18px inherit"
        ctx.fillStyle = colors.tooltipText
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        ctx.fillText(formatCurrency(total), cx, cy - 8)
        ctx.font = "12px inherit"
        ctx.fillStyle = colors.tickLabel
        ctx.fillText("This month", cx, cy + 14)
        ctx.restore()
      },
    }),
    [colors, total]
  )

  const chartData = useMemo(
    () => ({
      labels: data.map((d) => d.category),
      datasets: [
        {
          data: data.map((d) => d.total),
          backgroundColor: data.map(
            (d) => colors.categories[d.category] ?? colors.primary
          ),
          borderWidth: 0,
          hoverOffset: 6,
        },
      ],
    }),
    [data, colors]
  )

  const options = useMemo<ChartOptions<"doughnut">>(
    () => ({
      maintainAspectRatio: false,
      cutout: "70%",
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            color: colors.tickLabel,
            padding: 14,
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
              `  ${ctx.label}: ${formatCurrency(ctx.parsed)}`,
          },
        },
      },
    }),
    [colors]
  )

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-2">
        <p className="text-default-400 text-sm">No expenses this month</p>
        <p className="text-default-300 text-xs">
          Add expenses to see your breakdown
        </p>
      </div>
    )
  }

  return (
    <div
      className="w-full h-64"
      role="img"
      aria-label="Spending by category doughnut chart"
    >
      <Doughnut
        id="spending-doughnut"
        data={chartData}
        options={options}
        plugins={[centerTextPlugin]}
      />
    </div>
  )
}
