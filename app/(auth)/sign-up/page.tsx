"use client"

import { useState, useTransition } from "react"
import { signIn } from "next-auth/react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  Input,
  Button,
  Link,
  Alert,
} from "@heroui/react"
import { Mail, Lock, Eye, EyeOff, User, Wallet } from "lucide-react"
import { signUpSchema, type SignUpInput } from "@/lib/schemas/auth"
import { registerUser } from "./actions"

export default function SignUpPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
  })

  function onSubmit(data: SignUpInput) {
    setServerError(null)
    startTransition(async () => {
      const result = await registerUser(data)

      if (!result.success) {
        if (result.fields) {
          for (const [field, messages] of Object.entries(result.fields)) {
            setError(field as keyof SignUpInput, { message: messages[0] })
          }
        } else {
          setServerError(result.error)
        }
        return
      }

      const signInResult = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
        callbackUrl: "/",
      })

      if (signInResult?.error) {
        setServerError("Account created. Please sign in.")
        window.location.href = "/sign-in"
        return
      }

      window.location.href = "/"
    })
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md" shadow="md" radius="lg">
        <CardHeader className="flex flex-col items-center gap-2 pb-0 pt-6">
          <div className="flex items-center gap-2">
            <Wallet className="h-7 w-7 text-primary" />
            <span className="text-2xl font-bold">Expense Tracker</span>
          </div>
          <p className="text-default-500 text-sm">Create your account</p>
        </CardHeader>

        <CardBody className="gap-4 px-6 py-6">
          {serverError && (
            <Alert
              color="danger"
              title="Registration failed"
              description={serverError}
            />
          )}

          <form
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            className="flex flex-col gap-4"
          >
            <Input
              {...register("name")}
              type="text"
              label="Full Name"
              labelPlacement="outside"
              placeholder="Jane Doe"
              startContent={<User className="h-4 w-4 text-default-400" />}
              isInvalid={!!errors.name}
              errorMessage={errors.name?.message}
            />

            <Input
              {...register("email")}
              type="email"
              label="Email"
              labelPlacement="outside"
              placeholder="you@example.com"
              startContent={<Mail className="h-4 w-4 text-default-400" />}
              isInvalid={!!errors.email}
              errorMessage={errors.email?.message}
            />

            <Input
              {...register("password")}
              type={showPassword ? "text" : "password"}
              label="Password"
              labelPlacement="outside"
              placeholder="Min. 8 characters"
              startContent={<Lock className="h-4 w-4 text-default-400" />}
              endContent={
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-default-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-default-400" />
                  )}
                </button>
              }
              isInvalid={!!errors.password}
              errorMessage={errors.password?.message}
            />

            <Input
              {...register("confirmPassword")}
              type={showConfirm ? "text" : "password"}
              label="Confirm Password"
              labelPlacement="outside"
              placeholder="Repeat your password"
              startContent={<Lock className="h-4 w-4 text-default-400" />}
              endContent={
                <button
                  type="button"
                  aria-label={showConfirm ? "Hide password" : "Show password"}
                  onClick={() => setShowConfirm((v) => !v)}
                >
                  {showConfirm ? (
                    <EyeOff className="h-4 w-4 text-default-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-default-400" />
                  )}
                </button>
              }
              isInvalid={!!errors.confirmPassword}
              errorMessage={errors.confirmPassword?.message}
            />

            <Button
              type="submit"
              color="primary"
              fullWidth
              size="lg"
              isLoading={isPending}
            >
              Create Account
            </Button>
          </form>
        </CardBody>

        <CardFooter className="justify-center pb-6">
          <p className="text-default-500 text-sm">
            Already have an account?{" "}
            <Link href="/sign-in" size="sm">
              Sign in
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
