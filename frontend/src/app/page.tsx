"use client"

import Image from "next/image"
import Link from "next/link"
import { useSearchParams } from "next/navigation"

import { LoginPanel } from "@/components/auth/login-panel"

export default function Home() {
  const searchParams = useSearchParams()
  const nextRoute = searchParams?.get("next") ?? undefined

  return (
    <main className="relative min-h-screen overflow-hidden">
      <Image
        src="/assets/background-img.jpg"
        alt="Collaborative workspace illustration"
        fill
        priority
        className="object-cover"
        sizes="100vw"
      />
      <div className="relative z-10 mx-auto flex min-h-screen w-full flex-col gap-10 px-6 py-16 md:flex-row md:items-center md:justify-between md:gap-16 md:px-8 lg:px-12">
        <section className="max-w-xl space-y-6 text-foreground">
          <p className="inline-flex items-center rounded-full bg-background/70 px-4 py-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Modern hiring workflows
          </p>
          <h1 className="text-4xl text-background font-semibold tracking-tight drop-shadow-sm md:text-5xl">
            Build, launch, and evaluate online assessments without friction
          </h1>
          <p className="text-lg text-background/70">
            Sign in to manage your organization, invite recruiters, and review candidate performance in one secure console.
            New to the platform? Create your workspace in minutes and start assessing today.
          </p>
        </section>

        <div className="flex w-full max-w-xl flex-col justify-center items-center h-[80dvh] gap-6 bg-black/20 rounded-2xl border border-white/20 p-8 shadow-2xl backdrop-blur-lg">
          <LoginPanel nextRoute={nextRoute} />
          <p className="text-sm text-white">
            New to the platform?{" "}
            <Link href="/signup" className="font-semibold text-primary hover:underline">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}
