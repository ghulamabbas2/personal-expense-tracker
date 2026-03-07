"use client"

import { useState, useTransition, useEffect } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Select,
  SelectItem,
  Textarea,
  RadioGroup,
  Radio,
  Alert,
} from "@heroui/react"
import {
  createExpenseSchema,
  type CreateExpenseInput,
} from "@/lib/schemas/expense"
import { createExpense, updateExpense } from "../actions"
import type { SerializedExpense, SerializedCategory } from "../page"

function displayName(name: string) {
  return name.charAt(0).toUpperCase() + name.slice(1)
}

type Props = {
  isOpen: boolean
  onClose: () => void
  mode: "create" | "edit"
  expense?: SerializedExpense
  categories: SerializedCategory[]
}

export function ExpenseModal({ isOpen, onClose, mode, expense, categories }: Props) {
  const [serverError, setServerError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    setError,
    reset,
  } = useForm<CreateExpenseInput>({
    resolver: zodResolver(createExpenseSchema),
    defaultValues: {
      type: "expense",
      date: new Date(),
      description: "",
      notes: "",
    },
  })

  useEffect(() => {
    if (!isOpen) return
    if (expense) {
      reset({
        description: expense.description,
        amount: expense.amount,
        category: expense.category as CreateExpenseInput["category"],
        type: expense.type as CreateExpenseInput["type"],
        date: new Date(expense.date),
        notes: expense.notes ?? "",
      })
    } else {
      reset({
        description: "",
        type: "expense",
        date: new Date(),
        notes: "",
      })
    }
    setServerError(null)
  }, [isOpen, expense?.id, reset])

  function handleClose() {
    if (isPending) return
    onClose()
  }

  function onSubmit(data: CreateExpenseInput) {
    setServerError(null)
    startTransition(async () => {
      const result =
        mode === "create"
          ? await createExpense(data)
          : await updateExpense(expense!.id, data)

      if (!result.success) {
        if (result.fields) {
          for (const [field, messages] of Object.entries(result.fields)) {
            setError(field as keyof CreateExpenseInput, {
              message: messages[0],
            })
          }
        } else {
          setServerError(result.error)
        }
        return
      }

      onClose()
    })
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      size="lg"
      scrollBehavior="inside"
      isDismissable={!isPending}
    >
      <ModalContent>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <ModalHeader>
            {mode === "create" ? "Add Expense" : "Edit Expense"}
          </ModalHeader>

          <ModalBody className="gap-4">
            {serverError && (
              <Alert color="danger" title="Error" description={serverError} />
            )}

            <Input
              {...register("description")}
              label="Description"
              labelPlacement="outside"
              placeholder="e.g. Grocery run"
              isInvalid={!!errors.description}
              errorMessage={errors.description?.message}
              isRequired
            />

            <Input
              {...register("amount", { valueAsNumber: true })}
              type="number"
              label="Amount"
              labelPlacement="outside"
              placeholder="0.00"
              startContent={
                <span className="text-default-400 text-sm">$</span>
              }
              isInvalid={!!errors.amount}
              errorMessage={errors.amount?.message}
              isRequired
            />

            <Controller
              name="category"
              control={control}
              render={({ field }) => (
                <Select
                  label="Category"
                  labelPlacement="outside"
                  placeholder="Select a category"
                  selectedKeys={
                    field.value ? new Set([field.value]) : new Set()
                  }
                  onSelectionChange={(keys) => {
                    const val = Array.from(keys as Set<string>)[0]
                    if (val) field.onChange(val)
                  }}
                  isInvalid={!!errors.category}
                  errorMessage={errors.category?.message}
                  isRequired
                >
                  {categories.map((cat) => (
                    <SelectItem key={cat.name}>{displayName(cat.name)}</SelectItem>
                  ))}
                </Select>
              )}
            />

            <Controller
              name="date"
              control={control}
              render={({ field }) => {
                const dateStr =
                  field.value instanceof Date
                    ? field.value.toISOString().split("T")[0]
                    : typeof field.value === "string"
                    ? field.value
                    : ""
                return (
                  <Input
                    type="date"
                    label="Date"
                    labelPlacement="outside"
                    value={dateStr}
                    onChange={(e) => field.onChange(e.target.value)}
                    isInvalid={!!errors.date}
                    errorMessage={errors.date?.message as string}
                    isRequired
                  />
                )
              }}
            />

            <Controller
              name="type"
              control={control}
              render={({ field }) => (
                <RadioGroup
                  label="Type"
                  orientation="horizontal"
                  value={field.value}
                  onValueChange={field.onChange}
                  isInvalid={!!errors.type}
                  errorMessage={errors.type?.message}
                >
                  <Radio value="expense">Expense</Radio>
                  <Radio value="income">Income</Radio>
                </RadioGroup>
              )}
            />

            <Textarea
              {...register("notes")}
              label="Notes"
              labelPlacement="outside"
              placeholder="Optional notes..."
              minRows={2}
              isInvalid={!!errors.notes}
              errorMessage={errors.notes?.message}
            />
          </ModalBody>

          <ModalFooter>
            <Button
              variant="light"
              onPress={handleClose}
              isDisabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" color="primary" isLoading={isPending}>
              {mode === "create" ? "Add Expense" : "Save Changes"}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  )
}
