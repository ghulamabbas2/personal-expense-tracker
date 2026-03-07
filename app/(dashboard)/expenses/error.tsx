"use client"

import { Alert, Button } from "@heroui/react"

export default function ExpensesError({
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col gap-4">
      <Alert
        color="danger"
        title="Something went wrong"
        description="We couldn't load your expenses. Please try again."
      />
      <Button color="primary" variant="flat" onPress={reset} className="w-fit">
        Try again
      </Button>
    </div>
  )
}
