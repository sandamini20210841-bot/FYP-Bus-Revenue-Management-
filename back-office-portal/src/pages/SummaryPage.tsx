import React, { useEffect, useMemo, useState } from "react";
import api from "../utils/axios";

type RouteSummary = {
  id: string;
  routeNumber: string;
  routeName: string;
};

const BASE_TIMETABLE = [
  "05:30",
  "06:15",
  "07:00",
  "07:45",
  "08:30",
  "10:00",
  "11:30",
  "13:00",
  "14:30",
  "16:00",
  "17:30",
  "19:00",
];

const SummaryPage: React.FC = () => {
  const [routes, setRoutes] = useState<RouteSummary[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadRoutes = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await api.get("/routes", {
          params: { page: 1, limit: 500 },
        });
        const rows = Array.isArray(response.data?.routes) ? response.data.routes : [];

        const mapped: RouteSummary[] = rows
          .map((row: any) => ({
            id: row.id || "",
            routeNumber: row.route_number || "",
            routeName: row.description || "",
          }))
          .filter((r: RouteSummary) => r.id && r.routeNumber);

        setRoutes(mapped);
        if (mapped.length > 0) {
          setSelectedRouteId(mapped[0].id);
        }
      } catch {
        setRoutes([]);
        setError("Failed to load routes.");
      } finally {
        setIsLoading(false);
      }
    };

    void loadRoutes();
  }, []);

  const selectedRoute = useMemo(
    () => routes.find((r) => r.id === selectedRouteId) || null,
    [routes, selectedRouteId]
  );

  const departureTimes = useMemo(() => {
    if (!selectedRoute) return [];

    // Shift baseline timetable per route so each route can have a distinct schedule.
    const seed = selectedRoute.routeNumber
      .split("")
      .reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const shift = seed % 3;

    return BASE_TIMETABLE.map((time, index) => {
      if (index % 3 !== shift) return time;

      const [hoursText, minutesText] = time.split(":");
      const hours = Number.parseInt(hoursText, 10);
      const minutes = Number.parseInt(minutesText, 10) + 10;
      const adjustedHours = minutes >= 60 ? (hours + 1) % 24 : hours;
      const adjustedMinutes = minutes >= 60 ? minutes - 60 : minutes;

      return `${String(adjustedHours).padStart(2, "0")}:${String(adjustedMinutes).padStart(2, "0")}`;
    });
  }, [selectedRoute]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 mb-1">Route Summary</h1>
        <p className="text-sm text-slate-500">
          Select a route to view the bus departure timetable.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-slate-900 mb-3">All Routes</h2>

        {isLoading && <p className="text-xs text-slate-500">Loading routes...</p>}
        {!isLoading && error && <p className="text-xs text-red-500">{error}</p>}

        {!isLoading && !error && routes.length === 0 && (
          <p className="text-xs text-slate-500">No routes available yet.</p>
        )}

        {!isLoading && !error && routes.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {routes.map((route) => {
              const isSelected = route.id === selectedRouteId;
              return (
                <button
                  key={route.id}
                  type="button"
                  onClick={() => setSelectedRouteId(route.id)}
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                    isSelected
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {route.routeNumber}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-slate-900 mb-1">Departure Timetable</h2>
        {selectedRoute ? (
          <p className="text-xs text-slate-500 mb-4">
            Route {selectedRoute.routeNumber}
            {selectedRoute.routeName ? ` - ${selectedRoute.routeName}` : ""}
          </p>
        ) : (
          <p className="text-xs text-slate-500 mb-4">Choose a route to view departure times.</p>
        )}

        {selectedRoute && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {departureTimes.map((time) => (
              <div
                key={time}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center"
              >
                <p className="text-xs text-slate-500">Departure</p>
                <p className="text-sm font-semibold text-slate-800">{time}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SummaryPage;
