"use client"

import { Spinner } from "@heroui/react"

export default function ExpensesLoading() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Spinner size="lg" />
    </div>
  )
}
