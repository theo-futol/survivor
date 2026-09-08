"use client"

import * as React from "react"
import { Building2, CircleDollarSign, LayoutDashboard, Store, TerminalIcon, User, Users } from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export type AdminTab = "dashboard" | "partners" | "employee" | "business" | "topups" | "account"

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  activeTab: AdminTab
  onSelectTab: (tab: AdminTab) => void
}

export function AppSidebar({ activeTab, onSelectTab, ...props }: AppSidebarProps) {
  const adminNavItems = [
    { id: "dashboard" as AdminTab, title: "Tableau national", icon: LayoutDashboard },
    { id: "partners" as AdminTab, title: "Partenaires", icon: Store },
    { id: "employee" as AdminTab, title: "Salariés", icon: Users },
    { id: "business" as AdminTab, title: "Employeurs", icon: Building2 },
    { id: "topups" as AdminTab, title: "Abondements", icon: CircleDollarSign },
    { id: "account" as AdminTab, title: "Compte", icon: User },
  ]

  return (
    <Sidebar className="top-(--header-height) h-[calc(100svh-var(--header-height))]!" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg">
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <TerminalIcon className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">Carte Pro</span>
                <span className="truncate text-xs">Administration Ministère</span>
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
                <SidebarMenuButton isActive={isActive} onClick={() => onSelectTab(item.id)} className="cursor-pointer">
                  <Icon className="mr-2 size-4" />
                  <span>{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  )
}
