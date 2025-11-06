"use client"

import Image from "next/image"
import Link from "next/link"
import { useSearchParams } from "next/navigation"

import { LoginPanel } from "@/components/auth/login-panel"

export default function LoginPage() {
  const searchParams = useSearchParams()
  const nextRoute = searchParams?.get("next") ?? undefined

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden">
      <Image
        src="/assets/background-img.jpg"
        alt="Workspace background"
        fill
        priority
        className="object-cover"
        sizes="100vw"
      />
      <div className="relative z-10 flex w-full max-w-xl justify-center px-6 py-16 md:py-24 bg-black/20 rounded-2xl border border-white/20 shadow-2xl backdrop-blur-lg">
        <div className="flex w-full max-w-xl flex-col items-end justify-center gap-6">
          <LoginPanel nextRoute={nextRoute} />
          <p className="text-sm text-slate-100">
            Need an organization account?{" "}
            <Link href="/signup" className="font-semibold text-primary hover:underline">
              Start a free trial
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
