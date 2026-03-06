# UI Design Specification — Personal Expense Tracker

## Overview

The UI is built exclusively with [HeroUI](https://heroui.com) components. No custom CSS, no inline styles, and no additional UI libraries. All layout, spacing, typography, color, and interactivity come from HeroUI's component API and its built-in theming system.

The design is clean, modern, and production-ready — focused on clarity, fast data entry, and effortless navigation across all screen sizes.

---

## Tech Stack

- **UI Library**: HeroUI (`@heroui/react`)
- **Framework**: Next.js (App Router)
- **Styling**: HeroUI's built-in Tailwind-based theming (no custom CSS)
- **Icons**: `lucide-react` (used inside HeroUI `startContent`/`endContent` slots only)

---

## Theme & Design Tokens

Use HeroUI's `HeroUIProvider` at the root layout with a custom theme:

- **Color scheme**: `light` default, with full `dark` mode support via `HeroUIProvider`
- **Primary color**: Violet (`primary: "violet"`)
- **Radius**: `"md"` (consistent medium rounding across all components)
- **Font**: System font stack via HeroUI's default typography

No custom color values. All colors reference HeroUI semantic tokens (`primary`, `success`, `danger`, `warning`, `default`).

---

## Layout

### Root Layout (`app/layout.tsx`)

- Wrap the entire app in `HeroUIProvider` with `navigate` wired to Next.js router
- Use `NextThemesProvider` for dark/light mode persistence
- No wrapper `div` with custom classes — rely on HeroUI's layout primitives

### Shell

The app shell uses a `Navbar` component at the top, with a `main` content area below.

**Navbar:**
- `Navbar` with `isBordered` and `isBlurred` for a frosted-glass effect on scroll
- `NavbarBrand`: app name ("Expense Tracker") in `NavbarBrand` with a wallet icon
- `NavbarContent` (end): `ThemeSwitch` toggle (Moon/Sun icon in a `Button` with `isIconOnly` and `variant="light"`), and a user `Avatar` with `showFallback`
- On mobile: `NavbarMenuToggle` + `NavbarMenu` with `NavbarMenuItem` links for full navigation

---

## Pages

### 1. Authentication Pages

#### Sign In (`/sign-in`)

- Centered on screen using HeroUI `Card` with `shadow="md"` and `radius="lg"`
- `CardHeader`: App logo/title
- `CardBody`:
  - `Input` for email (`type="email"`, `label="Email"`, `labelPlacement="outside"`, `startContent` with mail icon)
  - `Input` for password (`type="password"`, `label="Password"`, `labelPlacement="outside"`, `startContent` with lock icon, `endContent` with show/hide toggle)
  - `Checkbox` for "Remember me"
  - `Button` (`color="primary"`, `fullWidth`, `size="lg"`) to submit
- `CardFooter`: Link to sign-up page using HeroUI `Link`
- Form validation errors shown via `Input`'s `isInvalid` and `errorMessage` props

#### Sign Up (`/sign-up`)

Same card layout as Sign In, with additional fields:
- `Input` for full name
- Email, password, confirm password inputs
- `Button` to create account
- `CardFooter`: Link back to sign-in

---

### 2. Dashboard (`/`)

The main overview screen. Uses a responsive grid layout via HeroUI's `div` wrapping with Tailwind grid classes from HeroUI theme.

#### Summary Cards (top row)

Four `Card` components in a responsive grid (1 col on mobile, 2 on tablet, 4 on desktop):

| Card | Content |
|---|---|
| Total Balance | Large number, trend chip |
| Monthly Spending | Amount vs budget, `Progress` bar |
| Top Category | Category name + icon |
| Savings Rate | Percentage, colored `Chip` |

Each card uses:
- `CardHeader` with label + icon in `startContent`
- `CardBody` with `Snippet`-style number display
- `Chip` with `color="success"` or `color="danger"` for trend indicators

#### Recent Transactions Table

- `Table` with `isStriped`, `selectionMode="none"`, `aria-label="Recent transactions"`
- Columns: Date, Description, Category, Amount
- Amount column: positive values in `Chip color="success"`, negative in `Chip color="danger"`
- Category: `Chip variant="flat"` with category color
- `TableBody` uses `emptyContent` prop for zero-state message
- "View All" link in `CardHeader` using HeroUI `Link` with arrow icon

#### Spending by Category Chart Placeholder

- `Card` with `CardHeader` ("Spending by Category") and `CardBody`
- A descriptive list using `Listbox` with `ListboxItem` for each category
- Each item shows category name (left) and amount (right) with a `Progress` bar below

---

### 3. Expenses List (`/expenses`)

Full transaction history with filtering and sorting.

#### Toolbar

Horizontal `div` (flex wrap) with:
- `Input` (`placeholder="Search expenses..."`, `startContent` search icon, `isClearable`)
- `Select` for category filter (`label="Category"`, `selectionMode="single"`)
- `Select` for date range (`label="Date Range"`)
- `Button` (`color="primary"`, `startContent` with plus icon) to open Add Expense modal

#### Expenses Table

- `Table` with `isStriped`, `sortDescriptor` state for column sorting, `selectionMode="multiple"` for bulk actions
- Columns: Checkbox, Date, Description, Category, Amount, Actions
- Actions column: `Tooltip`-wrapped `Button` icons for Edit and Delete (`variant="light"`, `isIconOnly`)
- `TablePagination` via HeroUI `Pagination` component below the table, `total` and `onChange` wired to state

#### Empty State

When no expenses: `CardBody` with centered text and a `Button` to add the first expense.

---

### 4. Add / Edit Expense (`Modal`)

Triggered from the toolbar button or table row edit action. Uses a `Modal` (not a page).

- `Modal` with `size="lg"`, `isDismissable`, `scrollBehavior="inside"`
- `ModalHeader`: "Add Expense" or "Edit Expense"
- `ModalBody`:
  - `Input` for description (`label="Description"`, `labelPlacement="outside"`, `isRequired`)
  - `Input` for amount (`type="number"`, `label="Amount"`, `labelPlacement="outside"`, `startContent="$"`, `isRequired`)
  - `Select` for category (`label="Category"`, `labelPlacement="outside"`, `isRequired`)
    - Options: Food, Transport, Housing, Entertainment, Health, Shopping, Other
  - `DatePicker` (`label="Date"`, `labelPlacement="outside"`, `isRequired`) — HeroUI's built-in date picker
  - `Textarea` for notes (`label="Notes"`, `labelPlacement="outside"`, `minRows={2}`)
  - `RadioGroup` for type: Income / Expense (`orientation="horizontal"`)
- `ModalFooter`:
  - `Button variant="light"` to cancel (closes modal)
  - `Button color="primary"` to save
- `isLoading` prop on the save button during async submission

---

### 5. Budget Settings (`/settings/budget`)

- `Card` per category with:
  - `CardHeader`: category name + icon
  - `CardBody`:
    - `Input` for monthly budget amount
    - `Progress` showing current spend vs budget
    - `Chip` showing remaining amount (`color="success"` if under, `color="danger"` if over)
- Save changes via `Button color="primary"` at the bottom of the page

---

### 6. Profile / Account Settings (`/settings/profile`)

- `Card` layout
- `CardHeader`: `Avatar` (large, `showFallback`) + user name + email
- `CardBody` with a `Tabs` component:
  - **Profile tab**: Inputs for name, email, avatar URL — `Button` to save
  - **Security tab**: Inputs for current password, new password, confirm — `Button` to update
  - **Preferences tab**: `Switch` for dark mode, `Select` for currency, `Select` for date format

---

## Responsive Behavior

All layouts are responsive using HeroUI's built-in responsive props (no custom media queries):

- `Navbar`: collapses to hamburger menu with `NavbarMenu` on small screens
- Summary cards: CSS grid via Tailwind classes in HeroUI theme (`sm:grid-cols-2`, `lg:grid-cols-4`)
- Tables: `Table` with `removeWrapper` on mobile, horizontal scroll via `overflow="scroll"` wrapper
- Modals: `size="full"` on mobile via `classNames` override using HeroUI's responsive class API

---

## Accessibility

All HeroUI components are built on React Aria and meet WCAG 2.1 AA standards out of the box:

- All interactive elements have `aria-label` or visible labels
- `Input` uses `label` prop (not placeholder-only) for proper labeling
- `Table` has `aria-label`
- Focus management in `Modal` is handled by HeroUI automatically
- Color is never the only indicator — icons and text accompany all `Chip` status colors
- `Tooltip` is used for icon-only buttons to communicate their purpose
- `isDisabled` state is used (not `disabled` HTML attr) so HeroUI handles ARIA correctly

---

## Component Reference Summary

| Purpose | HeroUI Component |
|---|---|
| Page navigation | `Navbar`, `NavbarBrand`, `NavbarContent`, `NavbarItem`, `NavbarMenu`, `NavbarMenuItem`, `NavbarMenuToggle` |
| Cards / panels | `Card`, `CardHeader`, `CardBody`, `CardFooter` |
| Forms | `Input`, `Select`, `SelectItem`, `Textarea`, `Checkbox`, `RadioGroup`, `Radio`, `Switch`, `DatePicker` |
| Data display | `Table`, `TableHeader`, `TableColumn`, `TableBody`, `TableRow`, `TableCell` |
| Status / labels | `Chip`, `Badge` |
| Progress | `Progress` |
| Dialogs | `Modal`, `ModalContent`, `ModalHeader`, `ModalBody`, `ModalFooter` |
| Navigation aids | `Tabs`, `Tab`, `Link`, `Breadcrumbs`, `BreadcrumbItem` |
| Pagination | `Pagination` |
| Feedback | `Tooltip`, `Spinner` |
| User identity | `Avatar` |
| Buttons | `Button` |
| Menus | `Dropdown`, `DropdownTrigger`, `DropdownMenu`, `DropdownItem` |
| Notifications | `addToast` (HeroUI toast system) |
