import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import api from "../utils/axios";

type RouteSummary = {
  id: string;
  routeNumber: string;
  routeName: string;
};

type DepartureItem = {
  route_id: string;
  route_number: string;
  date: string;
  turn_number?: number;
  departure_time: string;
  bus_number: string;
  bus_owner: string;
};

const SummaryPage: React.FC = () => {
  const [routes, setRoutes] = useState<RouteSummary[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [departures, setDepartures] = useState<DepartureItem[]>([]);
  const [hasSetup, setHasSetup] = useState<boolean | null>(null);
  const [isDepartureLoading, setIsDepartureLoading] = useState(false);
  const [selectedDeparture, setSelectedDeparture] = useState<DepartureItem | null>(null);

  useEffect(() => {
    const loadRoutes = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const mapped: RouteSummary[] = [];
        const pageSize = 100;
        let page = 1;

        while (true) {
          const response = await api.get("/routes", {
            params: { page, limit: pageSize, include_stops: false },
          });
          const rows = Array.isArray(response.data?.routes) ? response.data.routes : [];
          if (!rows.length) break;

          mapped.push(
            ...rows
              .map((row: any) => ({
                id: row.id || "",
                routeNumber: row.route_number || "",
                routeName: row.description || "",
              }))
              .filter((r: RouteSummary) => r.id && r.routeNumber)
          );

          if (rows.length < pageSize) break;
          page += 1;
        }

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

  useEffect(() => {
    const loadDepartures = async () => {
      if (!selectedRouteId || !selectedDate) {
        setDepartures([]);
        return;
      }

      setIsDepartureLoading(true);
      setError(null);
      try {
        const response = await api.get("/departures", {
          params: {
            route_id: selectedRouteId,
            date: selectedDate,
          },
        });

        const rows = Array.isArray(response.data?.departures)
          ? response.data.departures
          : [];
        setDepartures(rows);
        // backend now returns has_setup:false when no timetable is configured
        if (typeof response.data?.has_setup === "boolean") {
          setHasSetup(response.data.has_setup);
        } else {
          // default to true for older backend responses
          setHasSetup(true);
        }
      } catch {
        setDepartures([]);
        setError("Failed to load departures for selected route/date.");
      } finally {
        setIsDepartureLoading(false);
      }
    };

    void loadDepartures();
  }, [selectedRouteId, selectedDate]);

  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 mb-1">{t("common.summary")}</h1>
        <p className="text-sm text-slate-500">{t("routes.title")}</p>
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
        <div className="mb-4 flex items-center gap-3">
          <label className="text-xs font-medium text-slate-600">Date</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {selectedRoute ? (
          <p className="text-xs text-slate-500 mb-4">
            Route {selectedRoute.routeNumber}
            {selectedRoute.routeName ? ` - ${selectedRoute.routeName}` : ""}
          </p>
        ) : (
          <p className="text-xs text-slate-500 mb-4">Choose a route to view departure times.</p>
        )}

        {selectedRoute && !isDepartureLoading && (
          <>
            {departures.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {departures.map((item) => (
                  <button
                    type="button"
                    key={`${item.date}-${item.departure_time}-${item.bus_number}-${item.turn_number || ""}`}
                    onClick={() => setSelectedDeparture(item)}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center hover:bg-blue-50"
                  >
                    <p className="text-xs text-slate-500">Departure</p>
                    <p className="text-sm font-semibold text-slate-800">{item.departure_time}</p>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                {hasSetup === false
                  ? "No timetable created for this date."
                  : "No departures assigned for this date."}
              </p>
            )}
          </>
        )}

        {isDepartureLoading && (
          <p className="text-xs text-slate-500">Loading departures...</p>
        )}
      </div>

      {selectedDeparture && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-xl">
            <div className="flex items-start justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-900">Departure Details</h3>
              <button
                type="button"
                onClick={() => setSelectedDeparture(null)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                ×
              </button>
            </div>
            <div className="px-5 py-4 space-y-2 text-sm text-slate-700">
              <p><span className="font-medium text-slate-900">Bus owner:</span> {selectedDeparture.bus_owner || "-"}</p>
              <p><span className="font-medium text-slate-900">Bus number:</span> {selectedDeparture.bus_number || "-"}</p>
              <p><span className="font-medium text-slate-900">Departure time:</span> {selectedDeparture.departure_time}</p>
              <p><span className="font-medium text-slate-900">Date:</span> {selectedDeparture.date}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SummaryPage;
