"use server"

import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { connectDB } from "@/lib/db"
import { createExpenseSchema, updateExpenseSchema } from "@/lib/schemas/expense"
import Expense from "@/lib/models/expense"
import { revalidatePath } from "next/cache"
import type { ActionResult } from "@/lib/types"

export async function createExpense(
  data: unknown
): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return { success: false, error: "You must be signed in to do this." }
  }

  const parsed = createExpenseSchema.safeParse(data)
  if (!parsed.success) {
    return {
      success: false,
      error: "Please fix the errors below.",
      fields: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  try {
    await connectDB()
    const expense = await Expense.create({
      ...parsed.data,
      userId: session.user.id,
    })
    revalidatePath("/expenses")
    return { success: true, data: { id: expense._id.toString() } }
  } catch (err) {
    console.error("[createExpense] Failed for user:", session.user.id, err)
    return { success: false, error: "Something went wrong. Please try again." }
  }
}

export async function updateExpense(
  id: string,
  data: unknown
): Promise<ActionResult> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return { success: false, error: "You must be signed in to do this." }
  }

  const parsed = updateExpenseSchema.safeParse(data)
  if (!parsed.success) {
    return {
      success: false,
      error: "Please fix the errors below.",
      fields: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  try {
    await connectDB()
    const expense = await Expense.findOneAndUpdate(
      { _id: id, userId: session.user.id },
      { $set: parsed.data },
      { new: true }
    )
    if (!expense) {
      return { success: false, error: "Expense not found." }
    }
    revalidatePath("/expenses")
    return { success: true }
  } catch (err) {
    console.error("[updateExpense] Failed for user:", session.user.id, err)
    return { success: false, error: "Something went wrong. Please try again." }
  }
}

export async function deleteExpense(id: string): Promise<ActionResult> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return { success: false, error: "You must be signed in to do this." }
  }

  try {
    await connectDB()
    const deleted = await Expense.findOneAndDelete({
      _id: id,
      userId: session.user.id,
    })
    if (!deleted) {
      return { success: false, error: "Expense not found." }
    }
    revalidatePath("/expenses")
    return { success: true }
  } catch (err) {
    console.error("[deleteExpense] Failed for user:", session.user.id, err)
    return { success: false, error: "Something went wrong. Please try again." }
  }
}
