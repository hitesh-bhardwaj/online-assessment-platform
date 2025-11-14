"use client"

import Image from "next/image"
import Link from "next/link"
import { Suspense, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

interface RequestLinkResponse {
  success: boolean
  message: string
  verificationToken?: string
  verificationLink?: string
}

interface CompleteResponse {
  success: boolean
  message: string
}

type Plan = "free" | "basic" | "premium"

const PLAN_COPY: Record<Plan, { title: string; description: string }> = {
  free: {
    title: "Free",
    description: "Kick the tires with up to 5 assessments and email invites",
  },
  basic: {
    title: "Growth",
    description: "Unlock team management and priority email support",
  },
  premium: {
    title: "Enterprise",
    description: "Advanced analytics, proctoring, and dedicated support",
  },
}

function SignupPageContent() {
  const params = useSearchParams()
  const router = useRouter()

  const tokenFromUrl = params.get("token")?.trim() ?? ""
  const emailFromUrl = params.get("email")?.trim() ?? ""

  const [step, setStep] = useState<"request" | "complete">(tokenFromUrl ? "complete" : "request")
  const [token, setToken] = useState<string>(tokenFromUrl)
  const [requesting, setRequesting] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [requestError, setRequestError] = useState<string | null>(null)
  const [completeError, setCompleteError] = useState<string | null>(null)
  const [requestSuccess, setRequestSuccess] = useState<RequestLinkResponse | null>(null)
  const [completeSuccess, setCompleteSuccess] = useState<string | null>(null)

  const [email, setEmail] = useState("")
  const [organizationName, setOrganizationName] = useState("")
  const [domain, setDomain] = useState("")
  const [plan, setPlan] = useState<Plan>("free")
  const [adminFirstName, setAdminFirstName] = useState("")
  const [adminLastName, setAdminLastName] = useState("")
  const [adminPassword, setAdminPassword] = useState("")

  useEffect(() => {
    if (tokenFromUrl) {
      setToken(tokenFromUrl)
      setStep("complete")
    }
  }, [tokenFromUrl])

  useEffect(() => {
    if (step === "complete") {
      setEmail(emailFromUrl)
      if (emailFromUrl && !adminFirstName && !adminLastName) {
        const localPart = emailFromUrl.split("@")[0] ?? "admin"
        const segments = localPart
          .split(/[-_.\s]+/)
          .filter(Boolean)
          .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())

        if (!adminFirstName) {
          setAdminFirstName(segments[0] ?? "Admin")
        }
        if (!adminLastName) {
          setAdminLastName(segments.length > 1 ? segments.slice(1).join(" ") : "Owner")
        }
      }
    }
  }, [step, emailFromUrl, adminFirstName, adminLastName])

  const handleRequestLink = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setRequestError(null)
    setRequestSuccess(null)
    setRequesting(true)

    try {
      const response = await fetch("/api/signup/request-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })

      const payload = (await response.json()) as RequestLinkResponse

      if (!response.ok) {
        throw new Error(payload.message || "We couldn't send the verification email.")
      }

      setRequestSuccess(payload)
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : "Something went wrong. Try again.")
    } finally {
      setRequesting(false)
    }
  }

  const handleComplete = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setCompleteError(null)
    setCompleteSuccess(null)
    setCompleting(true)

    try {
      const payload = {
        token,
        organizationName: organizationName.trim(),
        domain: domain.trim() || undefined,
        plan,
        admin: {
          firstName: adminFirstName.trim(),
          lastName: adminLastName.trim(),
          password: adminPassword,
        },
      }

      const response = await fetch("/api/signup/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const body = (await response.json()) as CompleteResponse

      if (!response.ok) {
        throw new Error(body.message || "Unable to complete signup.")
      }

      setCompleteSuccess(body.message)
      setTimeout(() => {
        router.replace("/login")
      }, 1500)
    } catch (error) {
      setCompleteError(error instanceof Error ? error.message : "Something went wrong. Try again.")
    } finally {
      setCompleting(false)
    }
  }

  const stepDescription = useMemo(() => {
    if (completeSuccess) {
      return "You're all set. Redirecting to login…"
    }
    if (step === "complete") {
      return "Tell us about your organization to finish setting things up."
    }
    return "Start by verifying your work email so we know where to send your assessments."
  }, [step, completeSuccess])

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden">
      <Image
        src="/assets/background-img.jpg"
        alt="Collaborative workspace illustration"
        fill
        priority
        className="object-cover"
        sizes="100vw"
      />
      <div className="relative z-10 flex w-full max-w-xl justify-center px-6 py-16 md:py-24 bg-black/20 rounded-2xl border border-white/20 shadow-2xl backdrop-blur-lg">
        <div className="flex w-full max-w-xl flex-col gap-6">
          <div className="space-y-2 text-slate-100 drop-shadow-lg">
            <h1 className="text-3xl font-semibold tracking-tight">
              {step === "request" ? "Create your organization" : "Finalize your workspace"}
            </h1>
            <p className="text-sm text-slate-100/80">{stepDescription}</p>
          </div>
          <div className="rounded-2xl border border-white/20 bg-white/10 p-8 shadow-2xl backdrop-blur-lg">
            {step === "request" ? (
              <form onSubmit={handleRequestLink} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-100">
                    Work email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="alex@yourcompany.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="bg-white/80 text-slate-900 placeholder:text-slate-500"
                  />
                </div>
                {requestError ? (
                  <Alert variant="destructive">
                    <AlertTitle>We couldn&apos;t send the link</AlertTitle>
                    <AlertDescription>{requestError}</AlertDescription>
                  </Alert>
                ) : null}
                {requestSuccess ? (
                  <Alert>
                    <AlertTitle>Verification sent</AlertTitle>
                    <AlertDescription>
                      Check your email for a link to finish creating your organization. The link expires in 24 hours.
                    </AlertDescription>
                  </Alert>
                ) : null}
                <Button type="submit" className="w-full" disabled={requesting}>
                  {requesting ? "Sending…" : "Send verification link"}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleComplete} className="space-y-6">
                {!token || !emailFromUrl ? (
                  <Alert variant="destructive">
                    <AlertTitle>Verification required</AlertTitle>
                    <AlertDescription>
                      This signup link is missing required information. Request a new verification email to continue.
                    </AlertDescription>
                  </Alert>
                ) : null}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-slate-100">Email</Label>
                    <Input
                      value={emailFromUrl || email}
                      disabled
                      placeholder="email@example.com"
                      className="bg-white/50 text-slate-900 placeholder:text-slate-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="organizationName" className="text-slate-100">
                      Organization name
                    </Label>
                    <Input
                      id="organizationName"
                      required
                      value={organizationName}
                      onChange={(event) => setOrganizationName(event.target.value)}
                      placeholder="Enigma Digital"
                      className="bg-white/80 text-slate-900 placeholder:text-slate-500"
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="adminFirstName" className="text-slate-100">
                        First name
                      </Label>
                      <Input
                        id="adminFirstName"
                        required
                        value={adminFirstName}
                        onChange={(event) => setAdminFirstName(event.target.value)}
                        className="bg-white/80 text-slate-900 placeholder:text-slate-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="adminLastName" className="text-slate-100">
                        Last name
                      </Label>
                      <Input
                        id="adminLastName"
                        required
                        value={adminLastName}
                        onChange={(event) => setAdminLastName(event.target.value)}
                        className="bg-white/80 text-slate-900 placeholder:text-slate-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="domain" className="text-slate-100">
                      Primary domain (optional)
                    </Label>
                    <Input
                      id="domain"
                      value={domain}
                      onChange={(event) => setDomain(event.target.value)}
                      placeholder="enigmadigital.com"
                      className="bg-white/80 text-slate-900 placeholder:text-slate-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="adminPassword" className="text-slate-100">
                      Password
                    </Label>
                    <Input
                      id="adminPassword"
                      type="password"
                      autoComplete="new-password"
                      required
                      value={adminPassword}
                      onChange={(event) => setAdminPassword(event.target.value)}
                      className="bg-white/80 text-slate-900 placeholder:text-slate-500"
                    />
                    <p className="text-xs text-slate-100/80">
                      Use at least 8 characters with uppercase, lowercase, and a number.
                    </p>
                  </div>
                </div>

                <Separator className="bg-white/20" />

                <div className="space-y-3">
                  <Label className="text-slate-100">Plan</Label>
                  <RadioGroup value={plan} onValueChange={(value) => setPlan(value as Plan)} className="grid gap-3">
                    {(Object.keys(PLAN_COPY) as Plan[]).map((key) => (
                      <label
                        key={key}
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-xl border border-white/20 bg-white/5 p-4 transition-colors backdrop-blur-sm",
                          plan === key && "border-primary bg-primary/20"
                        )}
                      >
                        <RadioGroupItem value={key} className="mt-1" />
                        <div>
                          <div className="font-medium capitalize text-slate-100">{PLAN_COPY[key].title}</div>
                          <p className="text-sm text-slate-100/80">{PLAN_COPY[key].description}</p>
                        </div>
                      </label>
                    ))}
                  </RadioGroup>
                </div>

                {completeError ? (
                  <Alert variant="destructive">
                    <AlertTitle>We couldn&apos;t finish signup</AlertTitle>
                    <AlertDescription>{completeError}</AlertDescription>
                  </Alert>
                ) : null}
                {completeSuccess ? (
                  <Alert>
                    <AlertTitle>Organization created</AlertTitle>
                    <AlertDescription>{completeSuccess}</AlertDescription>
                  </Alert>
                ) : null}

                <div className="flex flex-col gap-2">
                  <Button type="submit" disabled={completing || !token || !emailFromUrl}>
                    {completing ? "Finalizing…" : "Create organization"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-slate-100 hover:bg-white/10 hover:text-slate-100"
                    onClick={() => {
                      setCompleteError(null)
                      setCompleteSuccess(null)
                      setOrganizationName("")
                      setDomain("")
                      setAdminFirstName("")
                      setAdminLastName("")
                      setAdminPassword("")
                      setToken("")
                      setEmail("")
                      setPlan("free")
                      setRequestSuccess(null)
                      setRequestError(null)
                      setStep("request")
                      router.replace("/signup")
                    }}
                  >
                    Start over
                  </Button>
                </div>
              </form>
            )}
          </div>
          <p className="text-sm text-slate-100">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

// Loading fallback for Suspense
function SignupPageFallback() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden">
      <Image
        src="/assets/background-img.jpg"
        alt="Collaborative workspace illustration"
        fill
        priority
        className="object-cover"
        sizes="100vw"
      />
      <div className="relative z-10 flex w-full max-w-xl justify-center px-6 py-16 md:py-24 bg-black/20 rounded-2xl border border-white/20 shadow-2xl backdrop-blur-lg">
        <div className="flex w-full max-w-xl flex-col items-center justify-center gap-6">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-primary"></div>
          <p className="text-sm text-slate-100">Loading...</p>
        </div>
      </div>
    </div>
  )
}

// Wrapper component with Suspense boundary
export default function SignupPage() {
  return (
    <Suspense fallback={<SignupPageFallback />}>
      <SignupPageContent />
    </Suspense>
  )
}
