import { Role } from "@prisma/client";

export interface NavItem {
  href: string;
  label: string;
  iconName: string;
}

/**
 * Role-based navigation.
 * 
 * Owner: Everything
 * Admin: Everything except Owner-only pages
 * Operator: Dashboard, Servers, Monitoring
 * SSH User: Dashboard, Servers, Console
 * Read Only: Dashboard, Servers (read), Storage (read)
 */
const ALL_NAV_ITEMS: (NavItem & { roles: Role[] })[] = [
  { href: "/dashboard", label: "Dashboard", iconName: "LayoutDashboard", roles: ["OWNER", "ADMIN", "OPERATOR", "SSH_USER", "READ_ONLY"] },
  { href: "/servers", label: "Servers", iconName: "Server", roles: ["OWNER", "ADMIN", "OPERATOR", "SSH_USER", "READ_ONLY"] },
  { href: "/console", label: "Console", iconName: "Terminal", roles: ["OWNER", "ADMIN", "SSH_USER"] },
  { href: "/storage", label: "Storage", iconName: "FolderOpen", roles: ["OWNER", "ADMIN", "READ_ONLY"] },
  { href: "/users", label: "Team", iconName: "Users", roles: ["OWNER", "ADMIN"] },
  { href: "/activity", label: "Activity", iconName: "Activity", roles: ["OWNER", "ADMIN"] },
  { href: "/settings", label: "Settings", iconName: "Settings", roles: ["OWNER", "ADMIN"] },
];

export function getNavForRole(role: Role): NavItem[] {
  return ALL_NAV_ITEMS
    .filter((item) => item.roles.includes(role))
    .map(({ href, label, iconName }) => ({ href, label, iconName }));
}
