import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import mongoose from "mongoose"
import { authOptions } from "@/lib/auth"
import { connectDB } from "@/lib/db"
import Expense from "@/lib/models/expense"
import MonthlySummaryClient, {
  type MonthlySummaryData,
} from "./_components/MonthlySummaryClient"

interface SummaryPageProps {
  searchParams: { year?: string; month?: string }
}

export default async function SummaryPage({ searchParams }: SummaryPageProps) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect("/sign-in")

  const now = new Date()
  const year = Number(searchParams.year ?? now.getFullYear())
  const month = Number(searchParams.month ?? now.getMonth() + 1)

  await connectDB()

  const userId = new mongoose.Types.ObjectId(session.user.id)
  const startDate = new Date(year, month - 1, 1)
  const endDate = new Date(year, month, 1)

  const [expenseAgg, incomeAgg] = await Promise.all([
    // Expense totals by category
    Expense.aggregate([
      {
        $match: {
          userId,
          type: "expense",
          date: { $gte: startDate, $lt: endDate },
        },
      },
      {
        $group: {
          _id: "$category",
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
    ]),
    // Income total
    Expense.aggregate([
      {
        $match: {
          userId,
          type: "income",
          date: { $gte: startDate, $lt: endDate },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
        },
      },
    ]),
  ])

  const totalExpenses = expenseAgg.reduce(
    (sum: number, c: { total: number }) => sum + c.total,
    0
  )
  const totalIncome: number = incomeAgg[0]?.total ?? 0
  const netBalance = totalIncome - totalExpenses

  const data: MonthlySummaryData = {
    totalExpenses,
    totalIncome,
    netBalance,
    byCategory: expenseAgg.map((c: { _id: string; total: number; count: number }) => ({
      category: c._id,
      total: c.total,
      count: c.count,
    })),
  }

  return (
    <MonthlySummaryClient year={year} month={month} data={data} />
  )
}
