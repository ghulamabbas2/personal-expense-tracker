import { z } from "zod"

export const createExpenseSchema = z.object({
  description: z.string().min(1, "Description is required").max(200),
  amount: z
    .number({ invalid_type_error: "Amount must be a number" })
    .positive("Amount must be greater than zero")
    .multipleOf(0.01, "Amount can have at most 2 decimal places"),
  category: z.enum(
    ["food", "transport", "housing", "entertainment", "health", "shopping", "other"],
    { errorMap: () => ({ message: "Please select a valid category" }) }
  ),
  type: z.enum(["expense", "income"], {
    errorMap: () => ({ message: "Please select a type" }),
  }),
  date: z.coerce.date({ errorMap: () => ({ message: "Please enter a valid date" }) }),
  notes: z.string().max(500).optional(),
})

export const updateExpenseSchema = createExpenseSchema.partial()

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>
