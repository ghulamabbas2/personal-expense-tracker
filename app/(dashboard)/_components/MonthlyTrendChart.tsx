"use client"

import dynamic from "next/dynamic"
import { Card, CardHeader, CardBody, Spinner } from "@heroui/react"
import type { MonthlyTrend } from "../page"

const MonthlyBarChart = dynamic(
  () =>
    import("@/components/charts/MonthlyBarChart").then(
      (m) => m.MonthlyBarChart
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-72">
        <Spinner size="lg" color="primary" />
      </div>
    ),
  }
)

export function MonthlyTrendChart({ data }: { data: MonthlyTrend[] }) {
  return (
    <Card shadow="sm">
      <CardHeader>
        <span className="font-semibold text-base">
          Income vs Expenses — Last 6 Months
        </span>
      </CardHeader>
      <CardBody className="pt-0">
        <MonthlyBarChart data={data} />
      </CardBody>
    </Card>
  )
}
