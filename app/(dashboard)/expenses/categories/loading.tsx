"use client"

import { Spinner } from "@heroui/react"

export default function CategoriesLoading() {
  return (
    <div className="flex justify-center items-center py-24">
      <Spinner size="lg" />
    </div>
  )
}
