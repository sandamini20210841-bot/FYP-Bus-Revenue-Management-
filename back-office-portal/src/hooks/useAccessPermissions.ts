import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../utils/axios";

export type ModuleName =
  | "dashboard"
  | "discrepancies"
  | "routes"
  | "buses"
  | "summary"
  | "timetable"
  | "reports"
  | "users"
  | "audit_logs";

type AccessPermission = {
  module_name: ModuleName | string;
  can_create: boolean;
  can_view: boolean;
  can_edit: boolean;
  can_delete: boolean;
};

export type PermissionMap = Record<string, AccessPermission>;

const ALL_MODULES: ModuleName[] = [
  "dashboard",
  "discrepancies",
  "routes",
  "buses",
  "summary",
  "timetable",
  "reports",
  "users",
  "audit_logs",
];

let cachedPermissionMap: PermissionMap | null = null;
let inFlightPermissionLoad: Promise<PermissionMap> | null = null;

const normalizeRole = (rawRole: string | null | undefined): string => {
  return (rawRole || "").trim().toLowerCase().replace(/[-\s]+/g, "_");
};

const readRoleFromLocalStorage = (): string => {
  if (typeof window === "undefined") return "admin";

  try {
    const raw = localStorage.getItem("authUser");
    if (!raw) return "admin";
    const parsed = JSON.parse(raw) as { role?: string };
    return normalizeRole(parsed.role || "admin");
  } catch {
    return "admin";
  }
};

const buildEmptyMap = (): PermissionMap => {
  const map: PermissionMap = {};
  for (const moduleName of ALL_MODULES) {
    map[moduleName] = {
      module_name: moduleName,
      can_create: false,
      can_view: false,
      can_edit: false,
      can_delete: false,
    };
  }
  return map;
};

const buildRoleDefaultMap = (role: string): PermissionMap => {
  const map = buildEmptyMap();

  if (role === "admin") {
    for (const moduleName of ALL_MODULES) {
      map[moduleName] = {
        module_name: moduleName,
        can_create: true,
        can_view: true,
        can_edit: true,
        can_delete: true,
      };
    }
    return map;
  }

  if (role === "bus_owner") {
    ["dashboard", "discrepancies", "summary", "reports"].forEach((moduleName) => {
      map[moduleName] = {
        module_name: moduleName,
        can_create: false,
        can_view: true,
        can_edit: false,
        can_delete: false,
      };
    });

    map.buses = {
      module_name: "buses",
      can_create: true,
      can_view: true,
      can_edit: true,
      can_delete: true,
    };

    map.routes = {
      module_name: "routes",
      can_create: false,
      can_view: true,
      can_edit: false,
      can_delete: false,
    };

    return map;
  }

  if (role === "time_keeper") {
    map.routes = {
      module_name: "routes",
      can_create: true,
      can_view: true,
      can_edit: true,
      can_delete: false,
    };
    map.buses = {
      module_name: "buses",
      can_create: true,
      can_view: true,
      can_edit: true,
      can_delete: false,
    };
    map.summary = {
      module_name: "summary",
      can_create: false,
      can_view: true,
      can_edit: false,
      can_delete: false,
    };
    map.timetable = {
      module_name: "timetable",
      can_create: true,
      can_view: true,
      can_edit: true,
      can_delete: true,
    };
    return map;
  }

  if (role === "accountant") {
    map.dashboard = {
      module_name: "dashboard",
      can_create: false,
      can_view: true,
      can_edit: true,
      can_delete: true,
    };
    map.discrepancies = {
      module_name: "discrepancies",
      can_create: false,
      can_view: true,
      can_edit: true,
      can_delete: true,
    };
    map.routes = {
      module_name: "routes",
      can_create: false,
      can_view: true,
      can_edit: false,
      can_delete: false,
    };
    map.summary = {
      module_name: "summary",
      can_create: false,
      can_view: true,
      can_edit: false,
      can_delete: false,
    };
    map.reports = {
      module_name: "reports",
      can_create: false,
      can_view: true,
      can_edit: true,
      can_delete: true,
    };
  }

  return map;
};

const toPermissionMap = (permissions: AccessPermission[], role: string): PermissionMap => {
  const map = buildRoleDefaultMap(role);

  for (const row of permissions) {
    const moduleName = (row?.module_name || "").toString().trim().toLowerCase();
    if (!moduleName) continue;

    map[moduleName] = {
      module_name: moduleName,
      can_create: !!row.can_create,
      can_view: !!row.can_view,
      can_edit: !!row.can_edit,
      can_delete: !!row.can_delete,
    };
  }

  return map;
};

const fetchPermissionMap = async (): Promise<PermissionMap> => {
  const role = readRoleFromLocalStorage();
  const fallback = buildRoleDefaultMap(role);

  try {
    const response = await api.get("/users/me/access");
    const rows = Array.isArray(response.data?.permissions)
      ? (response.data.permissions as AccessPermission[])
      : [];
    return toPermissionMap(rows, role);
  } catch {
    return fallback;
  }
};

const loadPermissionMap = async (force = false): Promise<PermissionMap> => {
  if (!force && cachedPermissionMap) {
    return cachedPermissionMap;
  }

  if (!force && inFlightPermissionLoad) {
    return inFlightPermissionLoad;
  }

  inFlightPermissionLoad = fetchPermissionMap()
    .then((result) => {
      cachedPermissionMap = result;
      return result;
    })
    .finally(() => {
      inFlightPermissionLoad = null;
    });

  return inFlightPermissionLoad;
};

export const clearPermissionCache = () => {
  cachedPermissionMap = null;
  inFlightPermissionLoad = null;
};

export const useAccessPermissions = () => {
  const [permissionMap, setPermissionMap] = useState<PermissionMap>(() => {
    return cachedPermissionMap || buildRoleDefaultMap(readRoleFromLocalStorage());
  });
  const [isLoading, setIsLoading] = useState(!cachedPermissionMap);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    const next = await loadPermissionMap(true);
    setPermissionMap(next);
    setIsLoading(false);
    return next;
  }, []);

  useEffect(() => {
    let isMounted = true;

    const run = async () => {
      setIsLoading(!cachedPermissionMap);
      const next = await loadPermissionMap(false);
      if (!isMounted) return;
      setPermissionMap(next);
      setIsLoading(false);
    };

    void run();

    return () => {
      isMounted = false;
    };
  }, []);

  const canView = useCallback(
    (moduleName: ModuleName | string) => {
      const key = (moduleName || "").toString().trim().toLowerCase();
      return !!permissionMap[key]?.can_view;
    },
    [permissionMap]
  );

  const canCreate = useCallback(
    (moduleName: ModuleName | string) => {
      const key = (moduleName || "").toString().trim().toLowerCase();
      return !!permissionMap[key]?.can_create;
    },
    [permissionMap]
  );

  const canEdit = useCallback(
    (moduleName: ModuleName | string) => {
      const key = (moduleName || "").toString().trim().toLowerCase();
      return !!permissionMap[key]?.can_edit;
    },
    [permissionMap]
  );

  const canDelete = useCallback(
    (moduleName: ModuleName | string) => {
      const key = (moduleName || "").toString().trim().toLowerCase();
      return !!permissionMap[key]?.can_delete;
    },
    [permissionMap]
  );

  return useMemo(
    () => ({
      permissionMap,
      isLoading,
      refresh,
      canView,
      canCreate,
      canEdit,
      canDelete,
    }),
    [permissionMap, isLoading, refresh, canView, canCreate, canEdit, canDelete]
  );
};
