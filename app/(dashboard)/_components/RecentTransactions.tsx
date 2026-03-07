"use client"

import {
  Card,
  CardHeader,
  CardBody,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  Link,
} from "@heroui/react"
import { ArrowRight } from "lucide-react"
import type { RecentTransaction } from "../page"

const CATEGORY_COLORS: Record<
  string,
  "primary" | "success" | "warning" | "danger" | "default" | "secondary"
> = {
  food: "warning",
  transport: "primary",
  housing: "success",
  entertainment: "secondary",
  health: "danger",
  shopping: "default",
  other: "default",
}

function displayName(name: string) {
  return name.charAt(0).toUpperCase() + name.slice(1)
}

export function RecentTransactions({
  transactions,
}: {
  transactions: RecentTransaction[]
}) {
  return (
    <Card shadow="sm">
      <CardHeader className="flex justify-between items-center">
        <span className="font-semibold text-base">Recent Transactions</span>
        <Link
          href="/expenses"
          size="sm"
          className="flex items-center gap-1 text-primary"
        >
          View all
          <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </CardHeader>
      <CardBody className="pt-0 px-0">
        <Table
          aria-label="Recent transactions"
          isStriped
          selectionMode="none"
          removeWrapper
        >
          <TableHeader>
            <TableColumn>Date</TableColumn>
            <TableColumn>Description</TableColumn>
            <TableColumn>Category</TableColumn>
            <TableColumn>Amount</TableColumn>
          </TableHeader>
          <TableBody
            items={transactions}
            emptyContent={
              <div className="py-6 text-center text-default-400 text-sm">
                No transactions yet. Add your first expense.
              </div>
            }
          >
            {(tx) => (
              <TableRow key={tx.id}>
                <TableCell className="text-sm text-default-500 whitespace-nowrap">
                  {new Date(tx.date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </TableCell>
                <TableCell className="text-sm max-w-[120px] truncate">
                  {tx.description}
                </TableCell>
                <TableCell>
                  <Chip
                    variant="flat"
                    color={CATEGORY_COLORS[tx.category] ?? "default"}
                    size="sm"
                  >
                    {displayName(tx.category)}
                  </Chip>
                </TableCell>
                <TableCell>
                  <Chip
                    variant="flat"
                    color={tx.type === "income" ? "success" : "danger"}
                    size="sm"
                  >
                    {tx.type === "income" ? "+" : "-"}$
                    {tx.amount.toFixed(2)}
                  </Chip>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardBody>
    </Card>
  )
}
