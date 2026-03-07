import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { connectDB } from "@/lib/db"
import Category from "@/lib/models/category"
import { CategoriesClient } from "./_components/CategoriesClient"

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

export default async function CategoriesPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect("/sign-in")

  await connectDB()

  const count = await Category.countDocuments({ userId: session.user.id })
  if (count === 0) {
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

  const raw = await Category.find({ userId: session.user.id })
    .sort({ isDefault: -1, name: 1 })
    .lean()

  const categories: SerializedCategory[] = raw.map((c) => ({
    id: c._id.toString(),
    name: c.name,
    isDefault: c.isDefault,
  }))

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Categories</h1>
        <p className="text-default-500 text-sm mt-1">
          Manage your expense categories
        </p>
      </div>
      <CategoriesClient initialCategories={categories} />
    </>
  )
}
