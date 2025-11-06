"use client"

import { NavItem } from "@/lib/navigation"
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarRail } from "../ui/sidebar"
import { AuthenticatedUser } from "@/lib/auth-context"
import { BarChart3, Building2, LayoutDashboard, ListChecks, LogOut, LucideIcon, Send, ShieldAlert, Users } from "lucide-react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { Avatar, AvatarFallback } from "../ui/avatar"

const iconMap: Record<string, LucideIcon> = {
  "layout-dashboard": LayoutDashboard,
  "building-2": Building2,
  users: Users,
  "shield-alert": ShieldAlert,
  "list-checks": ListChecks,
  send: Send,
  "bar-chart-3": BarChart3,
}

interface AppSidebarProps {
  items: NavItem[]
  user: AuthenticatedUser
  onLogout: () => void
}

export function AppSidebar({ items, user, onLogout }: AppSidebarProps) {
  const pathname = usePathname()

  const renderNavItems = () =>
    items.map(({ href, title, icon }) => {
      const Icon = icon ? iconMap[icon] ?? LayoutDashboard : LayoutDashboard
      const isActive = pathname === href || pathname.startsWith(`${href}/`)
      return (
        <SidebarMenuItem key={href}>
          <SidebarMenuButton tooltip={title} asChild isActive={isActive}>
            <Link href={href}>
              <Icon className="size-9" />
              <span>{title}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      )
    })

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg">
              <div className="flex items-center gap-2">
                <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                  OA
                </span>
                <div className="flex flex-col transition-all duration-200">
                  <span className="text-sm font-semibold leading-none">Assessment Platform</span>
                  <span className="text-xs text-muted-foreground">Recruitment Suite</span>
                </div>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {renderNavItems()}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg">
              <Avatar>
                <AvatarFallback>{user.initials}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.name}</span>
                <span className="truncate text-xs">{user.email}</span>
              </div>
            </SidebarMenuButton>
            <SidebarMenuButton className="mt-2 flex justify-center gap-2 bg-gray-200 duration-200 hover:bg-muted-foreground transition-colors hover:text-background" onClick={onLogout}>
                <LogOut className="size-4" />
                <span>Log out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}