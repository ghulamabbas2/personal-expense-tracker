import { z } from "zod"

export const createCategorySchema = z.object({
  name: z
    .string()
    .min(1, "Category name is required")
    .max(50, "Category name must be 50 characters or fewer"),
})

export type CreateCategoryInput = z.infer<typeof createCategorySchema>
