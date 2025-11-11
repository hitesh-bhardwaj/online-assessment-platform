'use client';

import React, { useMemo, useEffect, useState } from 'react'; // ⬅️ add useEffect/useState
import { SidebarInset, SidebarProvider, SidebarTrigger } from '../ui/sidebar';
import { filterNavItems, NavItem } from '@/lib/navigation';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { AppSidebar } from './app-sidebar';
import { Separator } from '../ui/separator';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '../ui/breadcrumb';

import { Bell, Moon } from 'lucide-react';

interface DashboardShellProps {
  title: string;
  subtitle: string;
  navItems: NavItem[];
  ctaLabel?: string;
  ctaHref?: string;
  children: React.ReactNode;
}

/** Live clock formatted to Asia/Kolkata (IST) */
function CurrentTime() {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const time = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    // second: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  }).format(now);

  return (
    <span className="text-xs sm:text-sm text-muted-foreground tabular-nums">
      {time}
    </span>
  );
}

export function DashboardShell({
  title,
  subtitle,
  navItems,
  ctaLabel,
  ctaHref,
  children,
}: DashboardShellProps) {
  const { user, role, permissions, logout } = useAuth();
  const filteredNavItems = useMemo(
    () => filterNavItems(navItems, role, permissions),
    [navItems, permissions, role]
  );
  const pathname = usePathname();
  const breadcrumb = useMemo(() => {
    const parts = pathname.split('/').filter(Boolean);
    if (parts.length === 0)
      return [] as Array<{ label: string; href?: string }>;
    const root = parts[0];
    const rootHref = `/${root}`;
    const items: Array<{ label: string; href?: string }> = [];
    items.push({ label: 'Dashboard', href: rootHref });
    for (let i = 1; i < parts.length; i++) {
      const href = `/${parts.slice(0, i + 1).join('/')}`;
      const raw = parts[i];
      const label = raw
        .split('-')
        .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
        .join(' ');
      items.push({ label, href: i === parts.length - 1 ? undefined : href });
    }
    return items;
  }, [pathname]);

  if (!user) {
    return null;
  }

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex w-full">
        <AppSidebar items={filteredNavItems} user={user} onLogout={logout} />

        <SidebarInset>
          <header className="bg-background sticky top-0 flex h-[8vh] items-center gap-2 border-b px-4 z-1">
            <div className="flex justify-between items-center w-full px-4">
              <div className="flex items-center gap-2">
                <SidebarTrigger />
                <Separator
                  orientation="vertical"
                  className="mr-2 data-[orientation=vertical]:h-4"
                />
                {breadcrumb.length ? (
                  <Breadcrumb>
                    <BreadcrumbList>
                      {breadcrumb.map((item, idx) => (
                        <React.Fragment key={`${item.label}-${idx}`}>
                          <BreadcrumbItem>
                            {item.href ? (
                              <BreadcrumbLink href={item.href}>
                                {item.label}
                              </BreadcrumbLink>
                            ) : (
                              <BreadcrumbPage>{item.label}</BreadcrumbPage>
                            )}
                          </BreadcrumbItem>
                          {idx < breadcrumb.length - 1 ? (
                            <BreadcrumbSeparator />
                          ) : null}
                        </React.Fragment>
                      ))}
                    </BreadcrumbList>
                  </Breadcrumb>
                ) : null}
              </div>
              <div className="flex gap-2 items-center">
                <div className="w-7 h-auto cursor-pointer hover:bg-gray-200 rounded-md p-1 duration-300">
                  <Moon className="w-full h-full" />
                </div>
                <div className="w-7 h-auto cursor-pointer hover:bg-gray-200 rounded-md p-1 duration-300">
                  <Bell className="w-full h-full" />
                </div>

                {/* Current time (IST) */}
                <div className="current time px-2 py-1">
                  <CurrentTime />
                </div>
              </div>
            </div>
          </header>
          <div className="flex-1 p-4 lg:p-8 overflow-auto">
            <div className="flex flex-1 flex-col gap-4">
              <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-semibold leading-tight md:text-3xl">
                  {title}
                </h1>
                <p className="text-sm text-muted-foreground md:text-base">
                  {subtitle}
                </p>
              </div>
              {children}
            </div>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
