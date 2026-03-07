"use client"

import { useState, useMemo, useOptimistic, useTransition } from "react"
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Input,
  Select,
  SelectItem,
  Button,
  Chip,
  Tooltip,
  Pagination,
} from "@heroui/react"
import { Plus, Pencil, Trash2, Search } from "lucide-react"
import { deleteExpense } from "../actions"
import { ExpenseModal } from "./ExpenseModal"
import { DeleteConfirmModal } from "./DeleteConfirmModal"
import type { SerializedExpense, SerializedCategory } from "../page"

const CATEGORY_COLORS: Record<
  string,
  "primary" | "success" | "warning" | "danger" | "default" | "secondary"
> = {
  food: "warning",
  transport: "primary",
  housing: "success",
  entertainment: "secondary",
  health: "danger",
  shopping: "default",
  other: "default",
}

function displayName(name: string) {
  return name.charAt(0).toUpperCase() + name.slice(1)
}

const PAGE_SIZE = 10

type SortDescriptor = {
  column: string
  direction: "ascending" | "descending"
}

export function ExpenseTable({
  expenses,
  categories,
}: {
  expenses: SerializedExpense[]
  categories: SerializedCategory[]
}) {
  const [isPendingDelete, startDeleteTransition] = useTransition()
  const [optimisticExpenses, removeOptimistically] = useOptimistic(
    expenses,
    (current: SerializedExpense[], idToRemove: string) =>
      current.filter((e) => e.id !== idToRemove)
  )

  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [page, setPage] = useState(1)
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: "date",
    direction: "descending",
  })

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<"create" | "edit">("create")
  const [editingExpense, setEditingExpense] = useState<
    SerializedExpense | undefined
  >()

  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [deletingExpense, setDeletingExpense] = useState<
    SerializedExpense | undefined
  >()
  const [deleteError, setDeleteError] = useState<string | null>(null)

  function openCreate() {
    setModalMode("create")
    setEditingExpense(undefined)
    setIsModalOpen(true)
  }

  function openEdit(expense: SerializedExpense) {
    setModalMode("edit")
    setEditingExpense(expense)
    setIsModalOpen(true)
  }

  function openDelete(expense: SerializedExpense) {
    setDeletingExpense(expense)
    setDeleteError(null)
    setIsDeleteOpen(true)
  }

  function handleDeleteConfirm() {
    if (!deletingExpense) return
    setDeleteError(null)
    startDeleteTransition(async () => {
      removeOptimistically(deletingExpense.id)
      const result = await deleteExpense(deletingExpense.id)
      if (!result.success) {
        setDeleteError(result.error)
        return
      }
      setIsDeleteOpen(false)
      setDeletingExpense(undefined)
    })
  }

  const filtered = useMemo(() => {
    let result = optimisticExpenses

    if (search) {
      const lower = search.toLowerCase()
      result = result.filter(
        (e) =>
          e.description.toLowerCase().includes(lower) ||
          e.category.toLowerCase().includes(lower)
      )
    }

    if (categoryFilter && categoryFilter !== "all") {
      result = result.filter(
        (e) => e.category.toLowerCase() === categoryFilter.toLowerCase()
      )
    }

    result = result.toSorted((a, b) => {
      const { column, direction } = sortDescriptor
      let aVal: string | number = ""
      let bVal: string | number = ""

      if (column === "date") {
        aVal = a.date
        bVal = b.date
      } else if (column === "amount") {
        aVal = a.amount
        bVal = b.amount
      } else if (column === "description") {
        aVal = a.description
        bVal = b.description
      }

      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0
      return direction === "ascending" ? cmp : -cmp
    })

    return result
  }, [optimisticExpenses, search, categoryFilter, sortDescriptor])

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 mb-4 items-end">
        <Input
          placeholder="Search expenses..."
          value={search}
          onValueChange={(val) => {
            setSearch(val)
            setPage(1)
          }}
          startContent={<Search size={16} className="text-default-400" />}
          isClearable
          onClear={() => {
            setSearch("")
            setPage(1)
          }}
          className="max-w-xs"
          aria-label="Search expenses"
        />
        <Select
          aria-label="Filter by category"
          className="max-w-48"
          selectedKeys={new Set([categoryFilter])}
          onSelectionChange={(keys) => {
            const val = Array.from(keys as Set<string>)[0] ?? "all"
            setCategoryFilter(val)
            setPage(1)
          }}
        >
          {[
            <SelectItem key="all">All Categories</SelectItem>,
            ...categories.map((cat) => (
              <SelectItem key={cat.name}>{displayName(cat.name)}</SelectItem>
            )),
          ]}
        </Select>
        <Button
          color="primary"
          startContent={<Plus size={16} />}
          onPress={openCreate}
          className="ml-auto"
        >
          Add Expense
        </Button>
      </div>

      {/* Table */}
      <Table
        aria-label="Expenses table"
        isStriped
        sortDescriptor={sortDescriptor}
        onSortChange={(descriptor) => {
          setSortDescriptor(descriptor as SortDescriptor)
          setPage(1)
        }}
        bottomContent={
          pages > 1 ? (
            <div className="flex justify-center py-2">
              <Pagination
                total={pages}
                page={page}
                onChange={setPage}
                showControls
              />
            </div>
          ) : null
        }
      >
        <TableHeader>
          <TableColumn key="date" allowsSorting>
            Date
          </TableColumn>
          <TableColumn key="description" allowsSorting>
            Description
          </TableColumn>
          <TableColumn key="category">Category</TableColumn>
          <TableColumn key="type">Type</TableColumn>
          <TableColumn key="amount" allowsSorting>
            Amount
          </TableColumn>
          <TableColumn key="actions">Actions</TableColumn>
        </TableHeader>
        <TableBody
          items={paginated}
          emptyContent={
            <div className="py-8 text-center text-default-400">
              No expenses yet.{" "}
              <button
                onClick={openCreate}
                className="text-primary underline cursor-pointer"
              >
                Add your first one.
              </button>
            </div>
          }
        >
          {(expense) => (
            <TableRow key={expense.id}>
              <TableCell>
                {new Date(expense.date).toLocaleDateString()}
              </TableCell>
              <TableCell>{expense.description}</TableCell>
              <TableCell>
                <Chip
                  variant="flat"
                  color={CATEGORY_COLORS[expense.category] ?? "default"}
                  size="sm"
                >
                  {displayName(expense.category)}
                </Chip>
              </TableCell>
              <TableCell>
                <Chip
                  variant="flat"
                  color={expense.type === "income" ? "success" : "danger"}
                  size="sm"
                >
                  {expense.type === "income" ? "Income" : "Expense"}
                </Chip>
              </TableCell>
              <TableCell>
                <span
                  className={
                    expense.type === "income" ? "text-success" : "text-danger"
                  }
                >
                  {expense.type === "income" ? "+" : "-"}$
                  {expense.amount.toFixed(2)}
                </span>
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Tooltip content="Edit expense">
                    <Button
                      isIconOnly
                      variant="light"
                      size="sm"
                      aria-label="Edit expense"
                      onPress={() => openEdit(expense)}
                    >
                      <Pencil size={16} />
                    </Button>
                  </Tooltip>
                  <Tooltip content="Delete expense" color="danger">
                    <Button
                      isIconOnly
                      variant="light"
                      size="sm"
                      color="danger"
                      aria-label="Delete expense"
                      onPress={() => openDelete(expense)}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </Tooltip>
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <ExpenseModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        mode={modalMode}
        expense={editingExpense}
        categories={categories}
      />

      {deletingExpense && (
        <DeleteConfirmModal
          isOpen={isDeleteOpen}
          onClose={() => {
            setIsDeleteOpen(false)
            setDeletingExpense(undefined)
            setDeleteError(null)
          }}
          expense={deletingExpense}
          onConfirm={handleDeleteConfirm}
          isPending={isPendingDelete}
          error={deleteError}
        />
      )}
    </>
  )
}
