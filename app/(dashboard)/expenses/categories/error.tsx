"use client"

import { Alert, Button } from "@heroui/react"

export default function CategoriesError({
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return (
    <div className="flex flex-col gap-4 p-6">
      <Alert
        color="danger"
        title="Something went wrong"
        description="We couldn't load your categories. Please try again."
      />
      <Button color="primary" variant="flat" onPress={reset}>
        Try again
      </Button>
    </div>
  )
}
