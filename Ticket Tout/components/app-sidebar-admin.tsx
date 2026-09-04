"use client"

import * as React from "react"
import { Users, User, Building2, TerminalIcon } from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { NavUser } from "@/components/nav-user"

export type AdminTab = "employee" | "account" | "business"

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  activeTab: AdminTab
  onSelectTab: (tab: AdminTab) => void
}

const data = {
  user: {
    name: "Julie Marchand",
    email: "m@example.com",
    avatar: "/avatars/shadcn.jpg",
  },
}

export function AppSidebar({ activeTab, onSelectTab, ...props }: AppSidebarProps) {
  const adminNavItems = [
    {
      id: "employee" as AdminTab,
      title: "Employés",
      icon: Users,
    },
    {
      id: "account" as AdminTab,
      title: "Compte",
      icon: User,
    },
    {
      id: "business" as AdminTab,
      title: "Entreprise",
      icon: Building2,
    },
  ]

  return (
    <Sidebar
      className="top-(--header-height) h-[calc(100svh-var(--header-height))]!"
      {...props}
    >
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg">
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <TerminalIcon className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">Ticket Tout</span>
                <span className="truncate text-xs">Administration</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="p-2">
        <SidebarMenu>
          {adminNavItems.map((item) => {
            const Icon = item.icon
            const isActive = activeTab === item.id

            return (
              <SidebarMenuItem key={item.id}>
                <SidebarMenuButton
                  isActive={isActive}
                  onClick={() => onSelectTab(item.id)}
                  className="cursor-pointer"
                >
                  <Icon className="size-4 mr-2" />
                  <span>{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
}