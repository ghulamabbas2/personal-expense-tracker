"use server"

import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { connectDB } from "@/lib/db"
import Category from "@/lib/models/category"
import { createCategorySchema } from "@/lib/schemas/category"
import { revalidatePath } from "next/cache"
import type { ActionResult } from "@/lib/types"

export async function createCategory(
  data: unknown
): Promise<ActionResult<{ id: string; name: string; isDefault: boolean }>> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return { success: false, error: "You must be signed in to do this." }
  }

  const parsed = createCategorySchema.safeParse(data)
  if (!parsed.success) {
    return {
      success: false,
      error: "Please fix the errors below.",
      fields: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  try {
    await connectDB()
    const category = await Category.create({
      userId: session.user.id,
      name: parsed.data.name.trim(),
      isDefault: false,
    })
    revalidatePath("/expenses/categories")
    revalidatePath("/expenses")
    return {
      success: true,
      data: {
        id: category._id.toString(),
        name: category.name,
        isDefault: category.isDefault,
      },
    }
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: number }).code === 11000
    ) {
      return {
        success: false,
        error: "A category with this name already exists.",
      }
    }
    console.error("[createCategory] Failed for user:", session.user.id, err)
    return { success: false, error: "Something went wrong. Please try again." }
  }
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return { success: false, error: "You must be signed in to do this." }
  }

  try {
    await connectDB()
    const category = await Category.findOne({
      _id: id,
      userId: session.user.id,
    })
    if (!category) {
      return { success: false, error: "Category not found." }
    }
    if (category.isDefault) {
      return {
        success: false,
        error: "Default categories cannot be deleted.",
      }
    }
    await category.deleteOne()
    revalidatePath("/expenses/categories")
    revalidatePath("/expenses")
    return { success: true }
  } catch (err) {
    console.error("[deleteCategory] Failed for user:", session.user.id, err)
    return { success: false, error: "Something went wrong. Please try again." }
  }
}
