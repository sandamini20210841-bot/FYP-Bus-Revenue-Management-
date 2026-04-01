import React, { useEffect, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import type { AppDispatch } from "../store";
import { addNotification } from "../store/slices/alertsSlice";
import api from "../utils/axios";
import RouteMapModal from "../components/RouteMapModal";

interface RouteStop {
  id: number;
  name: string;
  distance: string;
  amount: string;
  amountError?: string | null;
  distanceError?: string | null;
}

interface RouteDefinition {
  id: number;
  backendId?: string;
  routeNumber: string;
  routeName: string;
  stops: RouteStop[];
}

const RoutesPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [routeNumber, setRouteNumber] = useState("");
  const [routeNumberError, setRouteNumberError] = useState<string | null>(
    null
  );
  const [routeName, setRouteName] = useState("");
  const [routeNameError, setRouteNameError] = useState<string | null>(null);
  const [stopsError, setStopsError] = useState<string | null>(null);
  const [stops, setStops] = useState<RouteStop[]>([ 
    { 
      id: 1, 
      name: "", 
      distance: "", 
      amount: "", 
      amountError: null, 
      distanceError: null, 
    }, 
  ]);
  const [routes, setRoutes] = useState<RouteDefinition[]>([]);
  const [editingRoute, setEditingRoute] = useState<RouteDefinition | null>(
    null
  );
  const [routePendingDelete, setRoutePendingDelete] =
    useState<RouteDefinition | null>(null);
  const [isSavingRoute, setIsSavingRoute] = useState(false);
  const [isDeletingRoute, setIsDeletingRoute] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleAddStop = () => {
    setStops((prev) => [
      ...prev,
      {
        id: prev.length ? prev[prev.length - 1].id + 1 : 1,
        name: "",
        distance: "",
        amount: "",
        amountError: null,
        distanceError: null,
      },
    ]);
  };

  const handleRemoveStop = (id: number) => {
    setStops((prev) => {
      if (prev.length === 1) return prev; // always keep at least one row
      const updated = prev.filter((stop) => stop.id !== id);
      return updated.length ? updated : prev;
    });
  };

  const [expandedRouteIds, setExpandedRouteIds] = useState<number[]>([]);

  const handleImportClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  const handleImportStops: React.ChangeEventHandler<HTMLInputElement> = (
    event
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setStopsError("Please upload a CSV file (.csv).");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const text = (reader.result as string) || "";
      const lines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      const importedStops: RouteStop[] = [];
      lines.forEach((line, index) => {
        const parts = line.split(",").map((p) => p.trim());
        if (parts.length < 5) return;

        const [, rawName, rawDistance, , rawAmount] = parts;
        if (!rawName || !rawAmount) return;

        const name = rawName.trim();
        const distanceRaw = rawDistance ?? "";
        const distanceNumeric = distanceRaw.replace(/[^0-9.]/g, "");
        const amountRaw = rawAmount.trim();
        const amountNumeric = amountRaw.replace(/[^0-9.]/g, "");
        if (!name || !amountNumeric) return;

        importedStops.push({
          id: index + 1,
          name,
          distance: distanceNumeric,
          amount: amountNumeric,
          amountError: null,
          distanceError: null,
        });
      });

      if (!importedStops.length) {
        setStopsError(
          "Could not find any valid stops in the CSV. Expected: stop id, stop name, distance, fare stage, amount."
        );
        return;
      }

      setStops(importedStops);
      setStopsError(null);
    };

    reader.readAsText(file);
  };

  const handleStopChange = (
    id: number,
    field: "name" | "distance" | "amount",
    value: string
  ) => {
    setStops((prev) =>
      prev.map((stop) =>
        stop.id === id
          ? (() => {
              if (field === "amount") {
                const raw = value;
                const numeric = raw.replace(/[^0-9.]/g, "");
                return {
                  ...stop,
                  amount: numeric,
                  amountError:
                    raw && raw !== numeric
                      ? "Only numbers are allowed in this field."
                      : null,
                };
              }
              if (field === "distance") {
                const raw = value;
                const numeric = raw.replace(/[^0-9.]/g, "");
                return {
                  ...stop,
                  distance: numeric,
                  distanceError:
                    raw && raw !== numeric
                      ? "Only numbers are allowed in this field."
                      : null,
                };
              }
              return { ...stop, name: value };
            })()
          : stop
      )
    );
  };

  const handleOpenModal = () => {
    // reset form when opening
    setEditingRoute(null);
    setRouteNumber("");
    setRouteNumberError(null);
    setRouteName("");
    setRouteNameError(null);
    setStopsError(null);
    setStops([
      {
        id: 1,
        name: "",
        distance: "",
        amount: "",
        amountError: null,
        distanceError: null,
      },
    ]);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingRoute(null);
  };

  const handleEditRoute = (route: RouteDefinition) => {
    setEditingRoute(route);
    setRouteNumber(route.routeNumber);
    setRouteNumberError(null);
    setRouteName(route.routeName);
    setRouteNameError(null);
    setStopsError(null);
    setStops(
      route.stops.map((s, index) => ({
        ...s,
        id: index + 1,
        amountError: null,
        distanceError: null,
      }))
    );
    setIsModalOpen(true);
  };

  const openDeleteConfirmation = (route: RouteDefinition) => {
    setRoutePendingDelete(route);
  };

  const handleConfirmDelete = async () => {
    if (isDeletingRoute || !routePendingDelete) return;
    const route = routePendingDelete;

    setIsDeletingRoute(true);
    try {
      if (route.backendId) {
        await api.delete(`/routes/${route.backendId}`);
      }

      setRoutes((prev) => prev.filter((r) => r.id !== route.id));

      dispatch(
        addNotification({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          message: "Route deleted successfully",
          type: "success",
          timestamp: new Date().toISOString(),
          read: false,
        })
      );
    } catch {
      dispatch(
        addNotification({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          message: "Failed to delete route. Please try again.",
          type: "error",
          timestamp: new Date().toISOString(),
          read: false,
        })
      );
    } finally {
      setIsDeletingRoute(false);
      setRoutePendingDelete(null);
    }
  };

  const toggleRouteExpanded = (routeId: number) => {
    setExpandedRouteIds((prev) =>
      prev.includes(routeId)
        ? prev.filter((id) => id !== routeId)
        : [...prev, routeId]
    );
  };

  const handleSaveRoute = async () => {
    if (isSavingRoute) return;

    let isValid = true;

    const missingMessages: string[] = [];

    if (!routeNumber) {
      setRouteNumberError("Route number is required.");
      missingMessages.push("Route number is missing");
      isValid = false;
    } else if (routeNumberError) {
      isValid = false;
    }

    if (!routeName.trim()) {
      setRouteNameError("Route name is required.");
      missingMessages.push("Route name is missing");
      isValid = false;
    } else {
      setRouteNameError(null);
    }

    const hasValidStop = stops.some(
      (stop) =>
        stop.name.trim() !== "" &&
        stop.amount.trim() !== "" &&
        !stop.amountError
    );

    if (!hasValidStop) {
      setStopsError(
        "Add at least one stop with both a name and an amount."
      );
      missingMessages.push("At least one stop with name and amount is required");
      isValid = false;
    } else {
      setStopsError(null);
    }

    if (!isValid) {
      missingMessages.forEach((message) => {
        dispatch(
          addNotification({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            message,
            type: "error",
            timestamp: new Date().toISOString(),
            read: false,
          })
        );
      });
      return;
    }

    // Persist to backend and update local list
    const payload = {
      route_number: routeNumber,
      bus_number: "",
      description: routeName,
      stops: stops
        .filter((s) => s.name.trim().length > 0)
        .map((s) => ({
          name: s.name.trim(),
          distance: s.distance.trim(),
          amount: s.amount.trim(),
        })),
    };

    setIsSavingRoute(true);
    try {
      if (editingRoute && editingRoute.backendId) {
        await api.put(`/routes/${editingRoute.backendId}`, payload);

        setRoutes((prev) =>
          prev.map((r) =>
            r.id === editingRoute.id
              ? {
                  ...r,
                  routeNumber,
                  routeName,
                  stops: stops.map((s) => ({ ...s })),
                }
              : r
          )
        );

        dispatch(
          addNotification({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            message: "Route updated successfully",
            type: "success",
            timestamp: new Date().toISOString(),
            read: false,
          })
        );
      } else {
        const response = await api.post("/routes", payload);
        const createdRoute = (response.data as any)?.route;
        const backendId = createdRoute?.id as string | undefined;

        setRoutes((prev) => [
          ...prev,
          {
            id: prev.length ? prev[prev.length - 1].id + 1 : 1,
            backendId,
            routeNumber,
            routeName,
            stops: stops.map((s) => ({ ...s })),
          },
        ]);

        dispatch(
          addNotification({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            message: "Route created successfully",
            type: "success",
            timestamp: new Date().toISOString(),
            read: false,
          })
        );
      }

      setIsModalOpen(false);
      setEditingRoute(null);
    } catch {
      setStopsError("Failed to save route. Please try again.");
    } finally {
      setIsSavingRoute(false);
    }
  };

  useEffect(() => {
    const fetchRoutes = async () => {
      try {
        const response = await api.get("/routes", {
          params: { page: 1, limit: 20 },
        });
        const data = response.data as any;
        const backendRoutes = Array.isArray(data?.routes) ? data.routes : [];

        if (!backendRoutes.length) return;

        setRoutes(
          backendRoutes.map((r: any, index: number) => {
            const rawStops = Array.isArray(r.stops) ? r.stops : [];

            const mappedStops: RouteStop[] = rawStops.map(
              (s: any, stopIndex: number) => {
                if (typeof s === "string") {
                  return {
                    id: stopIndex + 1,
                    name: s,
                    distance: "",
                    amount: "",
                    amountError: null,
                    distanceError: null,
                  };
                }

                const distanceValue =
                  typeof s.distance_km === "number"
                    ? String(s.distance_km)
                    : typeof s.distance === "number"
                    ? String(s.distance)
                    : typeof s.distance === "string"
                    ? s.distance
                    : "";

                const amountValue =
                  typeof s.amount === "number"
                    ? String(s.amount)
                    : typeof s.amount === "string"
                    ? s.amount
                    : "";

                return {
                  id: stopIndex + 1,
                  name: s.name || "",
                  distance: distanceValue,
                  amount: amountValue,
                  amountError: null,
                  distanceError: null,
                };
              }
            );

            return {
              id: index + 1,
              backendId: r.id || r.ID,
              routeNumber: r.route_number || r.routeNumber || "",
              routeName: r.description || r.route_name || "",
              stops: mappedStops,
            };
          })
        );
      } catch {
        // If backend is not ready yet, just ignore and use local state
      }
    };

    fetchRoutes();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Routes</h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage bus routes and their configurations.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Route List</h2>
        </div>
        <div className="px-6 pt-3 pb-3 flex justify-start">
          <button
            type="button"
            onClick={handleOpenModal}
            className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-blue-700"
          >
            <span>+ Create Route</span>
          </button>
        </div>
        {routes.length === 0 ? (
          <div className="px-6 pb-10 pt-2 text-center text-sm text-slate-500">
            No routes added yet.
          </div>
        ) : (
          <div className="px-6 pt-0 pb-4 space-y-3 text-sm">
            {routes.map((route) => {
              const isExpanded = expandedRouteIds.includes(route.id);
              return (
                <div
                  key={route.id}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-xs"
                >
                  <button
                    type="button"
                    onClick={() => toggleRouteExpanded(route.id)}
                    className="flex w-full items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-slate-400 text-sm">
                        {isExpanded ? "▾" : "▸"}
                      </span>
                      <div className="text-left">
                        <p className="text-sm font-medium text-slate-900">
                          {route.routeNumber}
                          <span className="text-slate-500"> · </span>
                          {route.routeName}
                        </p>
                        <p className="text-xs text-slate-500">
                          {route.stops.length} stop
                          {route.stops.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditRoute(route);
                        }}
                        role="button"
                        aria-label="Edit route"
                        title="Edit"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 20 20"
                          className="h-3.5 w-3.5"
                          aria-hidden="true"
                        >
                          <path
                            d="M4 13.5V16h2.5L14 8.5 11.5 6 4 13.5zM15.8 6L14 4.2 15.2 3c.4-.4 1-.4 1.4 0l.4.4c.4.4.4 1 0 1.4L15.8 6z"
                            fill="currentColor"
                          />
                        </svg>
                      </span>
                      <span
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-red-500 hover:bg-red-50 hover:border-red-300 hover:text-red-600 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          openDeleteConfirmation(route);
                        }}
                        role="button"
                        aria-label="Delete route"
                        title="Delete"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 20 20"
                          className="h-3.5 w-3.5"
                          aria-hidden="true"
                        >
                          <path
                            d="M6 7.5V15C6 15.5523 6.44772 16 7 16H13C13.5523 16 14 15.5523 14 15V7.5"
                            stroke="currentColor"
                            strokeWidth="1.4"
                            strokeLinecap="round"
                          />
                          <path
                            d="M5 5.5H15"
                            stroke="currentColor"
                            strokeWidth="1.4"
                            strokeLinecap="round"
                          />
                          <path
                            d="M8.5 4.5H11.5"
                            stroke="currentColor"
                            strokeWidth="1.4"
                            strokeLinecap="round"
                          />
                        </svg>
                      </span>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-600 space-y-2">
                      <div className="hidden sm:grid grid-cols-[minmax(72px,auto),minmax(0,2fr),minmax(80px,auto),minmax(64px,auto),minmax(80px,auto)] gap-2 pb-1 text-[10px] font-medium text-slate-500 uppercase tracking-wide">
                        <span className="text-center">Stop Id</span>
                        <span>Stop Name</span>
                        <span className="text-right">Distance</span>
                        <span className="text-center">Fare Stage</span>
                        <span className="text-right">Amount</span>
                      </div>
                      <div className="space-y-1">
                        {route.stops.map((stop, index) => {
                          const stopCode = `S${String(index + 1).padStart(3, "0")}`;
                          const fareStage = index + 1;
                          return (
                            <div
                              key={stop.id}
                              className="flex flex-col sm:grid sm:grid-cols-[minmax(72px,auto),minmax(0,2fr),minmax(80px,auto),minmax(64px,auto),minmax(80px,auto)] gap-2"
                            >
                              <span className="text-center">{stopCode}</span>
                              <span>{stop.name || "-"}</span>
                              <span className="text-right">{stop.distance || "-"}</span>
                              <span className="text-center">{fareStage}</span>
                              <span className="text-right">{stop.amount || "-"}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-40 flex items-start justify-center bg-slate-900/40 overflow-y-auto py-10">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  {editingRoute ? "Edit Route" : "Create Route"}
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Define the basic details and stops for this route.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <RouteMapModal className="mb-4" />

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Route Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={routeNumber}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const digitsOnly = raw.replace(/\D/g, "");
                      setRouteNumber(digitsOnly);
                      if (raw && raw !== digitsOnly) {
                        setRouteNumberError("Only numbers are allowed in this field.");
                      } else {
                        setRouteNumberError(null);
                      }
                    }}
                    placeholder="e.g. 138"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {routeNumberError ? (
                    <p className="mt-1 text-[11px] text-red-500">
                      {routeNumberError}
                    </p>
                  ) : (
                    <p className="mt-1 text-[11px] text-slate-400">
                      Numbers only. Characters and symbols are not allowed.
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Route Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={routeName}
                    onChange={(e) => {
                      setRouteName(e.target.value);
                      if (e.target.value.trim()) {
                        setRouteNameError(null);
                      }
                    }}
                    placeholder="e.g. Colombo - Kandy"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {routeNameError && (
                    <p className="mt-1 text-[11px] text-red-500">
                      {routeNameError}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-medium text-slate-700">
                    Stops <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={handleAddStop}
                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <span className="text-sm">+</span>
                      <span>Add stop</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleImportClick}
                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                      title="Import CSV"
                    >
                      <img
                        src="/images/7191951.png"
                        alt="Import CSV"
                        className="h-4 w-4 object-contain"
                      />
                    </button>
                  </div>
                </div>
                <input
                  type="file"
                  accept=".csv"
                  ref={fileInputRef}
                  onChange={handleImportStops}
                  className="hidden"
                />
                <div className="hidden sm:grid grid-cols-[minmax(72px,auto),minmax(0,2fr),minmax(80px,auto),minmax(64px,auto),minmax(80px,auto)] gap-2 px-1 pb-1 text-[11px] font-medium text-slate-500 uppercase tracking-wide">
                  <span className="text-center">Stop Id</span>
                  <span>Stop Name</span>
                  <span className="text-right">Distance</span>
                  <span className="text-center">Fare Stage</span>
                  <span className="text-right">Amount</span>
                </div>

                <div className="space-y-3 pr-1">
                  {stops.map((stop, index) => {
                    const stopCode = `S${String(index + 1).padStart(3, "0")}`;
                    const fareStage = index + 1;
                    return (
                      <div key={stop.id} className="space-y-1">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                          <div className="flex items-center gap-2 min-w-[72px]">
                            {stops.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveStop(stop.id)}
                                className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-red-50 hover:border-red-300 hover:text-red-600 text-sm"
                                aria-label="Remove stop"
                              >
                                -
                              </button>
                            )}
                            <div className="flex-1 flex items-center justify-center px-3 py-2 rounded-lg border border-slate-100 bg-slate-50 text-[11px] text-slate-600">
                              {stopCode}
                            </div>
                          </div>

                          <input
                            type="text"
                            value={stop.name}
                            onChange={(e) =>
                              handleStopChange(
                                stop.id,
                                "name",
                                e.target.value
                              )
                            }
                            placeholder="Stop name"
                            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />

                          <input
                            type="text"
                            value={stop.distance}
                            onChange={(e) =>
                              handleStopChange(
                                stop.id,
                                "distance",
                                e.target.value
                              )
                            }
                            placeholder="Distance"
                            className="w-full sm:w-24 rounded-lg border border-slate-200 px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />

                          <div className="flex items-center justify-center px-3 py-2 rounded-lg border border-slate-100 bg-slate-50 text-[11px] text-slate-600 min-w-[56px]">
                            {fareStage}
                          </div>

                          <input
                            type="text"
                            value={stop.amount}
                            onChange={(e) =>
                              handleStopChange(
                                stop.id,
                                "amount",
                                e.target.value
                              )
                            }
                            placeholder="Amount"
                            className="w-full sm:w-24 rounded-lg border border-slate-200 px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        {(stop.distanceError || stop.amountError) && (
                          <div className="flex flex-col sm:flex-row gap-2 text-[11px]">
                            {stop.distanceError && (
                              <span className="text-red-500">
                                {stop.distanceError}
                              </span>
                            )}
                            {stop.amountError && (
                              <span className="text-red-500">
                                {stop.amountError}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {stopsError && (
                  <p className="mt-1 text-[11px] text-red-500">{stopsError}</p>
                )}
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={handleCloseModal}
                disabled={isSavingRoute}
                className="rounded-full border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveRoute}
                disabled={isSavingRoute}
                className="rounded-full bg-blue-600 px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSavingRoute
                  ? editingRoute
                    ? "Saving changes..."
                    : "Saving route..."
                  : editingRoute
                  ? "Save Changes"
                  : "Save Route"}
              </button>
            </div>
          </div>
        </div>
      )}
      {routePendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-2">
              Delete Route
            </h3>
            <p className="text-xs text-slate-600 mb-4">
              Are you sure you want to delete {" "}
              <span className="font-semibold text-slate-900">
                {routePendingDelete.routeNumber} · {routePendingDelete.routeName}
              </span>
              ?
            </p>
            <div className="flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setRoutePendingDelete(null)}
                disabled={isDeletingRoute}
                className="rounded-full border border-slate-200 px-4 py-1.5 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                No
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeletingRoute}
                className="rounded-full bg-red-600 px-4 py-1.5 font-medium text-white shadow-sm hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isDeletingRoute ? "Deleting..." : "Yes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoutesPage;
