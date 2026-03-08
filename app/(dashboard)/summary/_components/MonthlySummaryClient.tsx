"use client"

import { useRouter, useSearchParams } from "next/navigation"
import {
  Card,
  CardHeader,
  CardBody,
  Chip,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Button,
} from "@heroui/react"
import { ChevronLeft, ChevronRight, TrendingDown, TrendingUp, Wallet } from "lucide-react"

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

export interface CategoryBreakdown {
  category: string
  count: number
  total: number
}

export interface MonthlySummaryData {
  totalExpenses: number
  totalIncome: number
  netBalance: number
  byCategory: CategoryBreakdown[]
}

interface MonthlySummaryClientProps {
  year: number
  month: number
  data: MonthlySummaryData
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount)
}

function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export default function MonthlySummaryClient({
  year,
  month,
  data,
}: MonthlySummaryClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function navigate(targetYear: number, targetMonth: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set("year", String(targetYear))
    params.set("month", String(targetMonth))
    router.push(`/summary?${params.toString()}`)
  }

  function goPrev() {
    if (month === 1) {
      navigate(year - 1, 12)
    } else {
      navigate(year, month - 1)
    }
  }

  function goNext() {
    if (month === 12) {
      navigate(year + 1, 1)
    } else {
      navigate(year, month + 1)
    }
  }

  const net = data.netBalance
  const netColor = net >= 0 ? "success" : "danger"

  return (
    <div className="flex flex-col gap-6">
      {/* Month navigation header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Monthly Summary</h1>
        <div className="flex items-center gap-2">
          <Button
            isIconOnly
            variant="flat"
            size="sm"
            aria-label="Previous month"
            onPress={goPrev}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </Button>
          <span className="text-sm font-medium min-w-[120px] text-center">
            {MONTH_NAMES[month - 1]} {year}
          </span>
          <Button
            isIconOnly
            variant="flat"
            size="sm"
            aria-label="Next month"
            onPress={goNext}
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card shadow="sm">
          <CardHeader className="flex items-center gap-2 pb-0">
            <TrendingDown className="h-4 w-4 text-danger" aria-hidden="true" />
            <span className="text-sm text-default-500">Total Expenses</span>
          </CardHeader>
          <CardBody className="pt-2">
            <p className="text-2xl font-bold">{formatCurrency(data.totalExpenses)}</p>
            <Chip size="sm" color="danger" variant="flat" className="mt-1">
              {data.byCategory.reduce((sum, c) => sum + c.count, 0)} transactions
            </Chip>
          </CardBody>
        </Card>

        <Card shadow="sm">
          <CardHeader className="flex items-center gap-2 pb-0">
            <TrendingUp className="h-4 w-4 text-success" aria-hidden="true" />
            <span className="text-sm text-default-500">Total Income</span>
          </CardHeader>
          <CardBody className="pt-2">
            <p className="text-2xl font-bold">{formatCurrency(data.totalIncome)}</p>
            <Chip size="sm" color="success" variant="flat" className="mt-1">
              This month
            </Chip>
          </CardBody>
        </Card>

        <Card shadow="sm">
          <CardHeader className="flex items-center gap-2 pb-0">
            <Wallet className="h-4 w-4 text-primary" aria-hidden="true" />
            <span className="text-sm text-default-500">Net Balance</span>
          </CardHeader>
          <CardBody className="pt-2">
            <p className="text-2xl font-bold">{formatCurrency(net)}</p>
            <Chip size="sm" color={netColor} variant="flat" className="mt-1">
              {net >= 0 ? "Surplus" : "Deficit"}
            </Chip>
          </CardBody>
        </Card>
      </div>

      {/* Category breakdown table */}
      <Card shadow="sm">
        <CardHeader>
          <h2 className="text-base font-semibold">Expenses by Category</h2>
        </CardHeader>
        <CardBody className="pt-0">
          <Table
            aria-label="Expense breakdown by category"
            removeWrapper
            isStriped
            selectionMode="none"
          >
            <TableHeader>
              <TableColumn>Category</TableColumn>
              <TableColumn>Transactions</TableColumn>
              <TableColumn>Total</TableColumn>
            </TableHeader>
            <TableBody
              emptyContent="No expenses recorded for this month."
              items={data.byCategory}
            >
              {(row) => (
                <TableRow key={row.category}>
                  <TableCell>
                    <Chip variant="flat" size="sm">
                      {capitalize(row.category)}
                    </Chip>
                  </TableCell>
                  <TableCell>{row.count}</TableCell>
                  <TableCell>
                    <span className="font-medium text-danger">
                      {formatCurrency(row.total)}
                    </span>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardBody>
      </Card>
    </div>
  )
}
