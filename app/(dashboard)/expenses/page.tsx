import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { connectDB } from "@/lib/db"
import Expense from "@/lib/models/expense"
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

export default async function ExpensesPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect("/sign-in")

  await connectDB()

  const raw = await Expense.find({ userId: session.user.id })
    .sort({ date: -1 })
    .lean()

  const expenses: SerializedExpense[] = raw.map((e) => ({
    id: e._id.toString(),
    description: e.description,
    amount: e.amount,
    category: e.category,
    type: e.type as "income" | "expense",
    date: e.date.toISOString(),
    notes: e.notes,
  }))

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Expenses</h1>
        <p className="text-default-500 text-sm mt-1">
          Manage your income and expenses
        </p>
      </div>
      <ExpenseTable expenses={expenses} />
    </>
  )
}
