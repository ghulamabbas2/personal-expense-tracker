"use client"

import { useState } from "react"
import { signOut } from "next-auth/react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import {
  Navbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
  NavbarMenu,
  NavbarMenuItem,
  NavbarMenuToggle,
  Avatar,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  DropdownSection,
} from "@heroui/react"
import { Wallet, LogOut } from "lucide-react"

const NAV_LINKS = [
  { href: "/expenses", label: "Expenses" },
  { href: "/expenses/categories", label: "Categories" },
]

interface AppNavbarProps {
  name: string
  email: string
}

export function AppNavbar({ name, email }: AppNavbarProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const pathname = usePathname()

  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  function handleSignOut() {
    signOut({ callbackUrl: "/sign-in" })
  }

  return (
    <Navbar
      isBordered
      isBlurred
      isMenuOpen={isMenuOpen}
      onMenuOpenChange={setIsMenuOpen}
      maxWidth="xl"
    >
      {/* Mobile menu toggle */}
      <NavbarContent justify="start" className="sm:hidden">
        <NavbarMenuToggle
          aria-label={isMenuOpen ? "Close menu" : "Open menu"}
        />
      </NavbarContent>

      {/* Brand */}
      <NavbarContent justify="start" className="hidden sm:flex">
        <NavbarBrand as={Link} href="/" className="cursor-pointer">
          <Wallet className="h-6 w-6 text-primary mr-2" aria-hidden="true" />
          <span className="font-bold text-inherit text-lg">Expense Tracker</span>
        </NavbarBrand>
      </NavbarContent>

      {/* Centered brand on mobile */}
      <NavbarContent justify="center" className="sm:hidden">
        <NavbarBrand as={Link} href="/" className="cursor-pointer">
          <Wallet className="h-6 w-6 text-primary mr-2" aria-hidden="true" />
          <span className="font-bold text-inherit">Expense Tracker</span>
        </NavbarBrand>
      </NavbarContent>

      {/* Desktop nav links */}
      <NavbarContent justify="center" className="hidden sm:flex gap-4">
        {NAV_LINKS.map(({ href, label }) => (
          <NavbarItem key={href} isActive={pathname === href}>
            <Link
              href={href}
              className={
                pathname === href
                  ? "text-primary font-medium"
                  : "text-default-600 hover:text-foreground"
              }
            >
              {label}
            </Link>
          </NavbarItem>
        ))}
      </NavbarContent>

      {/* Right side: user avatar + dropdown */}
      <NavbarContent justify="end">
        <NavbarItem>
          <Dropdown placement="bottom-end">
            <DropdownTrigger>
              <Avatar
                as="button"
                showFallback
                name={initials}
                size="sm"
                className="cursor-pointer transition-opacity hover:opacity-80"
                aria-label="Open user menu"
              />
            </DropdownTrigger>
            <DropdownMenu aria-label="User menu" variant="flat">
              <DropdownSection showDivider>
                <DropdownItem
                  key="profile"
                  isReadOnly
                  className="cursor-default opacity-100"
                  textValue={`${name} — ${email}`}
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-semibold">{name}</span>
                    <span className="text-xs text-default-400">{email}</span>
                  </div>
                </DropdownItem>
              </DropdownSection>
              <DropdownSection>
                <DropdownItem
                  key="logout"
                  color="danger"
                  startContent={<LogOut className="h-4 w-4" aria-hidden="true" />}
                  onPress={handleSignOut}
                >
                  Sign out
                </DropdownItem>
              </DropdownSection>
            </DropdownMenu>
          </Dropdown>
        </NavbarItem>
      </NavbarContent>

      {/* Mobile menu */}
      <NavbarMenu>
        <NavbarMenuItem>
          <div className="flex flex-col gap-0.5 py-2">
            <span className="text-sm font-semibold">{name}</span>
            <span className="text-xs text-default-400">{email}</span>
          </div>
        </NavbarMenuItem>
        {NAV_LINKS.map(({ href, label }) => (
          <NavbarMenuItem key={href}>
            <Link
              href={href}
              className={
                pathname === href
                  ? "text-primary font-medium text-sm"
                  : "text-default-600 text-sm"
              }
              onClick={() => setIsMenuOpen(false)}
            >
              {label}
            </Link>
          </NavbarMenuItem>
        ))}
        <NavbarMenuItem>
          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-2 text-danger text-sm py-1"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Sign out
          </button>
        </NavbarMenuItem>
      </NavbarMenu>
    </Navbar>
  )
}
