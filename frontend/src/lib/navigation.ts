export type IconName =
  | "layout-dashboard"
  | "building-2"
  | "users"
  | "shield-alert"
  | "list-checks"
  | "send"
  | "bar-chart-3";

export type UserRole = "admin" | "recruiter";

export type NavItem = {
  title: string;
  href: string;
  description?: string;
  icon: IconName;
  roles?: UserRole[];
  requiredPermissions?: string[];
};

export const adminNavItems: NavItem[] = [
  {
    title: "Overview",
    href: "/admin",
    description: "Organization health, usage, and audit highlights",
    icon: "layout-dashboard",
    roles: ["admin"],
  },
  {
    title: "Organizations",
    href: "/admin/organizations",
    description: "Branding, subscription, and regional compliance",
    icon: "building-2",
    roles: ["admin"],
  },
  {
    title: "Users",
    href: "/admin/users",
    description: "Invite and manage admins and recruiters",
    icon: "users",
    roles: ["admin"],
  },
  {
    title: "Assessments",
    href: "/admin/assessments",
    description: "Build, publish, and iterate on assessments",
    icon: "list-checks",
    roles: ["admin"],
  },
  {
    title: "Question bank",
    href: "/admin/questions",
    description: "Manage reusable questions and categories",
    icon: "users",
    roles: ["admin"],
  },
  {
    title: "Invitations",
    href: "/admin/invitations",
    description: "Send assessments and track candidate progress",
    icon: "send",
    roles: ["admin"],
  },
  {
    title: "Results",
    href: "/admin/results",
    description: "Analyze scores, proctoring events, and feedback",
    icon: "bar-chart-3",
    roles: ["admin"],
  },
  {
    title: "Analytics",
    href: "/admin/analytics",
    description: "Visualize trends across assessments and candidates",
    icon: "bar-chart-3",
    roles: ["admin"],
  },
  {
    title: "System Logs",
    href: "/admin/logs",
    description: "Monitor security, auth, and infrastructure events",
    icon: "shield-alert",
    roles: ["admin"],
  },
];

export const recruiterNavItems: NavItem[] = [
  {
    title: "Dashboard",
    href: "/recruiter",
    description: "Pipeline snapshot and upcoming milestones",
    icon: "layout-dashboard",
    roles: ["recruiter"],
  },
  {
    title: "Profile",
    href: "/recruiter/profile",
    description: "Update your personal and notification preferences",
    icon: "users",
    roles: ["recruiter"],
  },
  {
    title: "Assessments",
    href: "/recruiter/assessments",
    description: "Build, publish, and iterate on assessments",
    icon: "list-checks",
    roles: ["recruiter"],
  },
  {
    title: "Question bank",
    href: "/recruiter/questions",
    description: "Manage reusable questions and categories",
    icon: "users",
    roles: ["recruiter"],
  },
  {
    title: "Categories",
    href: "/recruiter/questions/categories",
    description: "Rename or remove categories",
    icon: "users",
    roles: ["recruiter"],
  },
  {
    title: "Invitations",
    href: "/recruiter/invitations",
    description: "Send reminders and track candidate progress",
    icon: "send",
    roles: ["recruiter"],
  },
  {
    title: "Results",
    href: "/recruiter/results",
    description: "Analyze scores, proctoring events, and feedback",
    icon: "bar-chart-3",
    roles: ["recruiter"],
  },
  {
    title: "Analytics",
    href: "/recruiter/analytics",
    description: "Visualize trends across assessments and candidates",
    icon: "bar-chart-3",
    roles: ["recruiter"],
  },
];

export function filterNavItems(items: NavItem[], role: UserRole, permissions: string[]): NavItem[] {
  return items.filter((item) => {
    const roleAllowed = !item.roles || item.roles.includes(role);
    const permissionsAllowed =
      !item.requiredPermissions || item.requiredPermissions.every((permission) => permissions.includes(permission));

    return roleAllowed && permissionsAllowed;
  });
}
