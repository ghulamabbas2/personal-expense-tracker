import mongoose, { Schema, Document, Model, Types } from "mongoose";

export const EXPENSE_CATEGORIES = [
  "food", "transport", "housing", "entertainment", "health", "shopping", "other",
] as const;
export const EXPENSE_TYPES = ["income", "expense"] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export type ExpenseType = (typeof EXPENSE_TYPES)[number];

export interface IExpense extends Document {
  userId: Types.ObjectId;
  description: string;
  amount: number;
  category: ExpenseCategory;
  type: ExpenseType;
  notes?: string;
  date: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ExpenseSchema = new Schema<IExpense>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    description: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    category: { type: String, required: true, enum: EXPENSE_CATEGORIES },
    type: { type: String, required: true, enum: EXPENSE_TYPES },
    notes: { type: String, trim: true },
    date: { type: Date, required: true },
  },
  { timestamps: true }
);

ExpenseSchema.index({ userId: 1, date: -1 });
ExpenseSchema.index({ userId: 1, category: 1 });

const Expense: Model<IExpense> =
  mongoose.models.Expense ?? mongoose.model<IExpense>("Expense", ExpenseSchema);

export default Expense;
