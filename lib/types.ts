export type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string; fields?: Record<string, string[]> }
