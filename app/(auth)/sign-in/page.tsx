"use client"

import { Suspense, useState, useTransition } from "react"
import { useSearchParams } from "next/navigation"
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
  Spinner,
} from "@heroui/react"
import { Mail, Lock, Eye, EyeOff, Wallet } from "lucide-react"
import { signInSchema, type SignInInput } from "@/lib/schemas/auth"

function SignInForm() {
  const searchParams = useSearchParams()
  const errorParam = searchParams.get("error")
  const [showPassword, setShowPassword] = useState(false)
  const [serverError, setServerError] = useState<string | null>(
    errorParam === "CredentialsSignin" ? "Invalid email or password." : null
  )
  const [isPending, startTransition] = useTransition()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
  })

  function onSubmit(data: SignInInput) {
    setServerError(null)
    startTransition(async () => {
      const result = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
        callbackUrl: "/",
      })

      if (result?.error) {
        setServerError("Invalid email or password.")
        return
      }

      window.location.href = "/"
    })
  }

  return (
    <Card className="w-full max-w-md" shadow="md" radius="lg">
      <CardHeader className="flex flex-col items-center gap-2 pb-0 pt-6">
        <div className="flex items-center gap-2">
          <Wallet className="h-7 w-7 text-primary" />
          <span className="text-2xl font-bold">Expense Tracker</span>
        </div>
        <p className="text-default-500 text-sm">Sign in to your account</p>
      </CardHeader>

      <CardBody className="gap-4 px-6 py-6">
        {serverError && (
          <Alert
            color="danger"
            title="Sign in failed"
            description={serverError}
          />
        )}

        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="flex flex-col gap-4"
        >
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
            placeholder="Enter your password"
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

          <Button
            type="submit"
            color="primary"
            fullWidth
            size="lg"
            isLoading={isPending}
          >
            Sign In
          </Button>
        </form>
      </CardBody>

      <CardFooter className="justify-center pb-6">
        <p className="text-default-500 text-sm">
          Don&apos;t have an account?{" "}
          <Link href="/sign-up" size="sm">
            Create one
          </Link>
        </p>
      </CardFooter>
    </Card>
  )
}

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Suspense fallback={<Spinner size="lg" />}>
        <SignInForm />
      </Suspense>
    </div>
  )
}
