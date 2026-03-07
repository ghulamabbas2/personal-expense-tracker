"use client"

import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Button,
  Chip,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Input,
  Alert,
  Tooltip,
} from "@heroui/react"
import { Plus, Trash2 } from "lucide-react"
import {
  createCategorySchema,
  type CreateCategoryInput,
} from "@/lib/schemas/category"
import { createCategory, deleteCategory } from "../actions"
import type { SerializedCategory } from "../page"

type Props = {
  initialCategories: SerializedCategory[]
}

function displayName(name: string) {
  return name.charAt(0).toUpperCase() + name.slice(1)
}

export function CategoriesClient({ initialCategories }: Props) {
  const [categories, setCategories] = useState(initialCategories)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [deletingCategory, setDeletingCategory] =
    useState<SerializedCategory | null>(null)

  const [createServerError, setCreateServerError] = useState<string | null>(
    null
  )
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const [isCreatePending, startCreateTransition] = useTransition()
  const [isDeletePending, startDeleteTransition] = useTransition()

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
    reset,
  } = useForm<CreateCategoryInput>({
    resolver: zodResolver(createCategorySchema),
  })

  function openCreate() {
    reset()
    setCreateServerError(null)
    setIsCreateOpen(true)
  }

  function openDelete(category: SerializedCategory) {
    setDeletingCategory(category)
    setDeleteError(null)
    setIsDeleteOpen(true)
  }

  function onCreateSubmit(data: CreateCategoryInput) {
    setCreateServerError(null)
    startCreateTransition(async () => {
      const result = await createCategory(data)
      if (!result.success) {
        if (result.fields) {
          for (const [field, messages] of Object.entries(result.fields)) {
            setError(field as keyof CreateCategoryInput, {
              message: messages[0],
            })
          }
        } else {
          setCreateServerError(result.error)
        }
        return
      }
      if (result.data) {
        setCategories((prev) => [...prev, result.data!])
      }
      reset()
      setIsCreateOpen(false)
    })
  }

  function handleDeleteConfirm() {
    if (!deletingCategory) return
    setDeleteError(null)
    startDeleteTransition(async () => {
      const result = await deleteCategory(deletingCategory.id)
      if (!result.success) {
        setDeleteError(result.error)
        return
      }
      setCategories((prev) => prev.filter((c) => c.id !== deletingCategory.id))
      setIsDeleteOpen(false)
      setDeletingCategory(null)
    })
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button
          color="primary"
          startContent={<Plus size={16} />}
          onPress={openCreate}
        >
          Add Category
        </Button>
      </div>

      <Table aria-label="Categories table" isStriped>
        <TableHeader>
          <TableColumn>Name</TableColumn>
          <TableColumn>Type</TableColumn>
          <TableColumn>Actions</TableColumn>
        </TableHeader>
        <TableBody
          items={categories}
          emptyContent="No categories yet. Add one to get started."
        >
          {(category) => (
            <TableRow key={category.id}>
              <TableCell>{displayName(category.name)}</TableCell>
              <TableCell>
                <Chip
                  variant="flat"
                  color={category.isDefault ? "primary" : "secondary"}
                  size="sm"
                >
                  {category.isDefault ? "Default" : "Custom"}
                </Chip>
              </TableCell>
              <TableCell>
                {category.isDefault ? (
                  <Tooltip content="Default categories cannot be deleted">
                    <Button
                      isIconOnly
                      variant="light"
                      size="sm"
                      isDisabled
                      aria-label="Cannot delete default category"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </Tooltip>
                ) : (
                  <Tooltip content="Delete category" color="danger">
                    <Button
                      isIconOnly
                      variant="light"
                      size="sm"
                      color="danger"
                      aria-label="Delete category"
                      onPress={() => openDelete(category)}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </Tooltip>
                )}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {/* Create Category Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => {
          if (isCreatePending) return
          setIsCreateOpen(false)
        }}
        isDismissable={!isCreatePending}
        size="sm"
      >
        <ModalContent>
          <form onSubmit={handleSubmit(onCreateSubmit)} noValidate>
            <ModalHeader>Add Category</ModalHeader>
            <ModalBody className="gap-4">
              {createServerError && (
                <Alert
                  color="danger"
                  title="Error"
                  description={createServerError}
                />
              )}
              <Input
                {...register("name")}
                label="Category Name"
                labelPlacement="outside"
                placeholder="e.g. Subscriptions"
                isInvalid={!!errors.name}
                errorMessage={errors.name?.message}
                isRequired
              />
            </ModalBody>
            <ModalFooter>
              <Button
                variant="light"
                onPress={() => setIsCreateOpen(false)}
                isDisabled={isCreatePending}
              >
                Cancel
              </Button>
              <Button type="submit" color="primary" isLoading={isCreatePending}>
                Add Category
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteOpen}
        onClose={() => {
          if (isDeletePending) return
          setIsDeleteOpen(false)
          setDeletingCategory(null)
          setDeleteError(null)
        }}
        isDismissable={!isDeletePending}
        size="sm"
      >
        <ModalContent>
          <ModalHeader>Delete Category</ModalHeader>
          <ModalBody className="gap-4">
            {deleteError && (
              <Alert color="danger" title="Error" description={deleteError} />
            )}
            <p className="text-default-600 text-sm">
              Are you sure you want to delete{" "}
              <span className="font-semibold">
                {deletingCategory ? displayName(deletingCategory.name) : ""}
              </span>
              ? Existing expenses using this category will keep their category
              name.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="light"
              onPress={() => {
                setIsDeleteOpen(false)
                setDeletingCategory(null)
                setDeleteError(null)
              }}
              isDisabled={isDeletePending}
            >
              Cancel
            </Button>
            <Button
              color="danger"
              onPress={handleDeleteConfirm}
              isLoading={isDeletePending}
            >
              Delete
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  )
}
