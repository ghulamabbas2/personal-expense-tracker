import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { connectDB } from "@/lib/db"
import Expense from "@/lib/models/expense"
import mongoose from "mongoose"
import { SummaryCards } from "./_components/SummaryCards"
import { RecentTransactions } from "./_components/RecentTransactions"
import { SpendingByCategory } from "./_components/SpendingByCategory"
import { MonthlyTrendChart } from "./_components/MonthlyTrendChart"

export type RecentTransaction = {
  id: string
  description: string
  category: string
  amount: number
  type: "income" | "expense"
  date: string
}

export type CategorySpend = {
  category: string
  total: number
}

export type MonthlyTrend = {
  month: string
  income: number
  expenses: number
}

export type DashboardSummary = {
  totalBalance: number
  monthlyExpenses: number
  monthlyIncome: number
  topCategory: string | null
  topCategoryAmount: number
  savingsRate: number | null
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect("/sign-in")

  await connectDB()

  const userId = new mongoose.Types.ObjectId(session.user.id)
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const endOfMonth = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
    23,
    59,
    59,
    999
  )

  // Start of 6 months ago (inclusive)
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)

  const [allTimeTotals, monthlyTotals, monthlyByCategory, recentRaw, trendRaw] =
    await Promise.all([
      // All-time income and expense totals
      Expense.aggregate([
        { $match: { userId } },
        { $group: { _id: "$type", total: { $sum: "$amount" } } },
      ]),

      // Current month income and expense totals
      Expense.aggregate([
        { $match: { userId, date: { $gte: startOfMonth, $lte: endOfMonth } } },
        { $group: { _id: "$type", total: { $sum: "$amount" } } },
      ]),

      // Current month expenses grouped by category, sorted desc
      Expense.aggregate([
        {
          $match: {
            userId,
            type: "expense",
            date: { $gte: startOfMonth, $lte: endOfMonth },
          },
        },
        { $group: { _id: "$category", total: { $sum: "$amount" } } },
        { $sort: { total: -1 } },
      ]),

      // 5 most recent transactions
      Expense.find({ userId: session.user.id })
        .sort({ date: -1 })
        .limit(5)
        .lean(),

      // Last 6 months of income and expenses grouped by year+month
      Expense.aggregate([
        {
          $match: {
            userId,
            date: { $gte: sixMonthsAgo },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: "$date" },
              month: { $month: "$date" },
              type: "$type",
            },
            total: { $sum: "$amount" },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ]),
    ])

  // Compute all-time balance
  const allTimeIncome =
    allTimeTotals.find((r) => r._id === "income")?.total ?? 0
  const allTimeExpenses =
    allTimeTotals.find((r) => r._id === "expense")?.total ?? 0
  const totalBalance = allTimeIncome - allTimeExpenses

  // Compute monthly metrics
  const monthlyIncome =
    monthlyTotals.find((r) => r._id === "income")?.total ?? 0
  const monthlyExpenses =
    monthlyTotals.find((r) => r._id === "expense")?.total ?? 0
  const savingsRate =
    monthlyIncome > 0
      ? ((monthlyIncome - monthlyExpenses) / monthlyIncome) * 100
      : null

  // Top category
  const topCategoryEntry = monthlyByCategory[0] ?? null
  const topCategory: string | null = topCategoryEntry?._id ?? null
  const topCategoryAmount: number = topCategoryEntry?.total ?? 0

  const summary: DashboardSummary = {
    totalBalance,
    monthlyExpenses,
    monthlyIncome,
    topCategory,
    topCategoryAmount,
    savingsRate,
  }

  const categorySpend: CategorySpend[] = monthlyByCategory.map((r) => ({
    category: r._id as string,
    total: r.total as number,
  }))

  const recentTransactions: RecentTransaction[] = recentRaw.map((e) => ({
    id: e._id.toString(),
    description: e.description,
    category: e.category,
    amount: e.amount,
    type: e.type as "income" | "expense",
    date: e.date.toISOString(),
  }))

  // Build a map of { "YYYY-M" -> { income, expenses } } from the aggregation
  const trendMap = new Map<string, { income: number; expenses: number }>()
  for (const r of trendRaw) {
    const key = `${r._id.year}-${r._id.month}`
    if (!trendMap.has(key)) trendMap.set(key, { income: 0, expenses: 0 })
    const entry = trendMap.get(key)!
    if (r._id.type === "income") entry.income = r.total
    else entry.expenses = r.total
  }

  // Fill all 6 months in order so the chart always has a full x-axis
  const MONTH_NAMES = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ]
  const monthlyTrend: MonthlyTrend[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${d.getMonth() + 1}`
    const entry = trendMap.get(key) ?? { income: 0, expenses: 0 }
    monthlyTrend.push({
      month: MONTH_NAMES[d.getMonth()],
      income: entry.income,
      expenses: entry.expenses,
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-default-500 text-sm mt-1">
          Your financial overview for{" "}
          {now.toLocaleString("default", { month: "long", year: "numeric" })}
        </p>
      </div>

      <SummaryCards summary={summary} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentTransactions transactions={recentTransactions} />
        <SpendingByCategory categorySpend={categorySpend} />
      </div>

      <MonthlyTrendChart data={monthlyTrend} />
    </div>
  )
}
