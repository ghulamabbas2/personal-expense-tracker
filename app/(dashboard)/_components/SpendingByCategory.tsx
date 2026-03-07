"use client"

import { Card, CardHeader, CardBody, Progress } from "@heroui/react"
import type { CategorySpend } from "../page"

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

function displayName(name: string) {
  return name.charAt(0).toUpperCase() + name.slice(1)
}

export function SpendingByCategory({
  categorySpend,
}: {
  categorySpend: CategorySpend[]
}) {
  const topTotal = categorySpend[0]?.total ?? 0

  return (
    <Card shadow="sm">
      <CardHeader>
        <span className="font-semibold text-base">Spending by Category</span>
      </CardHeader>
      <CardBody className="pt-0 gap-4">
        {categorySpend.length === 0 ? (
          <p className="text-default-400 text-sm text-center py-6">
            No expenses recorded this month.
          </p>
        ) : (
          categorySpend.map((item) => (
            <div key={item.category} className="flex flex-col gap-1">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">
                  {displayName(item.category)}
                </span>
                <span className="text-sm text-default-500">
                  {formatCurrency(item.total)}
                </span>
              </div>
              <Progress
                aria-label={`${displayName(item.category)} spending`}
                value={(item.total / topTotal) * 100}
                color="primary"
                size="sm"
              />
            </div>
          ))
        )}
      </CardBody>
    </Card>
  )
}
