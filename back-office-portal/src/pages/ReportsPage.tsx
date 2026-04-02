import React, { useEffect, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import type { AppDispatch } from "../store";
import { addNotification } from "../store/slices/alertsSlice";

const ReportsPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();

  const [searchQuery, setSearchQuery] = useState("");
  const [routeFilter, setRouteFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [isRouteOpen, setIsRouteOpen] = useState(false);
  const [isDateOpen, setIsDateOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isCustomRangeOpen, setIsCustomRangeOpen] = useState(false);
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [customDateError, setCustomDateError] = useState<string | null>(null);

  const exportMenuRef = useRef<HTMLDivElement | null>(null);
  const routeDropdownRef = useRef<HTMLDivElement | null>(null);
  const dateDropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isExportMenuOpen && !isRouteOpen && !isDateOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;

      if (isExportMenuOpen && exportMenuRef.current && !exportMenuRef.current.contains(target)) {
        setIsExportMenuOpen(false);
      }

      if (isRouteOpen && routeDropdownRef.current && !routeDropdownRef.current.contains(target)) {
        setIsRouteOpen(false);
      }

      if (isDateOpen && dateDropdownRef.current && !dateDropdownRef.current.contains(target)) {
        setIsDateOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isExportMenuOpen, isRouteOpen, isDateOpen]);

  const closeExportMenu = () => {
    setIsExportMenuOpen(false);
  };

  const handleExportAll = () => {
    if (isExporting) return;
    closeExportMenu();
    setIsExporting(true);

    // TODO: Call backend export for all transactions
    dispatch(
      addNotification({
        id: `export-all-${Date.now()}`,
        type: "info",
        message: "Exporting all transactions (not yet implemented)",
        timestamp: new Date().toISOString(),
        read: false,
      })
    );

    setTimeout(() => {
      setIsExporting(false);
    }, 500);
  };

  const handleExportToday = () => {
    if (isExporting) return;
    closeExportMenu();
    setIsExporting(true);

    // TODO: Call backend export for today's transactions
    dispatch(
      addNotification({
        id: `export-today-${Date.now()}`,
        type: "info",
        message: "Exporting today\'s transactions (not yet implemented)",
        timestamp: new Date().toISOString(),
        read: false,
      })
    );

    setTimeout(() => {
      setIsExporting(false);
    }, 500);
  };

  const openCustomRange = () => {
    closeExportMenu();
    setCustomDateError(null);
    setIsCustomRangeOpen(true);
  };

  const handleCloseCustomRange = () => {
    if (isExporting) return;
    setIsCustomRangeOpen(false);
    setCustomDateError(null);
  };

  const handleConfirmCustomRange = () => {
    if (isExporting) return;

    if (!customStartDate || !customEndDate) {
      setCustomDateError("Please choose both start and end dates.");
      return;
    }

    if (customStartDate > customEndDate) {
      setCustomDateError("Start date cannot be after end date.");
      return;
    }

    setCustomDateError(null);
    setIsExporting(true);

    // TODO: Call backend export with custom date range
    dispatch(
      addNotification({
        id: `export-custom-${Date.now()}`,
        type: "info",
        message: "Exporting custom range (not yet implemented)",
        timestamp: new Date().toISOString(),
        read: false,
      })
    );

    setTimeout(() => {
      setIsExporting(false);
      setIsCustomRangeOpen(false);
    }, 500);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 mb-1">
          Transaction Reports
        </h1>
        <p className="text-sm text-slate-500">
          Download detailed transaction data for analysis.
        </p>
      </div>

      {/* Filter section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">
          Filter Transactions
        </h2>
        <div className="flex flex-col gap-3 md:flex-row md:items-start">
          {/* Search */}
          <div className="flex-1 min-w-[220px]">
            <p className="text-[11px] font-semibold text-slate-600 mb-1">
              Search
            </p>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  className="h-4 w-4 text-slate-400"
                  aria-hidden="true"
                >
                  <path
                    d="M8.5 3.5a5 5 0 013.905 8.155l2.47 2.47a.75.75 0 11-1.06 1.06l-2.47-2.47A5 5 0 118.5 3.5zm0 1.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7z"
                    fill="currentColor"
                  />
                </svg>
              </span>
              <input
                type="text"
                placeholder="Search by ticket, route, start, or end destination..."
                className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Route filter (custom dropdown) */}
          <div className="min-w-[160px]" ref={routeDropdownRef}>
            <p className="text-[11px] font-semibold text-slate-600 mb-1">
              Route
            </p>
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsRouteOpen((open) => !open)}
                className="w-full inline-flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:outline-none transition-colors duration-150 ease-out focus:border-blue-500 focus:bg-blue-50/40"
              >
                <span>
                  {routeFilter === "all" ? "All routes" : "All routes"}
                </span>
                <span className="text-slate-400 flex items-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    className="h-3.5 w-3.5"
                    aria-hidden="true"
                  >
                    <path
                      d="M5 8l5 5 5-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              </button>

              {isRouteOpen && (
                <div className="absolute z-10 mt-1 left-0 right-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                  <button
                    type="button"
                    onClick={() => {
                      setRouteFilter("all");
                      setIsRouteOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-xs transition-colors duration-100 ${
                      routeFilter === "all"
                        ? "bg-blue-50 text-blue-700"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    All routes
                  </button>
                  {/* TODO: populate routes from backend and render here */}
                </div>
              )}
            </div>
          </div>

          {/* Date filter (custom dropdown) */}
          <div className="min-w-[160px]" ref={dateDropdownRef}>
            <p className="text-[11px] font-semibold text-slate-600 mb-1">
              Date
            </p>
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsDateOpen((open) => !open)}
                className="w-full inline-flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:outline-none transition-colors duration-150 ease-out focus:border-blue-500 focus:bg-blue-50/40"
              >
                <span>
                  {dateFilter === "all" && "All dates"}
                  {dateFilter === "today" && "Today"}
                  {dateFilter === "last7" && "Last 7 days"}
                  {dateFilter === "last30" && "Last 30 days"}
                </span>
                <span className="text-slate-400 flex items-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    className="h-3.5 w-3.5"
                    aria-hidden="true"
                  >
                    <path
                      d="M5 8l5 5 5-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              </button>

              {isDateOpen && (
                <div className="absolute z-10 mt-1 left-0 right-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                  <button
                    type="button"
                    onClick={() => {
                      setDateFilter("all");
                      setIsDateOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-xs transition-colors duration-100 ${
                      dateFilter === "all"
                        ? "bg-blue-50 text-blue-700"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    All dates
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDateFilter("today");
                      setIsDateOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-xs transition-colors duration-100 ${
                      dateFilter === "today"
                        ? "bg-blue-50 text-blue-700"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDateFilter("last7");
                      setIsDateOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-xs transition-colors duration-100 ${
                      dateFilter === "last7"
                        ? "bg-blue-50 text-blue-700"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    Last 7 days
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDateFilter("last30");
                      setIsDateOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-xs transition-colors duration-100 ${
                      dateFilter === "last30"
                        ? "bg-blue-50 text-blue-700"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    Last 30 days
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Transactions table layout (no data yet) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">
            Transaction Details
          </h2>
          {/* Export button + menu (aligned with table header) */}
          <div className="relative" ref={exportMenuRef}>
            <button
              type="button"
              onClick={() => !isExporting && setIsExportMenuOpen((open) => !open)}
              className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/60 disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={isExporting}
            >
              <span className="text-lg leading-none">···</span>
              <span>Export</span>
            </button>

            {isExportMenuOpen && (
              <div className="absolute right-0 mt-2 w-52 rounded-xl border border-slate-200 bg-white shadow-lg text-xs text-slate-700 z-10">
                <button
                  type="button"
                  onClick={handleExportAll}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50"
                >
                  Export all transactions
                </button>
                <button
                  type="button"
                  onClick={handleExportToday}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50"
                >
                  Today transactions
                </button>
                <button
                  type="button"
                  onClick={openCustomRange}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 border-t border-slate-100"
                >
                  Custom range
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="px-6 py-4 overflow-x-auto">
          <table className="min-w-full text-left text-xs text-slate-700">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4 font-semibold">Route</th>
                <th className="py-2 pr-4 font-semibold">Ticket Number</th>
                <th className="py-2 pr-4 font-semibold">Date</th>
                <th className="py-2 pr-4 font-semibold">Time</th>
                <th className="py-2 pr-4 font-semibold">Amount</th>
                <th className="py-2 pr-4 font-semibold">Start Destination</th>
                <th className="py-2 pr-0 font-semibold">End Destination</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td
                  colSpan={7}
                  className="py-6 text-center text-[11px] text-slate-400"
                >
                  Transaction data will appear here once the tickets are purchased.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Custom range modal */}
      {isCustomRangeOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40">
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-5">
            <button
              type="button"
              onClick={handleCloseCustomRange}
              disabled={isExporting}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
              aria-label="Close"
            >
              <span className="text-lg leading-none">×</span>
            </button>
            <h3 className="text-sm font-semibold text-slate-900 mb-2">
              Export custom range
            </h3>
            <p className="text-xs text-slate-500 mb-3">
              Choose a start and end date for the export.
            </p>
            {customDateError && (
              <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-600">
                {customDateError}
              </div>
            )}
            <div className="space-y-3 text-xs">
              <div>
                <label className="block mb-1 font-medium text-slate-700">
                  Start date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block mb-1 font-medium text-slate-700">
                  End date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={handleCloseCustomRange}
                disabled={isExporting}
                className="rounded-full border border-slate-200 px-4 py-1.5 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmCustomRange}
                disabled={isExporting}
                className="rounded-full bg-slate-900 px-4 py-1.5 font-medium text-white shadow-sm hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isExporting ? "Exporting..." : "Export"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportsPage;
