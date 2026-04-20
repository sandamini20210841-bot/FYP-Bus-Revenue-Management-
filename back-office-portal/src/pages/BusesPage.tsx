import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import api from "../utils/axios";
import { useAccessPermissions } from "../hooks/useAccessPermissions";
import { RootState } from "../store";

type BusRow = {
  id: string;
  route_id: string;
  route_number: string;
  bus_number: string;
  owner_name?: string;
};

type RouteOption = {
  id: string;
  route_number: string;
};

const BusesPage: React.FC = () => {
  const { canCreate, canEdit, canDelete } = useAccessPermissions();
  const canCreateBus = canCreate("buses");
  const canEditBus = canEdit("buses");
  const canDeleteBus = canDelete("buses");
  const userFromStore = useSelector((state: RootState) => state.auth.user);
  const currentRole = (() => {
    if (userFromStore?.role) return userFromStore.role.toLowerCase();
    if (typeof window !== "undefined") {
      const raw = localStorage.getItem("authUser");
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as { role?: string };
          return (parsed.role || "admin").toLowerCase();
        } catch {
          // ignore
        }
      }
    }
    return "admin";
  })();
  const showBusOwnerColumn = currentRole === "admin";

  const [buses, setBuses] = useState<BusRow[]>([]);
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [routeId, setRouteId] = useState("");
  const [busNumber, setBusNumber] = useState("");

  const [editingBus, setEditingBus] = useState<BusRow | null>(null);
  const [isDeleteBusyId, setIsDeleteBusyId] = useState<string | null>(null);
  const [busPendingDelete, setBusPendingDelete] = useState<BusRow | null>(null);
  const tableColumnCount = (showBusOwnerColumn ? 1 : 0) + (canEditBus || canDeleteBus ? 1 : 0) + 2;

  const loadBuses = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get("/buses");
      const rows = Array.isArray(response.data?.buses) ? response.data.buses : [];
      setBuses(rows);
    } catch (err: any) {
      setError(err?.response?.data?.error || "Failed to load buses.");
      setBuses([]);
    } finally {
      setLoading(false);
    }
  };

  const loadRoutes = async () => {
    try {
      const response = await api.get("/routes", { params: { page: 1, limit: 500 } });
      const rows = Array.isArray(response.data?.routes) ? response.data.routes : [];
      const mapped = rows
        .map((r: any) => ({ id: String(r.id || ""), route_number: String(r.route_number || "") }))
        .filter((r: RouteOption) => r.id && r.route_number);
      setRoutes(mapped);
      if (!routeId && mapped.length > 0) {
        setRouteId(mapped[0].id);
      }
    } catch {
      setRoutes([]);
    }
  };

  useEffect(() => {
    void loadBuses();
    void loadRoutes();
  }, []);

  const selectedRouteLabel = useMemo(() => {
    return routes.find((r) => r.id === routeId)?.route_number || "";
  }, [routeId, routes]);

  const openCreateModal = () => {
    if (!canCreateBus) return;
    setBusNumber("");
    setEditingBus(null);
    if (!routeId && routes.length > 0) {
      setRouteId(routes[0].id);
    }
    setIsCreateModalOpen(true);
  };

  const openEditModal = (bus: BusRow) => {
    if (!canEditBus) return;
    setEditingBus(bus);
    setRouteId(bus.route_id);
    setBusNumber(bus.bus_number);
    setIsCreateModalOpen(true);
  };

  const closeCreateModal = () => {
    if (isSubmitting) return;
    setIsCreateModalOpen(false);
  };

  const submitBus = async () => {
    if (isSubmitting) return;
    if (!routeId || !busNumber.trim()) {
      setError("Route and bus number are required.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      if (editingBus) {
        await api.put(`/buses/${editingBus.id}`, { bus_number: busNumber.trim() });
      } else {
        await api.post("/buses", { route_id: routeId, bus_number: busNumber.trim() });
      }
      await loadBuses();
      setIsCreateModalOpen(false);
    } catch (err: any) {
      setError(err?.response?.data?.error || "Failed to save bus.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openDeleteModal = (bus: BusRow) => {
    if (!canDeleteBus || isDeleteBusyId) return;
    setBusPendingDelete(bus);
  };

  const closeDeleteModal = () => {
    if (isDeleteBusyId) return;
    setBusPendingDelete(null);
  };

  const confirmDeleteBus = async () => {
    if (!canDeleteBus || isDeleteBusyId || !busPendingDelete) return;

    setIsDeleteBusyId(busPendingDelete.id);
    setError(null);
    try {
      await api.delete(`/buses/${busPendingDelete.id}`);
      await loadBuses();
      setBusPendingDelete(null);
    } catch (err: any) {
      setError(err?.response?.data?.error || "Failed to delete bus.");
    } finally {
      setIsDeleteBusyId(null);
    }
  };

  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 mb-1">{t("common.buses")}</h1>
        <p className="text-sm text-slate-500">{t("common.manageBuses")}</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-start">
          {canCreateBus && (
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-blue-700"
            >
              <span className="text-sm leading-none">+</span>
              <span>Create bus</span>
            </button>
          )}
        </div>

        <div className="px-6 py-4 overflow-x-auto">
          <table className="min-w-full text-left text-xs text-slate-700">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4 font-semibold">Route</th>
                <th className="py-2 pr-4 font-semibold">Bus Number</th>
                {showBusOwnerColumn && <th className="py-2 pr-4 font-semibold">Bus Owner</th>}
                {(canEditBus || canDeleteBus) && <th className="py-2 pr-0 font-semibold">Action</th>}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={tableColumnCount} className="py-6 text-center text-[11px] text-slate-400">Loading buses...</td>
                </tr>
              )}
              {!loading && error && (
                <tr>
                  <td colSpan={tableColumnCount} className="py-6 text-center text-[11px] text-red-500">{error}</td>
                </tr>
              )}
              {!loading && !error && buses.length === 0 && (
                <tr>
                  <td colSpan={tableColumnCount} className="py-6 text-center text-[11px] text-slate-400">No buses found.</td>
                </tr>
              )}
              {!loading && !error && buses.map((bus) => (
                <tr key={bus.id} className="border-b border-slate-100 last:border-b-0">
                  <td className="py-3 pr-4">{bus.route_number || "-"}</td>
                  <td className="py-3 pr-4">{bus.bus_number || "-"}</td>
                  {showBusOwnerColumn && <td className="py-3 pr-4">{bus.owner_name || "-"}</td>}
                  {(canEditBus || canDeleteBus) && (
                    <td className="py-3 pr-0">
                      <div className="flex items-center gap-2">
                        {canEditBus && (
                          <button
                            type="button"
                            onClick={() => openEditModal(bus)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-slate-600 hover:bg-slate-100"
                            aria-label={`Edit ${bus.bus_number}`}
                            title="Edit bus"
                          >
                            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5">
                              <path d="M3.5 13.75V16.5h2.75L15 7.75 12.25 5 3.5 13.75Z" />
                              <path d="M11.5 5.75 14.25 8.5" />
                            </svg>
                          </button>
                        )}
                        {canDeleteBus && (
                          <button
                            type="button"
                            onClick={() => openDeleteModal(bus)}
                            disabled={isDeleteBusyId === bus.id}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-red-200 text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                            aria-label={`Delete ${bus.bus_number}`}
                            title="Delete bus"
                          >
                            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5">
                              <path d="M4.5 6h11" />
                              <path d="M8 6V4.75h4V6" />
                              <path d="M7 6v9h6V6" />
                            </svg>
                          </button>
                        )}
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
                <h3 className="text-sm font-semibold text-slate-900">{editingBus ? "Edit Bus" : "Create Bus"}</h3>
                <p className="text-xs text-slate-500 mt-1">Select route and enter bus number.</p>
              </div>
              <button type="button" onClick={closeCreateModal} className="text-slate-400 hover:text-slate-600 text-lg leading-none">×</button>
            </div>

            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Route</label>
                <select
                  value={routeId}
                  onChange={(e) => setRouteId(e.target.value)}
                  disabled={!!editingBus}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {routes.map((route) => (
                    <option key={route.id} value={route.id}>{route.route_number}</option>
                  ))}
                </select>
                {!!selectedRouteLabel && <p className="mt-1 text-[11px] text-slate-500">Selected route: {selectedRouteLabel}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Bus Number</label>
                <input
                  type="text"
                  value={busNumber}
                  onChange={(e) => setBusNumber(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter bus number"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-100">
              <button type="button" onClick={closeCreateModal} className="rounded-full border border-slate-200 px-4 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
              <button
                type="button"
                onClick={() => { void submitBus(); }}
                disabled={isSubmitting}
                className="rounded-full bg-blue-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {isSubmitting ? "Saving..." : editingBus ? "Save Changes" : "Create Bus"}
              </button>
            </div>
          </div>
        </div>
      )}

      {busPendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-xl">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-900">Delete Bus</h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to delete {busPendingDelete.bus_number} from route {busPendingDelete.route_number}? This action cannot be undone.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4">
              <button
                type="button"
                onClick={closeDeleteModal}
                disabled={isDeleteBusyId === busPendingDelete.id}
                className="rounded-full border border-slate-200 px-4 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                No
              </button>
              <button
                type="button"
                onClick={() => {
                  void confirmDeleteBus();
                }}
                disabled={isDeleteBusyId === busPendingDelete.id}
                className="rounded-full bg-red-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isDeleteBusyId === busPendingDelete.id ? "Deleting..." : "Yes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BusesPage;
