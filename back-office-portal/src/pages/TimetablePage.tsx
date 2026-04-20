import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import api from "../utils/axios";

type RouteSummary = {
  id: string;
  routeNumber: string;
};

type TimetableEntry = {
  turn_number: number;
  bus_number: string;
  departure_time?: string;
  bus_owner?: string;
};

type RouteCalendarDate = {
  date: string;
  assigned_turns: number;
  total_turns: number;
  is_complete: boolean;
};

const normalizeEntries = (entries: TimetableEntry[]): Array<{ turn: number; bus: string; departure: string }> => {
  return [...entries]
    .map((entry) => ({
      turn: Number(entry.turn_number),
      bus: String(entry.bus_number || ""),
      departure: String(entry.departure_time || ""),
    }))
    .sort((a, b) => a.turn - b.turn);
};

const areEntriesEqual = (left: TimetableEntry[], right: TimetableEntry[]): boolean => {
  const a = normalizeEntries(left);
  const b = normalizeEntries(right);
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i].turn !== b[i].turn || a[i].bus !== b[i].bus || a[i].departure !== b[i].departure) {
      return false;
    }
  }
  return true;
};

const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const buildMonthDays = (monthCursor: Date): Date[] => {
  const first = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1);
  const start = new Date(first);
  const shift = (first.getDay() + 6) % 7;
  start.setDate(first.getDate() - shift);
  return Array.from({ length: 42 }, (_, i) => {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    return day;
  });
};

const TimetablePage: React.FC = () => {
  const { t } = useTranslation();
  const [routes, setRoutes] = useState<RouteSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isTimetableModalOpen, setIsTimetableModalOpen] = useState(false);
  const [timetableRouteId, setTimetableRouteId] = useState<string>("");
  const [totalTurnsInput, setTotalTurnsInput] = useState<string>("12");
  const [configuredTurns, setConfiguredTurns] = useState<number>(0);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [monthCursor, setMonthCursor] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [routeBuses, setRouteBuses] = useState<Array<{ bus_number: string }>>([]);
  const [persistedEntries, setPersistedEntries] = useState<TimetableEntry[]>([]);
  const [draftEntries, setDraftEntries] = useState<TimetableEntry[]>([]);
  const [draftEntriesByDate, setDraftEntriesByDate] = useState<Record<string, TimetableEntry[]>>({});
  const [completeSavedDates, setCompleteSavedDates] = useState<Record<string, boolean>>({});
  const [routeCalendars, setRouteCalendars] = useState<Record<string, RouteCalendarDate[]>>({});
  const [expandedCalendarRows, setExpandedCalendarRows] = useState<Record<string, boolean>>({});
  const [calendarDetails, setCalendarDetails] = useState<Record<string, TimetableEntry[]>>({});
  const [calendarDetailsLoading, setCalendarDetailsLoading] = useState<Record<string, boolean>>({});
  const [turnToAssign, setTurnToAssign] = useState<string>("1");
  const [busToAssign, setBusToAssign] = useState<string>("");
  const [departureTimeToAssign, setDepartureTimeToAssign] = useState<string>("");
  const [isSavingSetup, setIsSavingSetup] = useState(false);
  const [isSavingTimetable, setIsSavingTimetable] = useState(false);
  const [calendarActionKey, setCalendarActionKey] = useState<string | null>(null);
  const [timetableError, setTimetableError] = useState<string | null>(null);
  const [timetableSuccess, setTimetableSuccess] = useState<string | null>(null);

  const getApiErrorMessage = (err: any, fallback: string): string => {
    const data = err?.response?.data;
    if (typeof data?.error === "string" && data.error.trim()) {
      return data.error;
    }
    if (typeof data === "string" && data.trim()) {
      return data;
    }
    if (data && typeof data === "object") {
      try {
        return JSON.stringify(data);
      } catch {
        // Ignore stringify failures and continue fallback chain.
      }
    }
    if (err?.response?.status) {
      return `Request failed with status ${err.response.status}`;
    }
    if (typeof err?.message === "string" && err.message.trim()) {
      return err.message;
    }
    return fallback;
  };

  const selectedTimetableRoute = useMemo(
    () => routes.find((r) => r.id === timetableRouteId) || null,
    [routes, timetableRouteId]
  );

  const makeDraftKey = (routeId: string, date: string) => `${routeId}__${date}`;

  const isCurrentDateDirty = useMemo(() => !areEntriesEqual(draftEntries, persistedEntries), [draftEntries, persistedEntries]);

  const hasAllTurnsForCurrentDate = useMemo(() => {
    return configuredTurns > 0 && draftEntries.length === configuredTurns;
  }, [configuredTurns, draftEntries]);

  const monthDays = useMemo(() => buildMonthDays(monthCursor), [monthCursor]);

  const usedTurns = useMemo(
    () => new Set(draftEntries.map((entry) => Number(entry.turn_number))),
    [draftEntries]
  );

  const availableTurns = useMemo(() => {
    const count = configuredTurns > 0 ? configuredTurns : Number(totalTurnsInput) || 0;
    return Array.from({ length: Math.max(0, count) }, (_, idx) => idx + 1).filter(
      (turn) => !usedTurns.has(turn)
    );
  }, [configuredTurns, totalTurnsInput, usedTurns]);

  useEffect(() => {
    if (!availableTurns.length) {
      setTurnToAssign("");
      return;
    }
  }, [availableTurns]);

  useEffect(() => {
    const loadRoutes = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await api.get("/routes", { params: { page: 1, limit: 500 } });
        const rows = Array.isArray(response.data?.routes) ? response.data.routes : [];
        const mapped: RouteSummary[] = rows
          .map((row: any) => ({
            id: row.id || "",
            routeNumber: row.route_number || "",
          }))
          .filter((r: RouteSummary) => r.id && r.routeNumber);
        setRoutes(mapped);
        const calendarRequests = mapped.map((route) =>
          api
            .get("/timetables/calendar", { params: { route_id: route.id } })
            .then((response) => ({
              routeId: route.id,
              rows: Array.isArray(response.data?.dates) ? response.data.dates : [],
            }))
            .catch(() => ({ routeId: route.id, rows: [] as RouteCalendarDate[] }))
        );
        const calendarResults = await Promise.all(calendarRequests);
        const nextCalendars: Record<string, RouteCalendarDate[]> = {};
        calendarResults.forEach((item) => {
          nextCalendars[item.routeId] = item.rows;
        });
        setRouteCalendars(nextCalendars);
      } catch {
        setRoutes([]);
        setRouteCalendars({});
        setError("Failed to load routes.");
      } finally {
        setIsLoading(false);
      }
    };

    void loadRoutes();
  }, []);

  const loadTimetableSetup = async (routeId: string) => {
    if (!routeId) return;
    try {
      const response = await api.get("/timetables/setup", { params: { route_id: routeId } });
      const setup = response.data?.setup;
      if (setup?.total_turns) {
        setConfiguredTurns(Number(setup.total_turns));
        setTotalTurnsInput(String(setup.total_turns));
      } else {
        setConfiguredTurns(0);
      }
    } catch {
      setConfiguredTurns(0);
    }
  };

  const loadTimetableEntries = async (routeId: string, date: string) => {
    if (!routeId || !date) {
      setPersistedEntries([]);
      setDraftEntries([]);
      return;
    }

    const key = makeDraftKey(routeId, date);

    try {
      const response = await api.get("/timetables/entries", {
        params: { route_id: routeId, date },
      });
      const rows = Array.isArray(response.data?.entries) ? response.data.entries : [];
      setPersistedEntries(rows);
      const cached = draftEntriesByDate[key];
      setDraftEntries(cached ?? rows);
    } catch {
      setPersistedEntries([]);
      const cached = draftEntriesByDate[key];
      setDraftEntries(cached ?? []);
    }
  };

  const loadRouteBuses = async (routeId: string) => {
    if (!routeId) {
      setRouteBuses([]);
      return;
    }
    try {
      const response = await api.get("/buses", { params: { route_id: routeId } });
      const rows = Array.isArray(response.data?.buses) ? response.data.buses : [];
      setRouteBuses(rows);
      setBusToAssign(rows[0]?.bus_number || "");
    } catch {
      setRouteBuses([]);
      setBusToAssign("");
    }
  };

  const loadRouteCalendar = async (routeId: string) => {
    if (!routeId) return;
    try {
      const response = await api.get("/timetables/calendar", { params: { route_id: routeId } });
      const rows = Array.isArray(response.data?.dates) ? response.data.dates : [];
      setRouteCalendars((prev) => ({ ...prev, [routeId]: rows }));
    } catch {
      setRouteCalendars((prev) => ({ ...prev, [routeId]: [] }));
    }
  };

  const openTimetableModalFor = async (routeId: string, date: string) => {
    const initialRouteId = routeId || routes[0]?.id || "";
    const initialDate = date || formatDate(new Date());
    setTimetableError(null);
    setTimetableSuccess(null);
    setDraftEntriesByDate({});
    setCompleteSavedDates({});
    setIsTimetableModalOpen(true);
    setTimetableRouteId(initialRouteId);
    setSelectedCalendarDate(initialDate);
    const dateSource = new Date(`${initialDate}T00:00:00`);
    setMonthCursor(new Date(dateSource.getFullYear(), dateSource.getMonth(), 1));

    if (initialRouteId) {
      await Promise.all([
        loadTimetableSetup(initialRouteId),
        loadRouteBuses(initialRouteId),
        loadTimetableEntries(initialRouteId, initialDate),
      ]);
    }
  };

  const openTimetableModal = async () => {
    await openTimetableModalFor(routes[0]?.id || "", formatDate(new Date()));
  };

  const handleDeleteSavedDate = async (routeId: string, routeNumber: string, date: string) => {
    const confirmed = window.confirm(`Delete saved timetable for route ${routeNumber} on ${date}?`);
    if (!confirmed) return;

    const key = `${routeId}__${date}`;
    setCalendarActionKey(key);
    setTimetableError(null);
    setTimetableSuccess(null);
    try {
      await api.delete("/timetables/date", {
        data: {
          route_id: routeId,
          date,
        },
      });

      if (timetableRouteId === routeId && selectedCalendarDate === date) {
        setPersistedEntries([]);
        setDraftEntries([]);
      }

      setCompleteSavedDates((prevSaved) => {
        const nextSaved = { ...prevSaved };
        delete nextSaved[date];
        return nextSaved;
      });

      await loadRouteCalendar(routeId);
      const detailsKey = `${routeId}__${date}`;
      setExpandedCalendarRows((prev) => {
        const next = { ...prev };
        delete next[detailsKey];
        return next;
      });
      setCalendarDetails((prev) => {
        const next = { ...prev };
        delete next[detailsKey];
        return next;
      });
      setTimetableSuccess(`Deleted timetable for ${routeNumber} on ${date}.`);
    } catch (err: any) {
      setTimetableError(getApiErrorMessage(err, "Failed to delete saved timetable date."));
    } finally {
      setCalendarActionKey(null);
    }
  };

  const toggleCalendarDetails = async (routeId: string, date: string) => {
    const key = `${routeId}__${date}`;
    const isExpanded = !!expandedCalendarRows[key];
    if (isExpanded) {
      setExpandedCalendarRows((prev) => ({ ...prev, [key]: false }));
      return;
    }

    setExpandedCalendarRows((prev) => ({ ...prev, [key]: true }));
    if (calendarDetails[key]) {
      return;
    }

    setCalendarDetailsLoading((prev) => ({ ...prev, [key]: true }));
    try {
      const response = await api.get("/timetables/entries", {
        params: { route_id: routeId, date },
      });
      const rows = Array.isArray(response.data?.entries) ? response.data.entries : [];
      setCalendarDetails((prev) => ({ ...prev, [key]: rows }));
    } catch {
      setCalendarDetails((prev) => ({ ...prev, [key]: [] }));
    } finally {
      setCalendarDetailsLoading((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleSaveSetup = async () => {
    if (!timetableRouteId) {
      setTimetableError("Please select a route.");
      return;
    }
    const turns = Number(totalTurnsInput);
    if (!Number.isFinite(turns) || turns < 1 || turns > 200) {
      setTimetableError("Please enter total turns between 1 and 200.");
      return;
    }

    setIsSavingSetup(true);
    setTimetableError(null);
    setTimetableSuccess(null);
    try {
      await api.post("/timetables/setup", {
        route_id: timetableRouteId,
        total_turns: turns,
      });
      setConfiguredTurns(turns);
      setTimetableSuccess("Setup saved.");
      await loadTimetableEntries(timetableRouteId, selectedCalendarDate);
    } catch (err: any) {
      setTimetableError(getApiErrorMessage(err, "Failed to save timetable setup."));
    } finally {
      setIsSavingSetup(false);
    }
  };

  const handleAddTurn = () => {
    if (!turnToAssign || !busToAssign || !departureTimeToAssign) {
      setTimetableError("Select turn, bus and departure time.");
      return;
    }
    const turn = Number(turnToAssign);
    if (!turn || turn < 1) {
      setTimetableError("Invalid turn number.");
      return;
    }

    setDraftEntries((prev) => {
      const withoutTurn = prev.filter((entry) => Number(entry.turn_number) !== turn);
      const next = [...withoutTurn, { turn_number: turn, bus_number: busToAssign, departure_time: departureTimeToAssign }].sort(
        (a, b) => Number(a.turn_number) - Number(b.turn_number)
      );
      if (timetableRouteId && selectedCalendarDate) {
        const key = makeDraftKey(timetableRouteId, selectedCalendarDate);
        setDraftEntriesByDate((prevDrafts) => ({ ...prevDrafts, [key]: next }));
        setCompleteSavedDates((prevSaved) => {
          const nextSaved = { ...prevSaved };
          delete nextSaved[selectedCalendarDate];
          return nextSaved;
        });
      }
      return next;
    });
    setTimetableError(null);
    setTimetableSuccess(null);
  };

  const handleSelectDraftEntry = (entry: TimetableEntry) => {
    setTurnToAssign(String(entry.turn_number));
    setBusToAssign(entry.bus_number);
    setDepartureTimeToAssign(entry.departure_time || "");
    setTimetableError(null);
    setTimetableSuccess("Editing selected turn. Update bus and click Add Turn to apply.");
  };

  const handleDeleteDraftEntry = (turnNumber: number) => {
    setDraftEntries((prev) => {
      const next = prev.filter((entry) => Number(entry.turn_number) !== Number(turnNumber));
      if (timetableRouteId && selectedCalendarDate) {
        const key = makeDraftKey(timetableRouteId, selectedCalendarDate);
        setDraftEntriesByDate((prevDrafts) => ({ ...prevDrafts, [key]: next }));
        setCompleteSavedDates((prevSaved) => {
          const nextSaved = { ...prevSaved };
          delete nextSaved[selectedCalendarDate];
          return nextSaved;
        });
      }
      return next;
    });
    setTimetableError(null);
    setTimetableSuccess(null);
  };

  const persistDateTurns = async (routeId: string, date: string, dateDraftEntries: TimetableEntry[]) => {
    const existingResponse = await api.get("/timetables/entries", {
      params: { route_id: routeId, date },
    });
    const existingRows = Array.isArray(existingResponse.data?.entries) ? existingResponse.data.entries : [];

    const removedEntries = existingRows.filter(
      (saved: any) => !dateDraftEntries.some((draft) => Number(draft.turn_number) === Number(saved.turn_number))
    );

    for (const removed of removedEntries) {
      await api.delete("/timetables/entries", {
        data: {
          route_id: routeId,
          date,
          turn_number: Number(removed.turn_number),
        },
      });
    }

    for (const entry of dateDraftEntries) {
      await api.post("/timetables/entries", {
        route_id: routeId,
        date,
        turn_number: Number(entry.turn_number),
        bus_number: entry.bus_number,
        departure_time: entry.departure_time || "",
      });
    }
  };

  const handleSaveTurns = async () => {
    if (!timetableRouteId || !selectedCalendarDate) {
      setTimetableError("Select route and date first.");
      return;
    }
    if (!configuredTurns) {
      setTimetableError("Save setup first.");
      return;
    }
    if (!isCurrentDateDirty) {
      return;
    }

    setIsSavingTimetable(true);
    setTimetableError(null);
    setTimetableSuccess(null);
    try {
      await persistDateTurns(timetableRouteId, selectedCalendarDate, draftEntries);

      const key = makeDraftKey(timetableRouteId, selectedCalendarDate);
      setDraftEntriesByDate((prevDrafts) => {
        const nextDrafts = { ...prevDrafts };
        delete nextDrafts[key];
        return nextDrafts;
      });

      setCompleteSavedDates((prevSaved) => {
        const nextSaved = { ...prevSaved };
        if (configuredTurns > 0 && draftEntries.length === configuredTurns) {
          nextSaved[selectedCalendarDate] = true;
        } else {
          delete nextSaved[selectedCalendarDate];
        }
        return nextSaved;
      });

      await loadTimetableEntries(timetableRouteId, selectedCalendarDate);
      await loadRouteCalendar(timetableRouteId);
      setTimetableSuccess("Turns saved for selected date.");
    } catch (err: any) {
      setTimetableError(getApiErrorMessage(err, "Failed to save turns."));
    } finally {
      setIsSavingTimetable(false);
    }
  };

  const handleSaveCalendar = async () => {
    if (!timetableRouteId || !selectedCalendarDate) {
      setTimetableError("Select route and date first.");
      return;
    }
    if (!configuredTurns) {
      setTimetableError("Save setup first.");
      return;
    }

    setIsSavingTimetable(true);
    setTimetableError(null);
    setTimetableSuccess(null);
    try {
      const routePrefix = `${timetableRouteId}__`;
      const draftsByDate = new Map<string, TimetableEntry[]>();

      Object.entries(draftEntriesByDate).forEach(([key, entries]) => {
        if (!key.startsWith(routePrefix)) return;
        const date = key.slice(routePrefix.length);
        draftsByDate.set(date, entries);
      });

      // Always include currently visible date to ensure latest in-memory edits are saved.
      draftsByDate.set(selectedCalendarDate, draftEntries);

      for (const [date, dateDraftEntries] of draftsByDate.entries()) {
        await persistDateTurns(timetableRouteId, date, dateDraftEntries);
      }

      const completedDates: Record<string, boolean> = {};
      for (const [date, dateDraftEntries] of draftsByDate.entries()) {
        if (configuredTurns > 0 && dateDraftEntries.length === configuredTurns) {
          completedDates[date] = true;
        }
      }
      setCompleteSavedDates((prevSaved) => ({ ...prevSaved, ...completedDates }));

      setDraftEntriesByDate((prevDrafts) => {
        const nextDrafts = { ...prevDrafts };
        Object.keys(nextDrafts).forEach((key) => {
          if (key.startsWith(routePrefix)) {
            delete nextDrafts[key];
          }
        });
        return nextDrafts;
      });
      await loadTimetableEntries(timetableRouteId, selectedCalendarDate);
      await loadRouteCalendar(timetableRouteId);
      setTimetableSuccess(`Timetable saved successfully for ${draftsByDate.size} date(s).`);
      setIsTimetableModalOpen(false);
    } catch (err: any) {
      setTimetableError(getApiErrorMessage(err, "Failed to save timetable."));
    } finally {
      setIsSavingTimetable(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 mb-1">Timetable</h1>
        <p className="text-sm text-slate-500">Create and save route turns by date.</p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
          {error}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <button
          type="button"
          onClick={() => {
            void openTimetableModal();
          }}
          disabled={isLoading || !routes.length}
          className="rounded-full bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          Create Timetable
        </button>

        <div className="mt-5 border-t border-slate-100 pt-4 space-y-3">
          <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Saved Timetable Calendar</p>
          {!routes.length && <p className="text-xs text-slate-500">No routes available.</p>}
          {routes.map((route) => {
            const dates = routeCalendars[route.id] || [];
            return (
              <div key={route.id} className="rounded-lg border border-slate-200 p-3">
                <p className="text-sm font-medium text-slate-800">Route {route.routeNumber}</p>
                {!dates.length ? (
                  <p className="mt-1 text-xs text-slate-500">No saved timetable dates yet.</p>
                ) : (
                  <div className="mt-2 space-y-1">
                    {dates.map((item) => {
                      const actionKey = `${route.id}__${item.date}`;
                      const details = calendarDetails[actionKey] || [];
                      const detailsOpen = !!expandedCalendarRows[actionKey];
                      const detailsLoading = !!calendarDetailsLoading[actionKey];
                      return (
                        <div
                          key={`${route.id}-${item.date}`}
                          className={`rounded-md border px-2.5 py-1.5 text-[11px] ${
                            item.is_complete
                              ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                              : "border-amber-300 bg-amber-50 text-amber-700"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <button
                              type="button"
                              onClick={() => {
                                void toggleCalendarDetails(route.id, item.date);
                              }}
                              className="inline-flex items-center gap-2 text-left"
                              aria-label={`Toggle details ${route.routeNumber} ${item.date}`}
                            >
                              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-600">
                                {detailsOpen ? "-" : "+"}
                              </span>
                              <span>{item.date}: {item.assigned_turns}/{item.total_turns}</span>
                            </button>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  void openTimetableModalFor(route.id, item.date);
                                }}
                                className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                                title="Edit timetable"
                                aria-label={`Edit timetable ${route.routeNumber} ${item.date}`}
                              >
                                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3 w-3">
                                  <path d="M3.5 13.75V16.5h2.75L15 7.75 12.25 5 3.5 13.75Z" />
                                  <path d="M11.5 5.75 14.25 8.5" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  void handleDeleteSavedDate(route.id, route.routeNumber, item.date);
                                }}
                                disabled={calendarActionKey === actionKey}
                                className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-red-200 bg-white text-red-600 hover:bg-red-50 disabled:opacity-60"
                                title="Delete timetable"
                                aria-label={`Delete timetable ${route.routeNumber} ${item.date}`}
                              >
                                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3 w-3">
                                  <path d="M4.5 6h11" />
                                  <path d="M8 6V4.75h4V6" />
                                  <path d="M7 6v9h6V6" />
                                </svg>
                              </button>
                            </div>
                          </div>
                          {detailsOpen && (
                            <div className="mt-2 rounded-md border border-slate-200 bg-white p-2 text-slate-700">
                              {detailsLoading && <p className="text-[11px] text-slate-500">Loading details...</p>}
                              {!detailsLoading && details.length === 0 && (
                                <p className="text-[11px] text-slate-500">No saved turns for this date.</p>
                              )}
                              {!detailsLoading && details.length > 0 && (
                                <div className="space-y-1">
                                  {details.map((entry) => (
                                    <div key={`${actionKey}-${entry.turn_number}-${entry.bus_number}`} className="flex items-center justify-between rounded-md bg-slate-50 px-2 py-1 text-[11px]">
                                      <span>Turn {entry.turn_number}</span>
                                      <span className="font-medium text-slate-800">
                                        {entry.bus_number}
                                        {entry.departure_time ? ` at ${entry.departure_time}` : ""}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {isTimetableModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-4">
          <div className="w-full max-w-5xl rounded-2xl bg-white border border-slate-200 shadow-xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Create Timetable</h3>
                <p className="text-xs text-slate-500 mt-1">Set turns, pick date, and assign buses.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsTimetableModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                ×
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              {timetableError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                  {timetableError}
                </div>
              )}
              {timetableSuccess && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                  {timetableSuccess}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-[2fr,1fr,auto] gap-3 items-end">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Route</label>
                  <select
                    value={timetableRouteId}
                    onChange={async (e) => {
                      const nextRouteId = e.target.value;
                      setTimetableRouteId(nextRouteId);
                      await Promise.all([
                        loadTimetableSetup(nextRouteId),
                        loadRouteBuses(nextRouteId),
                        loadTimetableEntries(nextRouteId, selectedCalendarDate),
                      ]);
                    }}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="">Select route</option>
                    {routes.map((route) => (
                      <option key={route.id} value={route.id}>
                        {route.routeNumber}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Total turns</label>
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={totalTurnsInput}
                    onChange={(e) => setTotalTurnsInput(e.target.value.replace(/[^0-9]/g, ""))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    void handleSaveSetup();
                  }}
                  disabled={isSavingSetup}
                  className="rounded-full bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {isSavingSetup ? "Saving..." : "Save setup"}
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[2fr,1.1fr] gap-4">
                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <button
                      type="button"
                      onClick={() =>
                        setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
                      }
                      className="rounded-md border border-slate-200 px-2 py-1 text-xs"
                    >
                      Prev
                    </button>
                    <p className="text-sm font-medium text-slate-800">
                      {monthCursor.toLocaleString(undefined, { month: "long", year: "numeric" })}
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
                      }
                      className="rounded-md border border-slate-200 px-2 py-1 text-xs"
                    >
                      Next
                    </button>
                  </div>

                  <div className="grid grid-cols-7 gap-2 text-center text-[11px] text-slate-500 mb-2">
                    {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                      <span key={d}>{d}</span>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-2">
                    {monthDays.map((day) => {
                      const sameMonth = day.getMonth() === monthCursor.getMonth();
                      const dayText = formatDate(day);
                      const selected = dayText === selectedCalendarDate;
                      const isSavedComplete = !!completeSavedDates[dayText];
                      return (
                        <button
                          key={dayText}
                          type="button"
                          onClick={async () => {
                            setSelectedCalendarDate(dayText);
                            if (timetableRouteId) {
                              await loadTimetableEntries(timetableRouteId, dayText);
                            }
                          }}
                          className={`h-12 rounded-lg border text-sm ${
                            isSavedComplete
                              ? selected
                                ? "border-emerald-700 bg-emerald-600 text-white"
                                : "border-emerald-300 bg-emerald-50 text-emerald-700"
                              : selected
                              ? "border-blue-600 bg-blue-600 text-white"
                              : sameMonth
                              ? "border-slate-200 bg-white text-slate-700"
                              : "border-slate-100 bg-slate-50 text-slate-400"
                          }`}
                        >
                          {day.getDate()}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                  <p className="text-xs text-slate-500">
                    {selectedTimetableRoute
                      ? `Route ${selectedTimetableRoute.routeNumber} on ${selectedCalendarDate}`
                      : "Select route and date"}
                  </p>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Turn</label>
                    <select
                      value={turnToAssign}
                      onChange={(e) => setTurnToAssign(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      disabled={!configuredTurns || !availableTurns.length}
                    >
                      {!availableTurns.length && <option value="">No turns left</option>}
                      {availableTurns.map((turn) => (
                        <option key={turn} value={turn}>
                          Turn {turn}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Bus number</label>
                    <select
                      value={busToAssign}
                      onChange={(e) => setBusToAssign(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    >
                      {!routeBuses.length && <option value="">No registered buses</option>}
                      {routeBuses.map((bus) => (
                        <option key={bus.bus_number} value={bus.bus_number}>
                          {bus.bus_number}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Departure time</label>
                    <input
                      type="time"
                      value={departureTimeToAssign}
                      onChange={(e) => setDepartureTimeToAssign(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleAddTurn}
                    disabled={!configuredTurns || !availableTurns.length}
                    className="w-full rounded-full bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    Add Turn
                  </button>

                  <div className="border-t border-slate-100 pt-3">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-xs font-medium text-slate-700">Assigned turns</p>
                        {persistedEntries.length > 0 && (
                          <p className="mt-1 text-[11px] text-slate-500">Currently saved: {persistedEntries.length} turn(s).</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          void handleSaveTurns();
                        }}
                        disabled={isSavingTimetable || !isCurrentDateDirty}
                        className="rounded-full bg-emerald-600 px-3 py-1 text-[11px] font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                      >
                        {isSavingTimetable ? "Saving..." : "Save Turns"}
                      </button>
                    </div>
                    <div className="space-y-1 max-h-44 overflow-y-auto">
                      {!draftEntries.length && (
                        <p className="text-xs text-slate-500">No turns added for selected date.</p>
                      )}
                      {draftEntries.map((entry) => (
                        <div
                          key={`${entry.turn_number}-${entry.bus_number}`}
                          role="button"
                          tabIndex={0}
                          onClick={() => handleSelectDraftEntry(entry)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              handleSelectDraftEntry(entry);
                            }
                          }}
                          className="flex items-center justify-between rounded-md bg-slate-50 px-2 py-1 text-xs cursor-pointer hover:bg-slate-100"
                        >
                          <span>Turn {entry.turn_number}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-800">{entry.bus_number} {entry.departure_time ? `(${entry.departure_time})` : ""}</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteDraftEntry(entry.turn_number);
                              }}
                              className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-red-200 text-red-600 hover:bg-red-50"
                              title="Delete turn"
                              aria-label={`Delete turn ${entry.turn_number}`}
                            >
                              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3 w-3">
                                <path d="M4.5 6h11" />
                                <path d="M8 6V4.75h4V6" />
                                <path d="M7 6v9h6V6" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => {
                          void handleSaveCalendar();
                        }}
                        disabled={isSavingTimetable}
                        className="w-full rounded-full bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                      >
                        {isSavingTimetable ? "Saving..." : "Save Timetable"}
                      </button>
                      {hasAllTurnsForCurrentDate && !isCurrentDateDirty && (
                        <p className="mt-2 text-[11px] text-emerald-700">
                          Selected date is fully saved.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimetablePage;
