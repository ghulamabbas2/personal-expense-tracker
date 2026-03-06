// Mocks must be declared before any import that reaches the mocked modules.

jest.mock("next-auth", () => jest.fn(() => jest.fn()))

jest.mock("next-auth/providers/credentials", () =>
  jest.fn((config: Record<string, unknown>) => ({
    ...config,
    id: "credentials",
    type: "credentials",
  }))
)

jest.mock("@next-auth/mongodb-adapter", () => ({
  MongoDBAdapter: jest.fn(() => ({})),
}))

jest.mock("@/lib/mongodb-client", () => Promise.resolve({}))

jest.mock("@/lib/db", () => ({
  connectDB: jest.fn().mockResolvedValue(undefined),
}))

jest.mock("@/lib/models/user", () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(),
  },
}))

jest.mock("bcryptjs", () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}))

import { authOptions } from "@/lib/auth"
import { connectDB } from "@/lib/db"
import User from "@/lib/models/user"
import bcrypt from "bcryptjs"
import type { JWT } from "next-auth/jwt"
import type { Session, User as NextAuthUser } from "next-auth"

// ---------------------------------------------------------------------------
// Typed helpers
// ---------------------------------------------------------------------------
const mockConnectDB = connectDB as jest.MockedFunction<typeof connectDB>
const mockUserFindOne = User.findOne as jest.MockedFunction<typeof User.findOne>
const mockBcryptCompare = bcrypt.compare as jest.MockedFunction<typeof bcrypt.compare>

// The Credentials provider is the first (and only) provider in authOptions.
// Because we mocked `next-auth/providers/credentials` to spread the config object
// and add `id` and `type`, the authorize function lives at providers[0].authorize.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getAuthorize = (): (credentials: any) => Promise<NextAuthUser | null> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (authOptions.providers[0] as any).authorize
}

// ---------------------------------------------------------------------------
// authorize callback
// ---------------------------------------------------------------------------
describe("authOptions — authorize callback", () => {
  beforeEach(() => {
    mockConnectDB.mockResolvedValue(undefined as never)
  })

  it("returns null when credentials are undefined", async () => {
    const authorize = getAuthorize()
    const result = await authorize(undefined)
    expect(result).toBeNull()
  })

  it("returns null when email is missing", async () => {
    const authorize = getAuthorize()
    const result = await authorize({ password: "Password1!" })
    expect(result).toBeNull()
  })

  it("returns null when password is missing", async () => {
    const authorize = getAuthorize()
    const result = await authorize({ email: "user@example.com" })
    expect(result).toBeNull()
  })

  it("returns null when both email and password are missing", async () => {
    const authorize = getAuthorize()
    const result = await authorize({})
    expect(result).toBeNull()
  })

  it("does not call connectDB when credentials are missing", async () => {
    const authorize = getAuthorize()
    await authorize({})
    expect(mockConnectDB).not.toHaveBeenCalled()
  })

  it("returns null when no user is found in the database", async () => {
    mockUserFindOne.mockResolvedValueOnce(null as never)
    const authorize = getAuthorize()
    const result = await authorize({ email: "ghost@example.com", password: "Password1!" })
    expect(result).toBeNull()
  })

  it("queries the database with the lowercased email", async () => {
    mockUserFindOne.mockResolvedValueOnce(null as never)
    const authorize = getAuthorize()
    await authorize({ email: "User@Example.COM", password: "Password1!" })
    expect(mockUserFindOne).toHaveBeenCalledWith({ email: "user@example.com" })
  })

  it("returns null when the password does not match the stored hash", async () => {
    const fakeUser = { _id: { toString: () => "abc123" }, name: "Alice", email: "alice@example.com", password: "hashed" }
    mockUserFindOne.mockResolvedValueOnce(fakeUser as never)
    mockBcryptCompare.mockResolvedValueOnce(false as never)
    const authorize = getAuthorize()
    const result = await authorize({ email: "alice@example.com", password: "WrongPass1!" })
    expect(result).toBeNull()
  })

  it("returns { id, name, email } on successful authentication", async () => {
    const fakeUser = {
      _id: { toString: () => "abc123" },
      name: "Alice",
      email: "alice@example.com",
      password: "hashed",
    }
    mockUserFindOne.mockResolvedValueOnce(fakeUser as never)
    mockBcryptCompare.mockResolvedValueOnce(true as never)
    const authorize = getAuthorize()
    const result = await authorize({ email: "alice@example.com", password: "Password1!" })
    expect(result).toEqual({ id: "abc123", name: "Alice", email: "alice@example.com" })
  })

  it("does not include password or other sensitive fields in the return value", async () => {
    const fakeUser = {
      _id: { toString: () => "abc123" },
      name: "Alice",
      email: "alice@example.com",
      password: "hashed",
      someInternalFlag: true,
    }
    mockUserFindOne.mockResolvedValueOnce(fakeUser as never)
    mockBcryptCompare.mockResolvedValueOnce(true as never)
    const authorize = getAuthorize()
    const result = await authorize({ email: "alice@example.com", password: "Password1!" })
    expect(result).not.toHaveProperty("password")
    expect(result).not.toHaveProperty("someInternalFlag")
  })
})

// ---------------------------------------------------------------------------
// jwt callback
// ---------------------------------------------------------------------------
describe("authOptions — jwt callback", () => {
  const jwtCallback = authOptions.callbacks!.jwt!

  it("sets token.sub to user.id on initial sign-in (when user object is present)", async () => {
    const token: JWT = { name: "Alice", email: "alice@example.com" }
    const user = { id: "abc123", name: "Alice", email: "alice@example.com" } as NextAuthUser
    const result = await jwtCallback({ token, user, account: null, trigger: "signIn" })
    expect(result.sub).toBe("abc123")
  })

  it("passes the token through unchanged on subsequent calls (no user object)", async () => {
    const token: JWT = { sub: "abc123", name: "Alice", email: "alice@example.com" }
    const result = await jwtCallback({ token, user: undefined as unknown as NextAuthUser, account: null, trigger: "update" })
    expect(result).toEqual(token)
  })

  it("does not overwrite an existing token.sub when no user is provided", async () => {
    const token: JWT = { sub: "original-id" }
    const result = await jwtCallback({ token, user: undefined as unknown as NextAuthUser, account: null, trigger: "update" })
    expect(result.sub).toBe("original-id")
  })
})

// ---------------------------------------------------------------------------
// session callback
// ---------------------------------------------------------------------------
describe("authOptions — session callback", () => {
  const sessionCallback = authOptions.callbacks!.session!

  const makeSession = (overrides?: Partial<Session["user"]>): Session => ({
    expires: "2099-01-01",
    user: {
      id: "",
      name: "Alice",
      email: "alice@example.com",
      ...overrides,
    },
  })

  it("copies token.sub into session.user.id", async () => {
    const session = makeSession()
    const token: JWT = { sub: "abc123" }
    const result = await sessionCallback({ session, token, user: undefined as never, newSession: undefined, trigger: "update" })
    expect(result.user.id).toBe("abc123")
  })

  it("returns only id, name, and email on session.user (no extra fields)", async () => {
    const session = makeSession()
    const token: JWT = { sub: "abc123" }
    const result = await sessionCallback({ session, token, user: undefined as never, newSession: undefined, trigger: "update" })
    const userKeys = Object.keys(result.user)
    expect(userKeys).toEqual(expect.arrayContaining(["id", "name", "email"]))
    // No extra fields beyond the whitelisted three
    expect(userKeys.length).toBe(3)
  })

  it("preserves name and email from the original session", async () => {
    const session = makeSession({ name: "Bob", email: "bob@example.com" })
    const token: JWT = { sub: "xyz789" }
    const result = await sessionCallback({ session, token, user: undefined as never, newSession: undefined, trigger: "update" })
    expect(result.user.name).toBe("Bob")
    expect(result.user.email).toBe("bob@example.com")
  })

  it("does not set session.user.id when token.sub is absent", async () => {
    const session = makeSession({ id: "" })
    const token: JWT = {}
    const result = await sessionCallback({ session, token, user: undefined as never, newSession: undefined, trigger: "update" })
    // token.sub is undefined so the if-branch is skipped; id retains whatever was on session.user
    expect(result.user.id).toBe("")
  })
})
