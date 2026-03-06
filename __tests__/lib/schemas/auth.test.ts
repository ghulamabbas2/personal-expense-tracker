import { signInSchema, signUpSchema } from "@/lib/schemas/auth"

// ---------------------------------------------------------------------------
// signInSchema
// ---------------------------------------------------------------------------
describe("signInSchema", () => {
  const validInput = { email: "user@example.com", password: "secret" }

  describe("valid input", () => {
    it("accepts a valid email and non-empty password", () => {
      const result = signInSchema.safeParse(validInput)
      expect(result.success).toBe(true)
    })
  })

  describe("email field", () => {
    it("rejects when email is missing", () => {
      const result = signInSchema.safeParse({ password: "secret" })
      expect(result.success).toBe(false)
      if (!result.success) {
        const emailErrors = result.error.flatten().fieldErrors.email
        expect(emailErrors).toBeDefined()
      }
    })

    it("rejects when email is not a valid email address", () => {
      const result = signInSchema.safeParse({ email: "not-an-email", password: "secret" })
      expect(result.success).toBe(false)
      if (!result.success) {
        const emailErrors = result.error.flatten().fieldErrors.email
        expect(emailErrors).toContain("Please enter a valid email address")
      }
    })

    it("rejects when email is an empty string", () => {
      const result = signInSchema.safeParse({ email: "", password: "secret" })
      expect(result.success).toBe(false)
    })
  })

  describe("password field", () => {
    it("rejects when password is missing", () => {
      const result = signInSchema.safeParse({ email: "user@example.com" })
      expect(result.success).toBe(false)
      if (!result.success) {
        const passwordErrors = result.error.flatten().fieldErrors.password
        expect(passwordErrors).toBeDefined()
      }
    })

    it("rejects when password is an empty string", () => {
      const result = signInSchema.safeParse({ email: "user@example.com", password: "" })
      expect(result.success).toBe(false)
      if (!result.success) {
        const passwordErrors = result.error.flatten().fieldErrors.password
        expect(passwordErrors).toContain("Password is required")
      }
    })

    it("accepts a single-character password (only non-empty is required)", () => {
      const result = signInSchema.safeParse({ email: "user@example.com", password: "x" })
      expect(result.success).toBe(true)
    })
  })
})

// ---------------------------------------------------------------------------
// signUpSchema
// ---------------------------------------------------------------------------
describe("signUpSchema", () => {
  const validInput = {
    name: "Alice",
    email: "alice@example.com",
    password: "Password1!",
    confirmPassword: "Password1!",
  }

  describe("valid input", () => {
    it("accepts a fully valid registration payload", () => {
      const result = signUpSchema.safeParse(validInput)
      expect(result.success).toBe(true)
    })
  })

  describe("name field", () => {
    it("rejects when name is missing", () => {
      const result = signUpSchema.safeParse({ ...validInput, name: undefined })
      expect(result.success).toBe(false)
    })

    it("rejects when name is an empty string", () => {
      const result = signUpSchema.safeParse({ ...validInput, name: "" })
      expect(result.success).toBe(false)
      if (!result.success) {
        const nameErrors = result.error.flatten().fieldErrors.name
        expect(nameErrors).toContain("Name is required")
      }
    })

    it("rejects when name exceeds 100 characters", () => {
      const result = signUpSchema.safeParse({ ...validInput, name: "A".repeat(101) })
      expect(result.success).toBe(false)
      if (!result.success) {
        const nameErrors = result.error.flatten().fieldErrors.name
        expect(nameErrors).toBeDefined()
      }
    })

    it("accepts a name that is exactly 100 characters", () => {
      const result = signUpSchema.safeParse({ ...validInput, name: "A".repeat(100) })
      expect(result.success).toBe(true)
    })
  })

  describe("email field", () => {
    it("rejects when email is missing", () => {
      const result = signUpSchema.safeParse({ ...validInput, email: undefined })
      expect(result.success).toBe(false)
    })

    it("rejects when email is not a valid address", () => {
      const result = signUpSchema.safeParse({ ...validInput, email: "bad-email" })
      expect(result.success).toBe(false)
      if (!result.success) {
        const emailErrors = result.error.flatten().fieldErrors.email
        expect(emailErrors).toContain("Please enter a valid email address")
      }
    })
  })

  describe("password field", () => {
    it("rejects when password is fewer than 8 characters", () => {
      const short = "Ab1!"
      const result = signUpSchema.safeParse({
        ...validInput,
        password: short,
        confirmPassword: short,
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        const passwordErrors = result.error.flatten().fieldErrors.password
        expect(passwordErrors).toContain("Password must be at least 8 characters")
      }
    })

    it("rejects when password has no uppercase letter", () => {
      const pw = "password1!"
      const result = signUpSchema.safeParse({
        ...validInput,
        password: pw,
        confirmPassword: pw,
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        const passwordErrors = result.error.flatten().fieldErrors.password
        expect(passwordErrors).toContain(
          "Password must contain at least one uppercase letter"
        )
      }
    })

    it("rejects when password has no number", () => {
      const pw = "Password!"
      const result = signUpSchema.safeParse({
        ...validInput,
        password: pw,
        confirmPassword: pw,
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        const passwordErrors = result.error.flatten().fieldErrors.password
        expect(passwordErrors).toContain("Password must contain at least one number")
      }
    })

    it("rejects when password has no special character", () => {
      const pw = "Password1"
      const result = signUpSchema.safeParse({
        ...validInput,
        password: pw,
        confirmPassword: pw,
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        const passwordErrors = result.error.flatten().fieldErrors.password
        expect(passwordErrors).toContain(
          "Password must contain at least one special character"
        )
      }
    })

    it("accepts a password that meets all requirements", () => {
      const result = signUpSchema.safeParse(validInput)
      expect(result.success).toBe(true)
    })
  })

  describe("confirmPassword field", () => {
    it("rejects when confirmPassword does not match password", () => {
      const result = signUpSchema.safeParse({
        ...validInput,
        confirmPassword: "DifferentPass1!",
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        const confirmErrors = result.error.flatten().fieldErrors.confirmPassword
        expect(confirmErrors).toContain("Passwords do not match")
      }
    })

    it("accepts when confirmPassword exactly matches password", () => {
      const result = signUpSchema.safeParse(validInput)
      expect(result.success).toBe(true)
    })
  })
})
