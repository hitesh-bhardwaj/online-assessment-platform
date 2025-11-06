"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { CheckCircle2, XCircle, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { apiRequest } from "@/lib/api-client"

function VerifyEmailContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams?.get("token")

  const [isVerifying, setIsVerifying] = useState(true)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setError("Invalid verification link - token is missing")
      setIsVerifying(false)
      return
    }

    const verifyEmail = async () => {
      try {
        const response = await apiRequest({
          method: "POST",
          url: "/auth/verify-email",
          data: { token },
        })

        if (response.success) {
          setSuccess(true)
          setEmail(response.data?.email)
          setTimeout(() => {
            router.push("/login")
          }, 3000)
        } else {
          setError(response.message || "Verification failed")
        }
      } catch (err: any) {
        setError(err.message || "Failed to verify email")
      } finally {
        setIsVerifying(false)
      }
    }

    verifyEmail()
  }, [token, router])

  if (isVerifying) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="mx-auto h-12 w-12 animate-spin text-blue-600" />
              <p className="mt-4 text-lg font-medium text-foreground">Verifying your email...</p>
              <p className="mt-2 text-sm text-muted-foreground">Please wait a moment</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
            <CardTitle className="text-destructive">Verification Failed</CardTitle>
            <CardDescription>
              {error}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm text-amber-800">
                <strong>Common issues:</strong>
                <br />
                • The link may have expired (valid for 24 hours)
                <br />
                • The link may have already been used
                <br />
                • The email may already be verified
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Link href="/login" className="w-full">
                <Button className="w-full">Go to Login</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <CardTitle className="text-green-700">Email Verified Successfully!</CardTitle>
            <CardDescription>
              {email && `Your email ${email} has been verified.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center">
              <p className="text-sm text-green-800">
                <strong>🎉 All set!</strong>
                <br />
                Your account is now fully activated. You can log in and start using all features.
              </p>
            </div>
            <p className="text-center text-sm text-muted-foreground">
              Redirecting to login page in 3 seconds...
            </p>
            <Link href="/login">
              <Button className="w-full">Continue to Login</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return null
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-600" />
          <p className="mt-4 text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  )
}
