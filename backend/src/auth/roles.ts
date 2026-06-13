import { AppRole } from "@prisma/client";

export type Permission =
  | "projects:read"
  | "projects:write"
  | "consultants:read"
  | "consultants:write"
  | "time:read"
  | "time:write"
  | "time:review"
  | "expenses:read"
  | "expenses:write"
  | "forecasts:read"
  | "forecasts:write"
  | "revenue:read"
  | "revenue:write"
  | "fx:read"
  | "fx:write"
  | "stats:read"
  | "assignments:read"
  | "assignments:write"
  | "capacity:read"
  | "snapshots:close"
  | "alerts:read"
  | "alerts:resolve"
  | "audit:read"
  | "users:manage"
  | "extrahours:read"
  | "extrahours:write"
  | "extrahours:review"
  | "extrahours:config"
  | "estimations:write"
  | "estimations:read";

const allPermissions: Permission[] = [
  "projects:read",
  "projects:write",
  "consultants:read",
  "consultants:write",
  "time:read",
  "time:write",
  "time:review",
  "expenses:read",
  "expenses:write",
  "forecasts:read",
  "forecasts:write",
  "revenue:read",
  "revenue:write",
  "fx:read",
  "fx:write",
  "stats:read",
  "assignments:read",
  "assignments:write",
  "capacity:read",
  "snapshots:close",
  "alerts:read",
  "alerts:resolve",
  "audit:read",
  "users:manage",
  "extrahours:read",
  "extrahours:write",
  "extrahours:review",
  "extrahours:config",
  "estimations:write",
  "estimations:read",
];

export const rolePermissions: Record<AppRole, Permission[]> = {
  ADMIN: allPermissions,
  PM: [
    "projects:read",
    "projects:write",
    "consultants:read",
    "consultants:write",
    "time:read",
    "time:write",
    "time:review",
    "expenses:read",
    "expenses:write",
    "forecasts:read",
    "forecasts:write",
    "revenue:read",
    "revenue:write",
    "fx:read",
    "stats:read",
    "assignments:read",
    "assignments:write",
    "capacity:read",
    "alerts:read",
    "alerts:resolve",
    "extrahours:read",
    "extrahours:write",
    "extrahours:review",
    "estimations:write",
    "estimations:read",
  ],
  CONSULTANT: [
    "time:read",
    "time:write",
    "alerts:read",
    "extrahours:read",
    "extrahours:write",
    "estimations:read",
  ],
  FINANCE: [
    "projects:read",
    "expenses:read",
    "expenses:write",
    "forecasts:read",
    "revenue:read",
    "revenue:write",
    "fx:read",
    "fx:write",
    "stats:read",
    "assignments:read",
    "capacity:read",
    "snapshots:close",
    "alerts:read",
    "alerts:resolve",
    "audit:read",
    "extrahours:read",
    "extrahours:review",
    "extrahours:config",
  ],
  VIEWER: [
    "projects:read",
    "consultants:read",
    "time:read",
    "expenses:read",
    "forecasts:read",
    "revenue:read",
    "fx:read",
    "stats:read",
    "assignments:read",
    "capacity:read",
    "alerts:read",
    "extrahours:read",
  ],
};

export function resolvePermissions(roles: AppRole[]): Permission[] {
  const permissions = new Set<Permission>();
  for (const role of roles) {
    for (const permission of rolePermissions[role]) {
      permissions.add(permission);
    }
  }
  return Array.from(permissions);
}

