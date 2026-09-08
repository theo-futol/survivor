"use client"

import * as React from "react"

import { BRAND } from "@/lib/brand"

import { NavMain } from "@/components/nav-main"
import { NavProjects } from "@/components/nav-projects"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { TerminalSquareIcon, TerminalIcon } from "lucide-react"

const data = {
  user: {
    name: "Julie Marchand",
    email: "m@example.com",
    avatar: "/avatars/shadcn.jpg",
  },
  navMain: [
    {
      title: "Carte",
      icon: (
        <TerminalSquareIcon
        />
      ),
      isActive: false,
      url: "/",
    },
    {
      title: "Nos partenaires",
      icon: (
        <TerminalSquareIcon
        />
      ),
      isActive: false,
      url: "/partners",
    },
    {
      title: "Transactions",
      icon: (
        <TerminalSquareIcon
        />
      ),
      isActive: true,
      url: "/history",
      items: [
        {
          title: "Crédité",
          url: "/credited",
        },
        {
          title: "Consommé",
          url: "consumes",
        }
      ]
    }
  ]

}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar
      className="top-(--header-height) h-[calc(100svh-var(--header-height))]!"
      {...props}
    >
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<a href="/" />}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <TerminalIcon className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{BRAND.name}</span>
                <span className="truncate text-xs">Enterprise</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
