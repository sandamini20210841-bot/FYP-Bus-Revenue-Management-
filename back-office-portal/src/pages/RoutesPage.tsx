import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch } from "react-redux";
import type { AppDispatch } from "../store";
import { addNotification } from "../store/slices/alertsSlice";
import api from "../utils/axios";
import RouteMapModal from "../components/RouteMapModal";
import { useAccessPermissions } from "../hooks/useAccessPermissions";

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
  latitude?: number;
  longitude?: number;
  stops: RouteStop[];
  stopsCount?: number;
  stopsLoaded?: boolean;
  isLoadingStops?: boolean;
}

interface RouteSectionForm {
  id: number;
  name: string;
  isCollapsed: boolean;
  stops: RouteStop[];
}

type GroupedStopSection = {
  sectionName: string;
  sectionStop: RouteStop | null;
  subStops: RouteStop[];
};

const DEFAULT_ROUTE_COORDINATES = {
  lat: 6.9271,
  lon: 79.8612,
};
const ROUTES_PAGE_SIZE = 20;

const splitStopHierarchy = (stopName: string) => {
  const value = stopName.trim();
  if (!value) {
    return { section: "Unnamed section", subSection: "" };
  }

  const separators = [" > ", " -> ", " - ", " : ", " | ", "/"];
  for (const separator of separators) {
    if (value.includes(separator)) {
      const parts = value
        .split(separator)
        .map((part) => part.trim())
        .filter((part) => part.length > 0);
      if (parts.length >= 2) {
        return {
          section: parts[0],
          subSection: parts.slice(1).join(" / "),
        };
      }
    }
  }

  return { section: value, subSection: "" };
};

const groupStopsBySection = (stops: RouteStop[]): GroupedStopSection[] => {
  const groupedMap = new Map<string, GroupedStopSection>();

  stops.forEach((stop) => {
    const parsed = splitStopHierarchy(stop.name || "");
    const sectionKey = parsed.section || "Unnamed section";

    if (!groupedMap.has(sectionKey)) {
      groupedMap.set(sectionKey, {
        sectionName: sectionKey,
        sectionStop: null,
        subStops: [],
      });
    }

    const bucket = groupedMap.get(sectionKey)!;
    if (!parsed.subSection) {
      bucket.sectionStop = stop;
      return;
    }

    bucket.subStops.push({
      ...stop,
      name: parsed.subSection,
    });
  });

  return Array.from(groupedMap.values());
};

const createEmptyStop = (id: number): RouteStop => ({
  id,
  name: "",
  distance: "",
  amount: "",
  amountError: null,
  distanceError: null,
});

const createEmptySection = (id: number): RouteSectionForm => ({
  id,
  name: "",
  isCollapsed: false,
  stops: [createEmptyStop(1)],
});

const mapBackendStops = (rawStops: any[]): RouteStop[] =>
  rawStops.map((s: any, stopIndex: number) => {
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
      typeof s?.distance_km === "number"
        ? String(s.distance_km)
        : typeof s?.distance === "number"
        ? String(s.distance)
        : typeof s?.distance === "string"
        ? s.distance
        : "";

    const amountValue =
      typeof s?.amount === "number"
        ? String(s.amount)
        : typeof s?.amount === "string"
        ? s.amount
        : "";

    return {
      id: stopIndex + 1,
      name: s?.name || "",
      distance: distanceValue,
      amount: amountValue,
      amountError: null,
      distanceError: null,
    };
  });

const RoutesPage: React.FC = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch<AppDispatch>();
  const { canCreate, canEdit, canDelete } = useAccessPermissions();
  const canCreateRoutes = canCreate("routes");
  const canEditRoutes = canEdit("routes");
  const canDeleteRoutes = canDelete("routes");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [routeNumber, setRouteNumber] = useState("");
  const [routeNumberError, setRouteNumberError] = useState<string | null>(
    null
  );
  const [routeName, setRouteName] = useState("");
  const [routeNameError, setRouteNameError] = useState<string | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState(
    DEFAULT_ROUTE_COORDINATES
  );
  const [stopsError, setStopsError] = useState<string | null>(null);
  const [sections, setSections] = useState<RouteSectionForm[]>([
    createEmptySection(1),
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

  const hydrateRouteStops = async (route: RouteDefinition): Promise<RouteDefinition> => {
    if (route.stopsLoaded || !route.backendId) {
      return route;
    }

    setRoutes((prev) =>
      prev.map((r) =>
        r.id === route.id ? { ...r, isLoadingStops: true } : r
      )
    );

    try {
      const response = await api.get(`/routes/${route.backendId}`);
      const backendRoute = (response.data as any)?.route || {};
      const rawStops = Array.isArray(backendRoute?.stops) ? backendRoute.stops : [];
      const mappedStops = mapBackendStops(rawStops);
      const stopsCount =
        typeof backendRoute?.stops_count === "number"
          ? backendRoute.stops_count
          : mappedStops.length;

      const hydratedRoute: RouteDefinition = {
        ...route,
        routeNumber:
          backendRoute?.route_number && typeof backendRoute.route_number === "string"
            ? backendRoute.route_number
            : route.routeNumber,
        routeName:
          backendRoute?.description && typeof backendRoute.description === "string"
            ? backendRoute.description
            : route.routeName,
        latitude:
          typeof backendRoute?.latitude === "number"
            ? backendRoute.latitude
            : route.latitude,
        longitude:
          typeof backendRoute?.longitude === "number"
            ? backendRoute.longitude
            : route.longitude,
        stops: mappedStops,
        stopsCount,
        stopsLoaded: true,
        isLoadingStops: false,
      };

      setRoutes((prev) =>
        prev.map((r) => (r.id === route.id ? hydratedRoute : r))
      );

      return hydratedRoute;
    } catch {
      setRoutes((prev) =>
        prev.map((r) =>
          r.id === route.id ? { ...r, isLoadingStops: false } : r
        )
      );
      throw new Error("Failed to load route stops");
    }
  };

  const handleAddSection = () => {
    setSections((prev) => [
      ...prev,
      createEmptySection(prev.length ? prev[prev.length - 1].id + 1 : 1),
    ]);
  };

  const handleRemoveSection = (sectionId: number) => {
    setSections((prev) => {
      if (prev.length === 1) return prev;
      const updated = prev.filter((section) => section.id !== sectionId);
      return updated.length ? updated : prev;
    });
  };

  const toggleSectionCollapsed = (sectionId: number) => {
    setSections((prev) =>
      prev.map((section) =>
        section.id === sectionId
          ? { ...section, isCollapsed: !section.isCollapsed }
          : section
      )
    );
  };

  const handleSectionNameChange = (sectionId: number, value: string) => {
    setSections((prev) =>
      prev.map((section) =>
        section.id === sectionId ? { ...section, name: value } : section
      )
    );
  };

  const handleAddStopToSection = (sectionId: number) => {
    setSections((prev) =>
      prev.map((section) => {
        if (section.id !== sectionId) return section;
        const nextStopId = section.stops.length
          ? section.stops[section.stops.length - 1].id + 1
          : 1;
        return {
          ...section,
          stops: [...section.stops, createEmptyStop(nextStopId)],
        };
      })
    );
  };

  const handleRemoveStopFromSection = (sectionId: number, stopId: number) => {
    setSections((prev) =>
      prev.map((section) => {
        if (section.id !== sectionId) return section;
        if (section.stops.length === 1) return section;
        const updatedStops = section.stops.filter((stop) => stop.id !== stopId);
        return {
          ...section,
          stops: updatedStops.length ? updatedStops : section.stops,
        };
      })
    );
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

      const parsedRows = lines.map((line) =>
        line
          .split(",")
          .map((part) => part.trim().replace(/^"|"$/g, ""))
      );
      if (!parsedRows.length) {
        setStopsError("CSV file is empty.");
        return;
      }

      const header = parsedRows[0].map((value) =>
        value.toLowerCase().replace(/\s+/g, "_")
      );

      const indexOfFirst = (...candidates: string[]) =>
        candidates
          .map((name) => header.indexOf(name))
          .find((idx) => idx >= 0) ?? -1;

      const sectionIdx = indexOfFirst("section", "main_section", "section_name");
      const subStopIdx = indexOfFirst("sub_stop", "sub_section", "stop", "stop_name", "sub_stop_name");
      const amountIdx = indexOfFirst("amount", "fare", "fare_amount");

      const hasNewTemplateColumns = sectionIdx >= 0 && subStopIdx >= 0 && amountIdx >= 0;
      const dataRows = hasNewTemplateColumns ? parsedRows.slice(1) : parsedRows;

      const importedSections = new Map<string, RouteStop[]>();

      dataRows.forEach((parts) => {
        let sectionName = "";
        let subStopName = "";
        let amountRaw = "";

        if (hasNewTemplateColumns) {
          sectionName = (parts[sectionIdx] || "").trim();
          subStopName = (parts[subStopIdx] || "").trim();
          amountRaw = (parts[amountIdx] || "").trim();
        } else {
          // Backward compatibility for older 5-column sheet format.
          if (parts.length < 5) return;
          const rawName = (parts[1] || "").trim();
          const parsed = splitStopHierarchy(rawName);
          sectionName = (parsed.section || "").trim();
          subStopName = (parsed.subSection || parsed.section || "").trim();
          amountRaw = (parts[4] || "").trim();
        }

        const amountNumeric = amountRaw.replace(/[^0-9.]/g, "");
        if (!sectionName || !subStopName || !amountNumeric) return;

        if (!importedSections.has(sectionName)) {
          importedSections.set(sectionName, []);
        }

        importedSections.get(sectionName)!.push({
          id: importedSections.get(sectionName)!.length + 1,
          name: subStopName,
          distance: "",
          amount: amountNumeric,
          amountError: null,
          distanceError: null,
        });
      });

      if (!importedSections.size) {
        setStopsError(
          "Could not find valid rows. Expected columns: section, sub_stop, amount."
        );
        return;
      }

      const nextSections: RouteSectionForm[] = Array.from(importedSections.entries()).map(
        ([name, importedStops], index) => ({
          id: index + 1,
          name,
          isCollapsed: false,
          stops: importedStops.length ? importedStops : [createEmptyStop(1)],
        })
      );

      setSections(nextSections);
      setStopsError(null);
    };

    reader.readAsText(file);
  };

  const handleStopChange = (
    sectionId: number,
    stopId: number,
    field: "name" | "distance" | "amount",
    value: string
  ) => {
    setSections((prev) =>
      prev.map((section) => {
        if (section.id !== sectionId) return section;
        return {
          ...section,
          stops: section.stops.map((stop) =>
            stop.id === stopId
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
          ),
        };
      })
    );
  };

  const handleOpenModal = () => {
    if (!canCreateRoutes) return;

    // reset form when opening
    setEditingRoute(null);
    setRouteNumber("");
    setRouteNumberError(null);
    setRouteName("");
    setRouteNameError(null);
    setRouteCoordinates(DEFAULT_ROUTE_COORDINATES);
    setStopsError(null);
    setSections([createEmptySection(1)]);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingRoute(null);
  };

  const handleEditRoute = async (route: RouteDefinition) => {
    if (!canEditRoutes) return;

    let routeToEdit = route;
    if (!route.stopsLoaded && route.backendId) {
      try {
        routeToEdit = await hydrateRouteStops(route);
      } catch {
        dispatch(
          addNotification({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            message: "Failed to load route stops. Please try again.",
            type: "error",
            timestamp: new Date().toISOString(),
            read: false,
          })
        );
        return;
      }
    }

    setEditingRoute(routeToEdit);
    setRouteNumber(routeToEdit.routeNumber);
    setRouteNumberError(null);
    setRouteName(routeToEdit.routeName);
    setRouteNameError(null);
    setRouteCoordinates({
      lat: routeToEdit.latitude ?? DEFAULT_ROUTE_COORDINATES.lat,
      lon: routeToEdit.longitude ?? DEFAULT_ROUTE_COORDINATES.lon,
    });
    setStopsError(null);
    const grouped = groupStopsBySection(routeToEdit.stops);
    const mappedSections = grouped.map((section, index) => {
      const parsedSectionStops: RouteStop[] = [];

      if (section.sectionStop) {
        const parsed = splitStopHierarchy(section.sectionStop.name || "");
        const sectionStopName = parsed.subSection || parsed.section || section.sectionName;
        parsedSectionStops.push({
          ...section.sectionStop,
          id: parsedSectionStops.length + 1,
          name: sectionStopName,
          amountError: null,
          distanceError: null,
        });
      }

      section.subStops.forEach((stop) => {
        parsedSectionStops.push({
          ...stop,
          id: parsedSectionStops.length + 1,
          amountError: null,
          distanceError: null,
        });
      });

      return {
        id: index + 1,
        name: section.sectionName,
        isCollapsed: false,
        stops: parsedSectionStops.length
          ? parsedSectionStops
          : [createEmptyStop(1)],
      };
    });

    setSections(mappedSections.length ? mappedSections : [createEmptySection(1)]);
    setIsModalOpen(true);
  };

  const openDeleteConfirmation = (route: RouteDefinition) => {
    if (!canDeleteRoutes) return;
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
    } catch (error: any) {
      const backendMessageFromApi =
        typeof error?.response?.data?.error === "string"
          ? error.response.data.error.trim()
          : "";
      const isTimedOut = error?.code === "ECONNABORTED";
      const isCanceled = error?.code === "ERR_CANCELED";
      const backendMessage =
        backendMessageFromApi ||
        (isTimedOut
          ? "Delete request timed out. This route may have many linked records; please retry."
          : isCanceled
          ? "Delete request was canceled before the server responded. Please retry."
          : "Failed to delete route. Please try again.");

      dispatch(
        addNotification({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          message: backendMessage,
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

  const toggleRouteExpanded = async (route: RouteDefinition) => {
    const isExpanded = expandedRouteIds.includes(route.id);
    if (isExpanded) {
      setExpandedRouteIds((prev) => prev.filter((id) => id !== route.id));
      return;
    }

    setExpandedRouteIds((prev) => [...prev, route.id]);
    if (!route.stopsLoaded && route.backendId && !route.isLoadingStops) {
      try {
        await hydrateRouteStops(route);
      } catch {
        dispatch(
          addNotification({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            message: "Failed to load route stops.",
            type: "error",
            timestamp: new Date().toISOString(),
            read: false,
          })
        );
      }
    }
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

    const hasValidSection = sections.some((section) => section.name.trim() !== "");

    const flattenedStops = sections.flatMap((section) =>
      section.stops
        .filter((s) => s.name.trim().length > 0)
        .map((s) => {
          const sectionName = section.name.trim();
          const stopName = s.name.trim();
          const composedName =
            !sectionName || sectionName === stopName
              ? stopName
              : `${sectionName} - ${stopName}`;

          return {
            name: composedName,
            distance: s.distance.trim(),
            amount: s.amount.trim(),
          };
        })
    );

    const hasValidStop = sections.some((section) =>
      section.stops.some(
        (stop) =>
          section.name.trim() !== "" &&
          stop.name.trim() !== "" &&
          stop.amount.trim() !== "" &&
          !stop.amountError
      )
    );

    if (!hasValidSection) {
      setStopsError("Add at least one section name.");
      missingMessages.push("At least one section is required");
      isValid = false;
    }

    if (!hasValidStop) {
      setStopsError(
        "Add at least one stop with section, stop name and amount."
      );
      missingMessages.push("At least one stop with section, name and amount is required");
      isValid = false;
    } else {
      setStopsError(null);

      const stopAmounts = flattenedStops
        .map((stop) => Number.parseFloat(stop.amount))
        .filter((value) => Number.isFinite(value) && value > 0);

      const hasDescendingFareStage = stopAmounts.some(
        (value, index) => index > 0 && value < stopAmounts[index - 1]
      );

      if (hasDescendingFareStage) {
        setStopsError(
          "Fare amounts must follow ascending stage order (e.g., 30, 39, 50, 62...)."
        );
        missingMessages.push("Fare amounts are not in ascending stage order");
        isValid = false;
      }
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
      latitude: routeCoordinates.lat,
      longitude: routeCoordinates.lon,
      stops: flattenedStops,
    };

    setIsSavingRoute(true);
    try {
      if (editingRoute && editingRoute.backendId) {
        await api.put(`/routes/${editingRoute.backendId}`, payload, {
          timeout: 60000,
        });

        setRoutes((prev) =>
          prev.map((r) =>
                r.id === editingRoute.id
              ? {
                  ...r,
                  routeNumber,
                  routeName,
                  latitude: routeCoordinates.lat,
                  longitude: routeCoordinates.lon,
                  stops: flattenedStops.map((s, idx) => ({
                    id: idx + 1,
                    name: s.name,
                    distance: s.distance,
                    amount: s.amount,
                    amountError: null,
                    distanceError: null,
                  })),
                  stopsCount: flattenedStops.length,
                  stopsLoaded: true,
                  isLoadingStops: false,
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
            latitude: routeCoordinates.lat,
            longitude: routeCoordinates.lon,
            stops: flattenedStops.map((s, idx) => ({
              id: idx + 1,
              name: s.name,
              distance: s.distance,
              amount: s.amount,
              amountError: null,
              distanceError: null,
            })),
            stopsCount: flattenedStops.length,
            stopsLoaded: true,
            isLoadingStops: false,
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
    } catch (error: any) {
      console.error("Failed to save route", error);

      const backendMessageFromApi =
        typeof error?.response?.data?.error === "string"
          ? error.response.data.error.trim()
          : "";
      const isTimedOut = error?.code === "ECONNABORTED";
      const isCanceled = error?.code === "ERR_CANCELED";
      const backendMessage =
        backendMessageFromApi ||
        (isTimedOut
          ? "Save request timed out. Please retry in a few seconds."
          : isCanceled
          ? "Save request was canceled before the server responded. Please retry."
          : "Failed to save route. Please try again.");

      setStopsError(backendMessage);

      dispatch(
        addNotification({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          message: backendMessage,
          type: "error",
          timestamp: new Date().toISOString(),
          read: false,
        })
      );
    } finally {
      setIsSavingRoute(false);
    }
  };

  useEffect(() => {
    let isCancelled = false;

    const fetchRoutes = async () => {
      let page = 1;
      try {
        while (!isCancelled) {
          const response = await api.get("/routes", {
            params: { page, limit: ROUTES_PAGE_SIZE, include_stops: false },
          });
          const data = response.data as any;
          const backendRoutes = Array.isArray(data?.routes) ? data.routes : [];
          if (!backendRoutes.length) break;

          if (isCancelled) return;

          setRoutes((prev) => {
            const nextStartId = prev.length ? prev[prev.length - 1].id + 1 : 1;
            const mapped = backendRoutes.map((r: any, index: number) => {
              const rawStops = Array.isArray(r?.stops) ? r.stops : [];
              const mappedStops = mapBackendStops(rawStops);
              return {
                id: nextStartId + index,
                backendId: r.id || r.ID,
                routeNumber: r.route_number || r.routeNumber || "",
                routeName: r.description || r.route_name || "",
                latitude:
                  typeof r.latitude === "number"
                    ? r.latitude
                    : typeof r.lat === "number"
                    ? r.lat
                    : undefined,
                longitude:
                  typeof r.longitude === "number"
                    ? r.longitude
                    : typeof r.lon === "number"
                    ? r.lon
                    : undefined,
                stops: mappedStops,
                stopsCount:
                  typeof r.stops_count === "number"
                    ? r.stops_count
                    : mappedStops.length,
                stopsLoaded: Array.isArray(r?.stops),
                isLoadingStops: false,
              } as RouteDefinition;
            });
            return [...prev, ...mapped];
          });

          if (backendRoutes.length < ROUTES_PAGE_SIZE) break;
          page += 1;
        }
      } catch {
        // If backend is not ready yet, just ignore and use local state
      }
    };

    fetchRoutes();
    return () => {
      isCancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{t("routes.title")}</h1>
        <p className="text-sm text-slate-500 mt-1">{t("common.routes")}</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Route List</h2>
        </div>
        <div className="px-6 pt-3 pb-3 flex justify-start">
          {canCreateRoutes && (
            <button
              type="button"
              onClick={handleOpenModal}
              className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-blue-700"
            >
              <span>+ Create Route</span>
            </button>
          )}
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
                    onClick={() => {
                      void toggleRouteExpanded(route);
                    }}
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
                          {route.isLoadingStops
                            ? "Loading stops..."
                            : `${
                                route.stopsLoaded
                                  ? route.stops.length
                                  : route.stopsCount ?? route.stops.length
                              } stop${
                                (route.stopsLoaded
                                  ? route.stops.length
                                  : route.stopsCount ?? route.stops.length) !== 1
                                  ? "s"
                                  : ""
                              }`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {canEditRoutes && (
                        <span
                          className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleEditRoute(route);
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
                      )}
                      {canDeleteRoutes && (
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
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="mt-4 border-t border-slate-100 pt-4 text-xs text-slate-600">
                      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                        <div className="hidden sm:grid grid-cols-[minmax(80px,auto),minmax(0,2fr),minmax(72px,auto),minmax(96px,auto)] gap-3 border-b border-slate-200 bg-slate-50/90 px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-[0.08em]">
                          <span className="text-center">Section</span>
                          <span>Section / Sub Section</span>
                          <span className="block w-full text-center leading-tight">
                          Fare
                          <br />
                          Stage
                        </span>
                          <span className="text-right">Amount</span>
                        </div>

                        <div className="space-y-1 p-2">
                          {route.isLoadingStops ? (
                            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-center text-xs text-slate-500">
                              Loading stops...
                            </div>
                          ) : route.stops.length === 0 ? (
                            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-center text-xs text-slate-500">
                              No stops available for this route.
                            </div>
                          ) : (
                            groupStopsBySection(route.stops).map((section, sectionIndex) => {
                          const sectionCode = `SEC${String(sectionIndex + 1).padStart(2, "0")}`;

                          return (
                            <div key={`${route.id}-${section.sectionName}-${sectionIndex}`} className="space-y-1.5">
                              <div className="flex flex-col sm:grid sm:grid-cols-[minmax(80px,auto),minmax(0,2fr),minmax(72px,auto),minmax(96px,auto)] gap-3 rounded-lg border border-blue-200 bg-gradient-to-r from-blue-50 to-blue-100/50 px-3 py-2">
                                <span className="inline-flex items-center justify-center rounded-md bg-blue-100 px-2 py-0.5 text-center font-semibold tracking-wide text-blue-700">
                                  {sectionCode}
                                </span>
                                <span className="font-semibold text-slate-800">{section.sectionName}</span>
                                <span className="text-center font-medium text-slate-700">{sectionIndex + 1}</span>
                                <span className="text-right font-semibold text-slate-800">{section.sectionStop?.amount || "-"}</span>
                              </div>

                              {section.subStops.map((subStop, subIndex) => {
                                const subCode = `${sectionCode}.${subIndex + 1}`;
                                return (
                                  <div
                                    key={`${route.id}-${section.sectionName}-sub-${subStop.id}-${subIndex}`}
                                    className="flex flex-col sm:grid sm:grid-cols-[minmax(80px,auto),minmax(0,2fr),minmax(72px,auto),minmax(96px,auto)] gap-3 rounded-md px-3 py-1.5 pl-5 transition-colors hover:bg-slate-50/80"
                                  >
                                    <span className="text-center text-slate-500">{subCode}</span>
                                    <span className="text-slate-700">↳ {subStop.name || "-"}</span>
                                    <span className="text-center text-slate-600">{sectionIndex + 1}.{subIndex + 1}</span>
                                    <span className="text-right font-medium text-slate-700">{subStop.amount || "-"}</span>
                                  </div>
                                );
                              })}
                            </div>
                          );
                            })
                          )}
                        </div>
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
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl p-6 max-h-[90vh] overflow-y-auto">
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

            <RouteMapModal
              className="mb-4"
              center={routeCoordinates}
              onLocationChange={setRouteCoordinates}
            />

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
                      const sanitized = raw.replace(/[^0-9/]/g, "");
                      setRouteNumber(sanitized);
                      if (raw && raw !== sanitized) {
                        setRouteNumberError("Only numbers and / are allowed in this field.");
                      } else {
                        setRouteNumberError(null);
                      }
                    }}
                    placeholder="e.g. 138/1"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {routeNumberError ? (
                    <p className="mt-1 text-[11px] text-red-500">
                      {routeNumberError}
                    </p>
                  ) : (
                    <p className="mt-1 text-[11px] text-slate-400">
                      Numbers and / only. Other characters are not allowed.
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
                    Sections and Stops <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={handleAddSection}
                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <span className="text-sm">+</span>
                      <span>Add section</span>
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
                <div className="space-y-3 pr-1">
                  {sections.map((section, sectionIndex) => (
                    <div key={section.id} className="rounded-xl border border-slate-200 overflow-hidden">
                      <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200">
                        <button
                          type="button"
                          onClick={() => toggleSectionCollapsed(section.id)}
                          className="h-7 w-7 rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-100"
                          aria-label={section.isCollapsed ? "Expand section" : "Collapse section"}
                        >
                          {section.isCollapsed ? "▸" : "▾"}
                        </button>
                        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                          Section {sectionIndex + 1}
                        </span>
                        <input
                          type="text"
                          value={section.name}
                          onChange={(e) => handleSectionNameChange(section.id, e.target.value)}
                          placeholder="Section name (main stop)"
                          className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        {sections.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveSection(section.id)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-red-200 text-red-600 hover:bg-red-50"
                            aria-label="Remove section"
                            title="Remove section"
                          >
                            -
                          </button>
                        )}
                      </div>

                      {!section.isCollapsed && (
                        <div className="p-3 space-y-3">
                          <div className="hidden sm:grid grid-cols-[minmax(88px,auto),minmax(0,2fr),minmax(72px,auto),minmax(96px,auto)] gap-2 px-1 pb-1 text-[11px] font-medium text-slate-500 uppercase tracking-wide">
                            <span className="text-center">Stop Id</span>
                            <span>Sub Section / Stop</span>
                            <span className="block w-full text-center leading-tight -translate-x-1">
                              Fare
                              <br />
                              Stage
                            </span>
                            <span className="text-right">Amount</span>
                          </div>

                          <div className="space-y-2">
                            {section.stops.map((stop, stopIndex) => {
                              const stopCode = `S${String(sectionIndex + 1).padStart(2, "0")}.${String(stopIndex + 1).padStart(2, "0")}`;
                              const fareStage = `${sectionIndex + 1}.${stopIndex + 1}`;

                              return (
                                <div key={`${section.id}-${stop.id}`} className="space-y-1">
                                  <div className="flex flex-col sm:grid sm:grid-cols-[minmax(88px,auto),minmax(0,2fr),minmax(72px,auto),minmax(96px,auto)] sm:items-center gap-2">
                                    <div className="flex items-center gap-1">
                                      {section.stops.length > 1 && (
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveStopFromSection(section.id, stop.id)}
                                          className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-red-50 hover:border-red-300 hover:text-red-600 text-sm"
                                          aria-label="Remove stop"
                                        >
                                          -
                                        </button>
                                      )}
                                      {section.stops.length <= 1 && <span className="h-7 w-7" />}
                                      <div className="flex-1 flex items-center justify-center px-3 py-2 rounded-lg border border-slate-100 bg-slate-50 text-[11px] text-slate-600">
                                        {stopCode}
                                      </div>
                                    </div>

                                    <input
                                      type="text"
                                      value={stop.name}
                                      onChange={(e) =>
                                        handleStopChange(section.id, stop.id, "name", e.target.value)
                                      }
                                      placeholder="Sub section / stop name"
                                      className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />

                                    <div className="flex items-center justify-center px-3 py-2 rounded-lg border border-slate-100 bg-slate-50 text-[11px] text-slate-600 min-w-[56px]">
                                      {fareStage}
                                    </div>

                                    <input
                                      type="text"
                                      value={stop.amount}
                                      onChange={(e) =>
                                        handleStopChange(section.id, stop.id, "amount", e.target.value)
                                      }
                                      placeholder="Amount"
                                      className="w-full sm:w-24 rounded-lg border border-slate-200 px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                  </div>
                                  {stop.amountError && (
                                    <div className="flex flex-col sm:flex-row gap-2 text-[11px]">
                                      {stop.amountError && (
                                        <span className="text-red-500">{stop.amountError}</span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          <div>
                            <button
                              type="button"
                              onClick={() => handleAddStopToSection(section.id)}
                              className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                            >
                              <span className="text-sm">+</span>
                              <span>Add stop to section</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
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
