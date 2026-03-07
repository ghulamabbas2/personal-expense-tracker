import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { connectDB } from "@/lib/db"
import Expense from "@/lib/models/expense"
import Category from "@/lib/models/category"
import { ExpenseTable } from "./_components/ExpenseTable"

export type SerializedExpense = {
  id: string
  description: string
  amount: number
  category: string
  type: "income" | "expense"
  date: string
  notes?: string
}

export type SerializedCategory = {
  id: string
  name: string
  isDefault: boolean
}

const DEFAULT_CATEGORY_NAMES = [
  "food",
  "transport",
  "housing",
  "entertainment",
  "health",
  "shopping",
  "other",
]

export default async function ExpensesPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect("/sign-in")

  await connectDB()

  // Seed default categories for the user if none exist
  const categoryCount = await Category.countDocuments({
    userId: session.user.id,
  })
  if (categoryCount === 0) {
    try {
      await Category.insertMany(
        DEFAULT_CATEGORY_NAMES.map((name) => ({
          userId: session.user.id,
          name,
          isDefault: true,
        })),
        { ordered: false }
      )
    } catch {
      // Ignore duplicate key errors from concurrent requests
    }
  }

  const [rawExpenses, rawCategories] = await Promise.all([
    Expense.find({ userId: session.user.id }).sort({ date: -1 }).lean(),
    Category.find({ userId: session.user.id })
      .sort({ isDefault: -1, name: 1 })
      .lean(),
  ])

  const expenses: SerializedExpense[] = rawExpenses.map((e) => ({
    id: e._id.toString(),
    description: e.description,
    amount: e.amount,
    category: e.category,
    type: e.type as "income" | "expense",
    date: e.date.toISOString(),
    notes: e.notes,
  }))

  const categories: SerializedCategory[] = rawCategories.map((c) => ({
    id: c._id.toString(),
    name: c.name,
    isDefault: c.isDefault,
  }))

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Expenses</h1>
        <p className="text-default-500 text-sm mt-1">
          Manage your income and expenses
        </p>
      </div>
      <ExpenseTable expenses={expenses} categories={categories} />
    </>
  )
}
