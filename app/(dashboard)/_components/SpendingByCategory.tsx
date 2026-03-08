"use client"

import dynamic from "next/dynamic"
import { Card, CardHeader, CardBody, Spinner } from "@heroui/react"
import type { CategorySpend } from "../page"

const SpendingDoughnutChart = dynamic(
  () =>
    import("@/components/charts/SpendingDoughnutChart").then(
      (m) => m.SpendingDoughnutChart
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" color="primary" />
      </div>
    ),
  }
)

export function SpendingByCategory({
  categorySpend,
}: {
  categorySpend: CategorySpend[]
}) {
  return (
    <Card shadow="sm">
      <CardHeader>
        <span className="font-semibold text-base">Spending by Category</span>
      </CardHeader>
      <CardBody className="pt-0">
        <SpendingDoughnutChart data={categorySpend} />
      </CardBody>
    </Card>
  )
}
