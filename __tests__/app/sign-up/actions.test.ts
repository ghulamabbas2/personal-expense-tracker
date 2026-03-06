jest.mock("@/lib/db", () => ({
  connectDB: jest.fn().mockResolvedValue(undefined),
}))

jest.mock("@/lib/models/user", () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(),
    create: jest.fn(),
  },
}))

jest.mock("bcryptjs", () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}))

import { registerUser } from "@/app/(auth)/sign-up/actions"
import { connectDB } from "@/lib/db"
import User from "@/lib/models/user"
import bcrypt from "bcryptjs"

const mockConnectDB = connectDB as jest.MockedFunction<typeof connectDB>
const mockUserFindOne = User.findOne as jest.MockedFunction<typeof User.findOne>
const mockUserCreate = User.create as jest.MockedFunction<typeof User.create>
const mockBcryptHash = bcrypt.hash as jest.MockedFunction<typeof bcrypt.hash>

const validInput = {
  name: "Alice",
  email: "alice@example.com",
  password: "Password1!",
  confirmPassword: "Password1!",
}

// ---------------------------------------------------------------------------
// registerUser — validation failures
// ---------------------------------------------------------------------------
describe("registerUser — Zod validation failures", () => {
  it("returns success: false with field errors when the payload is invalid", async () => {
    const result = await registerUser({ email: "bad", password: "", confirmPassword: "" })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe("Please fix the errors below.")
      expect(result.fields).toBeDefined()
    }
  })

  it("includes field-level errors for each invalid field", async () => {
    const result = await registerUser({ name: "", email: "not-an-email", password: "weak" })
    expect(result.success).toBe(false)
    if (!result.success && result.fields) {
      expect(result.fields.name).toBeDefined()
      expect(result.fields.email).toBeDefined()
      expect(result.fields.password).toBeDefined()
    }
  })

  it("does not call connectDB when input is invalid", async () => {
    await registerUser({ name: "", email: "bad", password: "123" })
    expect(mockConnectDB).not.toHaveBeenCalled()
  })

  it("does not call User.findOne when input is invalid", async () => {
    await registerUser({ name: "" })
    expect(mockUserFindOne).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// registerUser — duplicate email
// ---------------------------------------------------------------------------
describe("registerUser — duplicate email", () => {
  beforeEach(() => {
    mockConnectDB.mockResolvedValue(undefined as never)
  })

  it("returns success: false with a generic error when the email is already registered", async () => {
    mockUserFindOne.mockResolvedValueOnce({ email: "alice@example.com" } as never)
    const result = await registerUser(validInput)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe("An account with that email already exists.")
    }
  })

  it("does not include field errors for a duplicate-email conflict (avoids user enumeration detail)", async () => {
    mockUserFindOne.mockResolvedValueOnce({ email: "alice@example.com" } as never)
    const result = await registerUser(validInput)
    if (!result.success) {
      expect(result.fields).toBeUndefined()
    }
  })

  it("does not hash the password or create a user when the email already exists", async () => {
    mockUserFindOne.mockResolvedValueOnce({ email: "alice@example.com" } as never)
    await registerUser(validInput)
    expect(mockBcryptHash).not.toHaveBeenCalled()
    expect(mockUserCreate).not.toHaveBeenCalled()
  })

  it("queries the database with the lowercased email", async () => {
    mockUserFindOne.mockResolvedValueOnce(null as never)
    mockBcryptHash.mockResolvedValueOnce("hashed_pw" as never)
    mockUserCreate.mockResolvedValueOnce({} as never)
    await registerUser({ ...validInput, email: "ALICE@EXAMPLE.COM" })
    expect(mockUserFindOne).toHaveBeenCalledWith({ email: "alice@example.com" })
  })
})

// ---------------------------------------------------------------------------
// registerUser — successful registration
// ---------------------------------------------------------------------------
describe("registerUser — successful registration", () => {
  beforeEach(() => {
    mockConnectDB.mockResolvedValue(undefined as never)
    mockUserFindOne.mockResolvedValue(null as never)
    mockBcryptHash.mockResolvedValue("hashed_pw" as never)
    mockUserCreate.mockResolvedValue({} as never)
  })

  it("returns { success: true } when registration succeeds", async () => {
    const result = await registerUser(validInput)
    expect(result).toEqual({ success: true })
  })

  it("hashes the password using bcrypt with saltRounds 12", async () => {
    await registerUser(validInput)
    expect(mockBcryptHash).toHaveBeenCalledWith("Password1!", 12)
  })

  it("creates the user with the hashed password, not the plain-text one", async () => {
    await registerUser(validInput)
    const createCall = mockUserCreate.mock.calls[0][0] as Record<string, unknown>
    expect(createCall.password).toBe("hashed_pw")
    expect(createCall.password).not.toBe("Password1!")
  })

  it("creates the user with the lowercased email", async () => {
    await registerUser({ ...validInput, email: "Alice@Example.COM" })
    const createCall = mockUserCreate.mock.calls[0][0] as Record<string, unknown>
    expect(createCall.email).toBe("alice@example.com")
  })

  it("creates the user with the correct name", async () => {
    await registerUser(validInput)
    const createCall = mockUserCreate.mock.calls[0][0] as Record<string, unknown>
    expect(createCall.name).toBe("Alice")
  })
})

// ---------------------------------------------------------------------------
// registerUser — unexpected database errors
// ---------------------------------------------------------------------------
describe("registerUser — unexpected database errors", () => {
  beforeEach(() => {
    mockConnectDB.mockResolvedValue(undefined as never)
    mockUserFindOne.mockResolvedValue(null as never)
    mockBcryptHash.mockResolvedValue("hashed_pw" as never)
    jest.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("returns a generic error message when User.create throws", async () => {
    mockUserCreate.mockRejectedValueOnce(new Error("DB connection lost") as never)
    const result = await registerUser(validInput)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe("Something went wrong. Please try again.")
    }
  })

  it("does not expose the internal error message to the caller", async () => {
    mockUserCreate.mockRejectedValueOnce(new Error("E11000 duplicate key error collection: users") as never)
    const result = await registerUser(validInput)
    if (!result.success) {
      expect(result.error).not.toContain("E11000")
      expect(result.error).not.toContain("duplicate key")
    }
  })

  it("returns a generic error message when connectDB throws", async () => {
    mockConnectDB.mockRejectedValueOnce(new Error("Cannot connect") as never)
    const result = await registerUser(validInput)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe("Something went wrong. Please try again.")
    }
  })
})
