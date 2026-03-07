"use client"

import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Alert,
} from "@heroui/react"
import type { SerializedExpense } from "../page"

type Props = {
  isOpen: boolean
  onClose: () => void
  expense: SerializedExpense
  onConfirm: () => void
  isPending: boolean
  error: string | null
}

export function DeleteConfirmModal({
  isOpen,
  onClose,
  expense,
  onConfirm,
  isPending,
  error,
}: Props) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm" isDismissable={!isPending}>
      <ModalContent>
        <ModalHeader>Delete Expense</ModalHeader>
        <ModalBody>
          {error && (
            <Alert color="danger" title="Error" description={error} className="mb-2" />
          )}
          <p className="text-default-600">
            Are you sure you want to delete{" "}
            <strong>&quot;{expense.description}&quot;</strong>? This action
            cannot be undone.
          </p>
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={onClose} isDisabled={isPending}>
            Cancel
          </Button>
          <Button color="danger" onPress={onConfirm} isLoading={isPending}>
            Delete
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
