import { useCallback, useMemo } from "react";
import type { AuthUser } from "../services/api";

export function usePermissions(authUser: AuthUser | null) {
  const permissions = useMemo(() => authUser?.permissions ?? [], [authUser?.permissions]);

  const can = useCallback(
    (permission: string) => permissions.includes(permission),
    [permissions],
  );

  const canAny = useCallback(
    (...perms: string[]) => perms.some((p) => permissions.includes(p)),
    [permissions],
  );

  return { can, canAny, permissions };
}
