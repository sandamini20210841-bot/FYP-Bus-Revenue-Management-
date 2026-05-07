import React, { useEffect, useState } from "react";
import api from "../utils/axios";

type BackofficeUser = {
  id: string;
  full_name: string;
  email: string;
  phone_number: string;
  role: string;
  is_active: boolean;
  created_at: string;
  last_login: string | null;
};

type AccessPermission = {
  module_name: string;
  can_create: boolean;
  can_view: boolean;
  can_edit: boolean;
  can_delete: boolean;
};

const moduleLabels: Record<string, string> = {
  dashboard: "Dashboard",
  discrepancies: "Discrepancies",
  routes: "Routes",
  buses: "Buses",
  summary: "Summary",
  reports: "Reports",
  users: "Users",
  audit_logs: "Audit Logs",
};

const roleLabel = (role: string) => {
  if (role === "bus_owner") return "Bus owner";
  if (role === "time_keeper") return "Time keeper";
  if (role === "admin") return "Admin";
  return role;
};

const UsersPage: React.FC = () => {
  const currentRole = (() => {
    if (typeof window === "undefined") return "admin";
    try {
      const raw = localStorage.getItem("authUser");
      if (!raw) return "admin";
      const parsed = JSON.parse(raw) as { role?: string };
      return (parsed.role || "admin").toLowerCase();
    } catch {
      return "admin";
    }
  })();
  const isAdminUser = currentRole === "admin";

  const [users, setUsers] = useState<BackofficeUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({
    full_name: "",
    email: "",
    phone_number: "",
    role: "bus_owner",
  });
  const [selectedUser, setSelectedUser] = useState<BackofficeUser | null>(null);
  const [accessPermissions, setAccessPermissions] = useState<AccessPermission[]>([]);
  const [isAccessModalOpen, setIsAccessModalOpen] = useState(false);
  const [isAccessLoading, setIsAccessLoading] = useState(false);
  const [isAccessSaving, setIsAccessSaving] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [accessSuccess, setAccessSuccess] = useState<string | null>(null);
  const [isDeletingUserId, setIsDeletingUserId] = useState<string | null>(null);
  const [userPendingDelete, setUserPendingDelete] = useState<BackofficeUser | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    full_name: "",
    email: "",
    phone_number: "",
    role: "bus_owner",
  });

  const loadUsers = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.get("/users", {
        params: { page: 1, limit: 200 },
      });

      const rows = Array.isArray(response.data?.users) ? response.data.users : [];
      setUsers(rows);
    } catch (err: any) {
      const message = err?.response?.data?.error;
      setError(message || "Failed to load users.");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  const openCreateModal = () => {
    setCreateForm({
      full_name: "",
      email: "",
      phone_number: "",
      role: "bus_owner",
    });
    setCreateError(null);
    setCreateSuccess(null);
    setTempPassword(null);
    setIsCreateModalOpen(true);
  };

  const closeCreateModal = () => {
    if (isCreating) return;
    setIsCreateModalOpen(false);
    setCreateError(null);
    setCreateSuccess(null);
    setTempPassword(null);
  };

  const handleCreateUser = async () => {
    if (isCreating) return;

    if (!createForm.full_name.trim() || !createForm.email.trim() || !createForm.role.trim()) {
      setCreateError("Name, email and role are required.");
      return;
    }

    setIsCreating(true);
    setCreateError(null);
    setCreateSuccess(null);
    setTempPassword(null);

    try {
      const response = await api.post("/users", {
        full_name: createForm.full_name.trim(),
        email: createForm.email.trim(),
        phone_number: createForm.phone_number.trim(),
        role: createForm.role,
      });

      setCreateSuccess("User created successfully.");
      const password = response.data?.temporaryPassword;
      if (typeof password === "string" && password.trim()) {
        setTempPassword(password);
      }
      await loadUsers();
    } catch (err: any) {
      const message = err?.response?.data?.error;
      setCreateError(message || "Failed to create user.");
    } finally {
      setIsCreating(false);
    }
  };

  const openAccessModal = async (user: BackofficeUser) => {
    setSelectedUser(user);
    setIsAccessModalOpen(true);
    setIsAccessLoading(true);
    setAccessError(null);
    setAccessSuccess(null);

    try {
      const response = await api.get(`/users/${user.id}/access`);
      const permissions = Array.isArray(response.data?.permissions) ? response.data.permissions : [];
      setAccessPermissions(permissions);
    } catch (err: any) {
      const message = err?.response?.data?.error;
      setAccessError(message || "Failed to load user access permissions.");
      setAccessPermissions([]);
    } finally {
      setIsAccessLoading(false);
    }
  };

  const closeAccessModal = () => {
    if (isAccessSaving) return;
    setIsAccessModalOpen(false);
    setSelectedUser(null);
    setAccessPermissions([]);
    setAccessError(null);
    setAccessSuccess(null);
  };

  const updatePermission = (
    moduleName: string,
    field: "can_create" | "can_view" | "can_edit" | "can_delete",
    checked: boolean
  ) => {
    setAccessSuccess(null);
    setAccessPermissions((prev) =>
      prev.map((permission) => {
        if (permission.module_name !== moduleName) return permission;

        if (field === "can_view") {
          return {
            ...permission,
            can_view: checked,
            can_create: checked ? permission.can_create : false,
            can_edit: checked ? permission.can_edit : false,
            can_delete: checked ? permission.can_delete : false,
          };
        }

        if (field === "can_create") {
          return {
            ...permission,
            can_create: checked,
            can_view: checked ? true : permission.can_view,
          };
        }

        if (field === "can_edit") {
          return {
            ...permission,
            can_edit: checked,
            can_view: checked ? true : permission.can_view,
          };
        }

        return {
          ...permission,
          can_delete: checked,
          can_view: checked ? true : permission.can_view,
        };
      })
    );
  };

  const saveAccessPermissions = async () => {
    if (!selectedUser || isAccessSaving) return;

    setIsAccessSaving(true);
    setAccessError(null);
    setAccessSuccess(null);

    try {
      await api.put(`/users/${selectedUser.id}/access`, {
        permissions: accessPermissions,
      });

      const refreshResponse = await api.get(`/users/${selectedUser.id}/access`);
      const refreshedPermissions = Array.isArray(refreshResponse.data?.permissions)
        ? refreshResponse.data.permissions
        : [];
      setAccessPermissions(refreshedPermissions);

      setAccessSuccess("Access permissions updated successfully.");
    } catch (err: any) {
      const message = err?.response?.data?.error;
      setAccessError(message || "Failed to update user access permissions.");
    } finally {
      setIsAccessSaving(false);
    }
  };

  const openDeleteModal = (user: BackofficeUser) => {
    if (isDeletingUserId) return;
    setUserPendingDelete(user);
  };

  const closeDeleteModal = () => {
    if (isDeletingUserId) return;
    setUserPendingDelete(null);
  };

  const confirmDeleteUser = async () => {
    if (isDeletingUserId || !userPendingDelete) return;

    setIsDeletingUserId(userPendingDelete.id);
    setError(null);

    try {
      await api.delete(`/users/${userPendingDelete.id}`);
      await loadUsers();
      setUserPendingDelete(null);
    } catch (err: any) {
      const message = err?.response?.data?.error;
      setError(message || "Failed to delete user.");
    } finally {
      setIsDeletingUserId(null);
    }
  };

  const openEditModal = (user: BackofficeUser) => {
    setSelectedUser(user);
    setEditForm({
      full_name: user.full_name || "",
      email: user.email || "",
      phone_number: user.phone_number || "",
      role: user.role || "bus_owner",
    });
    setEditError(null);
    setEditSuccess(null);
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
    if (isEditing) return;
    setIsEditModalOpen(false);
    setEditError(null);
    setEditSuccess(null);
  };

  const handleUpdateUser = async () => {
    if (!selectedUser || isEditing) return;

    if (!editForm.full_name.trim() || !editForm.email.trim() || !editForm.role.trim()) {
      setEditError("Name, email and role are required.");
      return;
    }

    setIsEditing(true);
    setEditError(null);
    setEditSuccess(null);

    try {
      await api.put(`/users/${selectedUser.id}`, {
        full_name: editForm.full_name.trim(),
        email: editForm.email.trim(),
        phone_number: editForm.phone_number.trim(),
        role: editForm.role,
      });
      setEditSuccess("User updated successfully.");
      await loadUsers();
    } catch (err: any) {
      const message = err?.response?.data?.error;
      setEditError(message || "Failed to update user.");
    } finally {
      setIsEditing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 mb-1">Users</h1>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-start">
          {isAdminUser && (
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-blue-700"
            >
              <span className="text-sm leading-none">+</span>
              <span>Create user</span>
            </button>
          )}
        </div>

        <div className="px-6 py-4 overflow-x-auto">
          <table className="min-w-full text-left text-xs text-slate-700">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4 font-semibold">Name</th>
                <th className="py-2 pr-4 font-semibold">Email</th>
                <th className="py-2 pr-4 font-semibold">Phone</th>
                <th className="py-2 pr-4 font-semibold">Role</th>
                <th className="py-2 pr-4 font-semibold">Status</th>
                <th className="py-2 pr-4 font-semibold">Last Login</th>
                {isAdminUser && <th className="py-2 pr-0 font-semibold">Action</th>}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={isAdminUser ? 7 : 6} className="py-6 text-center text-[11px] text-slate-400">
                    Loading users...
                  </td>
                </tr>
              )}

              {!loading && error && (
                <tr>
                  <td colSpan={isAdminUser ? 7 : 6} className="py-6 text-center text-[11px] text-red-500">
                    {error}
                  </td>
                </tr>
              )}

              {!loading && !error && users.length === 0 && (
                <tr>
                  <td colSpan={isAdminUser ? 7 : 6} className="py-6 text-center text-[11px] text-slate-400">
                    No back-office users found.
                  </td>
                </tr>
              )}

              {!loading && !error && users.map((user) => (
                <tr
                  key={user.id}
                  className={`border-b border-slate-100 last:border-b-0 hover:bg-slate-50 ${isAdminUser ? "cursor-pointer" : ""}`}
                  onClick={() => {
                    if (!isAdminUser) return;
                    void openAccessModal(user);
                  }}
                >
                  <td className="py-3 pr-4">{user.full_name || "-"}</td>
                  <td className="py-3 pr-4">{user.email}</td>
                  <td className="py-3 pr-4">{user.phone_number || "-"}</td>
                  <td className="py-3 pr-4">{roleLabel(user.role)}</td>
                  <td className="py-3 pr-4">
                    {user.is_active ? (
                      <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-600">
                        Active
                      </span>
                    ) : (
                      <span className="rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    {user.last_login ? new Date(user.last_login).toLocaleString() : "-"}
                  </td>
                  {isAdminUser && (
                    <td
                      className="py-3 pr-0"
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditModal(user);
                          }}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-slate-600 hover:bg-slate-100"
                          aria-label={`Edit ${user.full_name || user.email}`}
                          title="Edit user"
                        >
                          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5">
                            <path d="M3.5 13.75V16.5h2.75L15 7.75 12.25 5 3.5 13.75Z" />
                            <path d="M11.5 5.75 14.25 8.5" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openDeleteModal(user);
                          }}
                          disabled={isDeletingUserId === user.id}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-red-200 text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                          aria-label={`Delete ${user.full_name || user.email}`}
                          title="Delete user"
                        >
                          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5">
                            <path d="M4.5 6h11" />
                            <path d="M8 6V4.75h4V6" />
                            <path d="M7 6v9h6V6" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 shadow-xl">
            <div className="flex items-start justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Create User</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Add a new back-office user account.
                </p>
              </div>
              <button
                type="button"
                onClick={closeCreateModal}
                disabled={isCreating}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none disabled:opacity-60 disabled:cursor-not-allowed"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="px-5 py-4 space-y-3">
              {createError && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-600">
                  {createError}
                </div>
              )}
              {createSuccess && (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-700">
                  {createSuccess}
                  {tempPassword && (
                    <span className="block mt-1 font-medium text-emerald-800">
                      Temporary password: {tempPassword}
                    </span>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={createForm.full_name}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, full_name: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Full name"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, email: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="name@example.com"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Phone (optional)</label>
                <input
                  type="text"
                  value={createForm.phone_number}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, phone_number: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="07XXXXXXXX"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Role <span className="text-red-500">*</span>
                </label>
                <select
                  value={createForm.role}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, role: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="admin">Admin</option>
                  <option value="bus_owner">Bus owner</option>
                  <option value="time_keeper">Time keeper</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-100">
              <button
                type="button"
                onClick={closeCreateModal}
                disabled={isCreating}
                className="rounded-full border border-slate-200 px-4 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleCreateUser();
                }}
                disabled={isCreating}
                className="rounded-full bg-blue-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isCreating ? "Creating..." : "Create user"}
              </button>
            </div>
          </div>
        </div>
      )}

      {userPendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-xl">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-900">Delete User</h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to delete {userPendingDelete.full_name || userPendingDelete.email}? This action cannot be undone.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4">
              <button
                type="button"
                onClick={closeDeleteModal}
                disabled={isDeletingUserId === userPendingDelete.id}
                className="rounded-full border border-slate-200 px-4 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                No
              </button>
              <button
                type="button"
                onClick={() => {
                  void confirmDeleteUser();
                }}
                disabled={isDeletingUserId === userPendingDelete.id}
                className="rounded-full bg-red-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isDeletingUserId === userPendingDelete.id ? "Deleting..." : "Yes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 shadow-xl">
            <div className="flex items-start justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Edit User</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Update user details for {selectedUser?.full_name || selectedUser?.email || "selected user"}.
                </p>
              </div>
              <button
                type="button"
                onClick={closeEditModal}
                disabled={isEditing}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none disabled:opacity-60 disabled:cursor-not-allowed"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="px-5 py-4 space-y-3">
              {editError && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-600">
                  {editError}
                </div>
              )}
              {editSuccess && (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-700">
                  {editSuccess}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editForm.full_name}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, full_name: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Full name"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, email: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="name@example.com"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Phone (optional)</label>
                <input
                  type="text"
                  value={editForm.phone_number}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, phone_number: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="07XXXXXXXX"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Role <span className="text-red-500">*</span>
                </label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, role: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="admin">Admin</option>
                  <option value="bus_owner">Bus owner</option>
                  <option value="time_keeper">Time keeper</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-100">
              <button
                type="button"
                onClick={closeEditModal}
                disabled={isEditing}
                className="rounded-full border border-slate-200 px-4 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleUpdateUser();
                }}
                disabled={isEditing}
                className="rounded-full bg-blue-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isEditing ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isAccessModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white border border-slate-200 shadow-xl">
            <div className="flex items-start justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">User Access Control</h3>
                <p className="text-xs text-slate-500 mt-1">
                  {selectedUser?.full_name || "User"} ({selectedUser?.email || "-"})
                </p>
              </div>
              <button
                type="button"
                onClick={closeAccessModal}
                disabled={isAccessSaving}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none disabled:opacity-60 disabled:cursor-not-allowed"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="px-5 py-4">
              {isAccessLoading && (
                <p className="text-xs text-slate-500">Loading access settings...</p>
              )}

              {!isAccessLoading && accessError && (
                <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-600">
                  {accessError}
                </div>
              )}

              {!isAccessLoading && accessSuccess && (
                <div className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-700">
                  {accessSuccess}
                </div>
              )}

              {!isAccessLoading && !accessError && (
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <table className="min-w-full text-left text-xs text-slate-700">
                    <thead>
                      <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-500 bg-slate-50">
                        <th className="py-2 px-3 font-semibold">Module</th>
                        <th className="py-2 px-3 font-semibold text-center">Can Create</th>
                        <th className="py-2 px-3 font-semibold text-center">Can View</th>
                        <th className="py-2 px-3 font-semibold text-center">Can Edit</th>
                        <th className="py-2 px-3 font-semibold text-center">Can Delete</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accessPermissions.map((permission) => (
                        <tr key={permission.module_name} className="border-b border-slate-100 last:border-b-0">
                          <td className="py-2.5 px-3">{moduleLabels[permission.module_name] || permission.module_name}</td>
                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={permission.can_create}
                              onChange={(e) => updatePermission(permission.module_name, "can_create", e.target.checked)}
                              className="h-4 w-4 accent-blue-600"
                            />
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={permission.can_view}
                              onChange={(e) => updatePermission(permission.module_name, "can_view", e.target.checked)}
                              className="h-4 w-4 accent-blue-600"
                            />
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={permission.can_edit}
                              onChange={(e) => updatePermission(permission.module_name, "can_edit", e.target.checked)}
                              className="h-4 w-4 accent-blue-600"
                            />
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={permission.can_delete}
                              onChange={(e) => updatePermission(permission.module_name, "can_delete", e.target.checked)}
                              className="h-4 w-4 accent-blue-600"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-100">
              <button
                type="button"
                onClick={closeAccessModal}
                disabled={isAccessSaving}
                className="rounded-full border border-slate-200 px-4 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  void saveAccessPermissions();
                }}
                disabled={isAccessSaving || isAccessLoading || accessPermissions.length === 0}
                className="rounded-full bg-blue-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isAccessSaving ? "Saving..." : "Save Access"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersPage;
