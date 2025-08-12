"use client"

import type * as React from "react"
import {
  FileText,
  Folder,
  FolderPlus,
  MoreHorizontal,
  Plus,
  Search,
} from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarSeparator,
} from "@/components/ui/sidebar"

// Sample data structure
const actionItems = [
  {
    title: "New Canvas",
    icon: Plus,
    action: () => console.log("New Canvas"),
  },
  {
    title: "New Folder",
    icon: FolderPlus,
    action: () => console.log("New Folder"),
  },
  {
    title: "Search",
    icon: Search,
    action: () => console.log("Search"),
  },
]

const filesAndFolders = [
  {
    title: "Vacation",
    icon: FileText,
    type: "file",
  },
  {
    title: "Groceries, Shopping, and Errands",
    icon: FileText,
    type: "file",
  },
  {
    title: "Lesson Plan",
    icon: FileText,
    type: "file",
    isActive: true,
    hasMenu: true,
  },
  {
    title: "Work Project",
    icon: FileText,
    type: "file",
  },
  {
    title: "Workouts",
    icon: Folder,
    type: "folder",
  },
  {
    title: "Nutrition",
    icon: Folder,
    type: "folder",
    children: [
      {
        title: "Lunches",
        icon: FileText,
      },
      {
        title: "Dinners",
        icon: FileText,
      },
    ],
  },
]

const user = {
  name: "John Munson",
  email: "john@gmail.com",
  avatar: "/placeholder.svg?height=32&width=32",
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <div className="px-2 py-2">
          <h1 className="text-lg font-semibold text-sidebar-foreground">
            Iterative Canvas
          </h1>
        </div>
      </SidebarHeader>

      <SidebarContent className="overflow-x-hidden overflow-y-auto">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {actionItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton onClick={item.action}>
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {filesAndFolders.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton isActive={item.isActive}>
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                  {item.hasMenu && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <SidebarMenuAction>
                          <MoreHorizontal className="h-4 w-4" />
                        </SidebarMenuAction>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent side="right" align="start">
                        <DropdownMenuItem>
                          <span>Rename</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <span>Duplicate</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <span>Delete</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                  {item.children && (
                    <SidebarMenuSub>
                      {item.children.map((child) => (
                        <SidebarMenuSubItem key={child.title}>
                          <SidebarMenuSubButton>
                            <child.icon className="h-4 w-4" />
                            <span>{child.title}</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton className="h-12">
              <Avatar className="h-8 w-8">
                <AvatarImage
                  src={user.avatar || "/placeholder.svg"}
                  alt={user.name}
                />
                <AvatarFallback>
                  {user.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col items-start text-left">
                <span className="text-sm font-medium">{user.name}</span>
                <span className="text-xs text-muted-foreground">
                  {user.email}
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
