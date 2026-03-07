"use client"

import { Card, CardHeader, CardBody, Chip, Progress } from "@heroui/react"
import { DollarSign, TrendingDown, Tag, PiggyBank } from "lucide-react"
import type { DashboardSummary } from "../page"

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount))
}

function displayName(name: string) {
  return name.charAt(0).toUpperCase() + name.slice(1)
}

export function SummaryCards({ summary }: { summary: DashboardSummary }) {
  const {
    totalBalance,
    monthlyExpenses,
    monthlyIncome,
    topCategory,
    topCategoryAmount,
    savingsRate,
  } = summary

  const spendingProgress =
    monthlyIncome > 0
      ? Math.min((monthlyExpenses / monthlyIncome) * 100, 100)
      : monthlyExpenses > 0
      ? 100
      : 0

  const savingsColor =
    savingsRate === null
      ? "default"
      : savingsRate >= 20
      ? "success"
      : savingsRate >= 0
      ? "warning"
      : "danger"

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total Balance */}
      <Card shadow="sm">
        <CardHeader className="flex items-center gap-2 pb-1">
          <DollarSign size={18} className="text-default-500" aria-hidden="true" />
          <span className="text-sm text-default-500 font-medium">Total Balance</span>
        </CardHeader>
        <CardBody className="pt-0 gap-2">
          <p className="text-2xl font-bold">
            {totalBalance < 0 ? "-" : ""}
            {formatCurrency(totalBalance)}
          </p>
          <Chip
            size="sm"
            variant="flat"
            color={totalBalance >= 0 ? "success" : "danger"}
          >
            {totalBalance >= 0 ? "Positive" : "Negative"}
          </Chip>
        </CardBody>
      </Card>

      {/* Monthly Spending */}
      <Card shadow="sm">
        <CardHeader className="flex items-center gap-2 pb-1">
          <TrendingDown size={18} className="text-default-500" aria-hidden="true" />
          <span className="text-sm text-default-500 font-medium">
            Monthly Spending
          </span>
        </CardHeader>
        <CardBody className="pt-0 gap-2">
          <p className="text-2xl font-bold">{formatCurrency(monthlyExpenses)}</p>
          <Progress
            aria-label="Spending vs income"
            value={spendingProgress}
            color={spendingProgress >= 100 ? "danger" : spendingProgress >= 75 ? "warning" : "success"}
            size="sm"
            className="max-w-full"
          />
          {monthlyIncome > 0 && (
            <p className="text-xs text-default-400">
              of {formatCurrency(monthlyIncome)} income
            </p>
          )}
        </CardBody>
      </Card>

      {/* Top Category */}
      <Card shadow="sm">
        <CardHeader className="flex items-center gap-2 pb-1">
          <Tag size={18} className="text-default-500" aria-hidden="true" />
          <span className="text-sm text-default-500 font-medium">Top Category</span>
        </CardHeader>
        <CardBody className="pt-0 gap-2">
          {topCategory ? (
            <>
              <p className="text-2xl font-bold">{displayName(topCategory)}</p>
              <Chip size="sm" variant="flat" color="warning">
                {formatCurrency(topCategoryAmount)} this month
              </Chip>
            </>
          ) : (
            <p className="text-default-400 text-sm">No expenses this month</p>
          )}
        </CardBody>
      </Card>

      {/* Savings Rate */}
      <Card shadow="sm">
        <CardHeader className="flex items-center gap-2 pb-1">
          <PiggyBank size={18} className="text-default-500" aria-hidden="true" />
          <span className="text-sm text-default-500 font-medium">Savings Rate</span>
        </CardHeader>
        <CardBody className="pt-0 gap-2">
          {savingsRate !== null ? (
            <>
              <p className="text-2xl font-bold">{savingsRate.toFixed(1)}%</p>
              <Chip size="sm" variant="flat" color={savingsColor}>
                {savingsRate >= 20
                  ? "On track"
                  : savingsRate >= 0
                  ? "Could be better"
                  : "Over budget"}
              </Chip>
            </>
          ) : (
            <p className="text-default-400 text-sm">No income recorded this month</p>
          )}
        </CardBody>
      </Card>
    </div>
  )
}
