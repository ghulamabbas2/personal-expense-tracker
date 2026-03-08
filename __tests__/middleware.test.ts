import { NextResponse } from "next/server"

// ---------------------------------------------------------------------------
// Capture the arguments passed to withAuth so we can test the inner middleware
// function and the authorized callback independently.
// ---------------------------------------------------------------------------
type MiddlewareFn = (req: unknown) => unknown
type WithAuthOpts = { callbacks: { authorized: (args: { token: unknown }) => boolean } }

let capturedMiddlewareFn: MiddlewareFn
let capturedOpts: WithAuthOpts

jest.mock("next-auth/middleware", () => ({
  withAuth: jest.fn((fn: MiddlewareFn, opts: WithAuthOpts) => {
    capturedMiddlewareFn = fn
    capturedOpts = opts
    return jest.fn() // the resulting wrapped middleware (not used in unit tests)
  }),
}))

jest.mock("next/server", () => ({
  NextResponse: {
    redirect: jest.fn((url: URL) => ({ type: "redirect", url })),
  },
}))

// Import proxy AFTER mocks are set up so withAuth is called with our spy.
// The config export is a plain value — no mock needed.
// Next.js 16 uses proxy.ts (not middleware.ts) as the middleware entry point.
import { config } from "@/proxy"

const mockNextResponseRedirect = NextResponse.redirect as jest.MockedFunction<
  typeof NextResponse.redirect
>

// ---------------------------------------------------------------------------
// Helper: build a minimal NextRequest-like object
// ---------------------------------------------------------------------------
function makeRequest(pathname: string, token: Record<string, unknown> | null = null) {
  return {
    nextUrl: { pathname },
    url: `http://localhost${pathname}`,
    nextauth: { token },
  }
}

// ---------------------------------------------------------------------------
// authorized callback
// ---------------------------------------------------------------------------
describe("middleware — authorized callback", () => {
  it("returns true when a token is present", () => {
    const result = capturedOpts.callbacks.authorized({ token: { sub: "abc123" } })
    expect(result).toBe(true)
  })

  it("returns false when token is null", () => {
    const result = capturedOpts.callbacks.authorized({ token: null })
    expect(result).toBe(false)
  })

  it("returns false when token is undefined", () => {
    const result = capturedOpts.callbacks.authorized({ token: undefined })
    expect(result).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// inner middleware function — redirect logic
// ---------------------------------------------------------------------------
describe("middleware — inner middleware function", () => {
  beforeEach(() => {
    mockNextResponseRedirect.mockClear()
  })

  it("redirects to / when an authenticated user visits /sign-in", () => {
    const req = makeRequest("/sign-in", { sub: "abc123" })
    capturedMiddlewareFn(req)
    expect(mockNextResponseRedirect).toHaveBeenCalledTimes(1)
    const redirectUrl: URL = mockNextResponseRedirect.mock.calls[0][0] as URL
    expect(redirectUrl.pathname).toBe("/")
  })

  it("redirects to / when an authenticated user visits /sign-up", () => {
    const req = makeRequest("/sign-up", { sub: "abc123" })
    capturedMiddlewareFn(req)
    expect(mockNextResponseRedirect).toHaveBeenCalledTimes(1)
    const redirectUrl: URL = mockNextResponseRedirect.mock.calls[0][0] as URL
    expect(redirectUrl.pathname).toBe("/")
  })

  it("redirects to / when an authenticated user visits /sign-in/some-sub-path", () => {
    const req = makeRequest("/sign-in/reset", { sub: "abc123" })
    capturedMiddlewareFn(req)
    expect(mockNextResponseRedirect).toHaveBeenCalledTimes(1)
  })

  it("does NOT redirect when an unauthenticated user visits /sign-in", () => {
    const req = makeRequest("/sign-in", null)
    const result = capturedMiddlewareFn(req)
    expect(mockNextResponseRedirect).not.toHaveBeenCalled()
    expect(result).toBeUndefined()
  })

  it("does NOT redirect when an unauthenticated user visits /sign-up", () => {
    const req = makeRequest("/sign-up", null)
    const result = capturedMiddlewareFn(req)
    expect(mockNextResponseRedirect).not.toHaveBeenCalled()
    expect(result).toBeUndefined()
  })

  it("does NOT redirect when an authenticated user visits a protected route", () => {
    const req = makeRequest("/dashboard", { sub: "abc123" })
    const result = capturedMiddlewareFn(req)
    expect(mockNextResponseRedirect).not.toHaveBeenCalled()
    expect(result).toBeUndefined()
  })

  it("does NOT redirect when an authenticated user visits /", () => {
    const req = makeRequest("/", { sub: "abc123" })
    const result = capturedMiddlewareFn(req)
    expect(mockNextResponseRedirect).not.toHaveBeenCalled()
    expect(result).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// config.matcher
// ---------------------------------------------------------------------------
describe("middleware — config.matcher", () => {
  it("exports a matcher array with exactly one pattern", () => {
    expect(Array.isArray(config.matcher)).toBe(true)
    expect(config.matcher).toHaveLength(1)
  })

  // We test the pattern as a string rather than re-implementing the regex to
  // avoid false precision — we verify the key exclusions are present.

  it("the matcher pattern string contains exclusions for sign-in", () => {
    expect(config.matcher[0]).toContain("sign-in")
  })

  it("the matcher pattern string contains exclusions for sign-up", () => {
    expect(config.matcher[0]).toContain("sign-up")
  })

  it("the matcher pattern string contains exclusions for api/auth", () => {
    expect(config.matcher[0]).toContain("api/auth")
  })

  it("the matcher pattern string contains exclusions for _next/static", () => {
    expect(config.matcher[0]).toContain("_next/static")
  })

  it("the matcher pattern string contains exclusions for _next/image", () => {
    expect(config.matcher[0]).toContain("_next/image")
  })

  it("the matcher pattern string contains exclusions for favicon.ico", () => {
    expect(config.matcher[0]).toContain("favicon.ico")
  })

  it("the matcher is a string (not a RegExp object) so Next.js can serialise it", () => {
    expect(typeof config.matcher[0]).toBe("string")
  })
})
