"use server"

import bcrypt from "bcryptjs"
import { connectDB } from "@/lib/db"
import User from "@/lib/models/user"
import { signUpSchema } from "@/lib/schemas/auth"

type RegisterResult =
  | { success: true }
  | { success: false; error: string; fields?: Record<string, string[]> }

export async function registerUser(data: unknown): Promise<RegisterResult> {
  const parsed = signUpSchema.safeParse(data)
  if (!parsed.success) {
    return {
      success: false,
      error: "Please fix the errors below.",
      fields: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const { name, email, password } = parsed.data

  try {
    await connectDB()

    const existing = await User.findOne({ email: email.toLowerCase() })
    if (existing) {
      return {
        success: false,
        error: "An account with that email already exists.",
      }
    }

    const hashedPassword = await bcrypt.hash(password, 12)

    await User.create({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
    })

    return { success: true }
  } catch (err) {
    console.error("[registerUser] Failed to create user:", err)
    return { success: false, error: "Something went wrong. Please try again." }
  }
}
