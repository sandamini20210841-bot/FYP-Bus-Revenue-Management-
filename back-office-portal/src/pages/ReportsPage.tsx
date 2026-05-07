import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import type { AppDispatch } from "../store";
import { addNotification } from "../store/slices/alertsSlice";
import api from "../utils/axios";
import { useTranslation } from "react-i18next";

type ReportTransaction = {
  id: string;
  route_number: string;
  ticket_number: string;
  bus_number: string;
  transaction_date: string;
  amount: number;
  from_stop_name: string;
  to_stop_name: string;
  start_destination?: string;
  end_destination?: string;
  status: string;
};

const ReportsPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { t } = useTranslation();

  const [searchQuery, setSearchQuery] = useState("");
  const [busNumberFilter, setBusNumberFilter] = useState("all");
  const [routeFilter, setRouteFilter] = useState("all");
  const [selectedDate, setSelectedDate] = useState("");
  const [isRouteOpen, setIsRouteOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isCustomRangeOpen, setIsCustomRangeOpen] = useState(false);
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [customDateError, setCustomDateError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [transactions, setTransactions] = useState<ReportTransaction[]>([]);
  const [registeredBusNumbers, setRegisteredBusNumbers] = useState<string[]>([]);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
  const [transactionsError, setTransactionsError] = useState<string | null>(null);

  const exportMenuRef = useRef<HTMLDivElement | null>(null);
  const routeDropdownRef = useRef<HTMLDivElement | null>(null);
  const transactionsRequestIdRef = useRef(0);

  const formatCsvField = (value: string | number) => {
    const text = String(value ?? "");
    if (text.includes(",") || text.includes("\"") || text.includes("\n")) {
      return `"${text.replace(/\"/g, '""')}"`;
    }
    return text;
  };

  const downloadTransactionsCsv = (fileName: string, rows: ReportTransaction[]) => {
    const header = [
      "Route",
      "Ticket Number",
      "Bus Number",
      "Date",
      "Time",
      "Amount (Rs.)",
      "Start Destination",
      "End Destination",
      "Status",
    ];

    const body = rows.map((tr) => {
      const dt = tr.transaction_date ? new Date(tr.transaction_date) : null;
      const dateLabel = dt && !Number.isNaN(dt.getTime()) ? dt.toLocaleDateString() : "";
      const timeLabel = dt && !Number.isNaN(dt.getTime()) ? dt.toLocaleTimeString() : "";

      return [
        tr.route_number || "",
        tr.ticket_number || "",
        tr.bus_number || "",
        dateLabel,
        timeLabel,
        Number(tr.amount || 0).toFixed(2),
        tr.from_stop_name || "",
        tr.to_stop_name || "",
        tr.status || "",
      ]
        .map(formatCsvField)
        .join(",");
    });

    const csvText = [header.join(","), ...body].join("\n");
    const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (!isExportMenuOpen && !isRouteOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;

      if (isExportMenuOpen && exportMenuRef.current && !exportMenuRef.current.contains(target)) {
        setIsExportMenuOpen(false);
      }

      if (isRouteOpen && routeDropdownRef.current && !routeDropdownRef.current.contains(target)) {
        setIsRouteOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isExportMenuOpen, isRouteOpen]);

  const [totalPages, setTotalPages] = useState(1);
  const rowsPerPage = 200;
  const loadTransactions = useCallback(async () => {
    const requestId = (transactionsRequestIdRef.current += 1);
    setIsLoadingTransactions(true);
    setTransactionsError(null);
    try {
      const params: any = { page: currentPage, limit: rowsPerPage };
      if (selectedDate) {
        params.date = selectedDate;
        params.dateFrom = selectedDate;
        params.dateTo = selectedDate;
      }
      if (routeFilter && routeFilter !== "all") params.route = routeFilter;
      if (busNumberFilter && busNumberFilter !== "all") params.bus = busNumberFilter;

      const response = await api.get("/transactions", { params, timeout: 60000 });
      if (requestId != transactionsRequestIdRef.current) {
        return;
      }
      const rows = Array.isArray(response.data?.transactions)
        ? response.data.transactions
        : [];
      const mapped: ReportTransaction[] = rows.map((row: any) => ({
        id: row.id || "",
        route_number: row.route_number || "-",
        ticket_number: row.ticket_number || "-",
        bus_number: row.bus_number || "-",
        transaction_date: row.transaction_date || "",
        amount: typeof row.amount === "number" ? row.amount : Number.parseFloat(row.amount || "0"),
        from_stop_name: row.from_stop_name || row.start_destination || "-",
        to_stop_name: row.to_stop_name || row.end_destination || "-",
        start_destination: row.start_destination || "",
        end_destination: row.end_destination || "",
        status: row.status || "",
      }));
      setTransactions(mapped);
      setTotalPages(Math.max(1, Math.ceil(Number(response.data?.pagination?.total || mapped.length) / rowsPerPage)));
    } catch (err: any) {
      console.error("Failed to load transactions", err);
      if (requestId != transactionsRequestIdRef.current) {
        return;
      }
      setTransactions([]);
      let errorMsg = "Failed to load transactions.";
      if (err?.response?.data?.error) {
        errorMsg = err.response.data.error;
      } else if (err?.message) {
        errorMsg = err.message;
      }
      setTransactionsError(errorMsg);
    } finally {
      if (requestId === transactionsRequestIdRef.current) {
        setIsLoadingTransactions(false);
      }
    }
  }, [currentPage, selectedDate, routeFilter, busNumberFilter]);

  const loadRegisteredBusNumbers = useCallback(async () => {
    try {
      const response = await api.get("/buses");
      const rows = Array.isArray(response.data?.buses) ? response.data.buses : [];
      const busNumbers = rows
        .map((row: any) => String(row.bus_number || "").trim())
        .filter((busNumber: string) => busNumber.length > 0);
      const uniqueBusNumbers = [...new Set<string>(busNumbers)].sort((a, b) =>
        a.localeCompare(b)
      );
      setRegisteredBusNumbers(uniqueBusNumbers);
    } catch {
      setRegisteredBusNumbers([]);
    }
  }, []);

  useEffect(() => {
    void loadTransactions();
    void loadRegisteredBusNumbers();
  }, [loadTransactions, loadRegisteredBusNumbers]);

  const routeOptions = useMemo(() => {
    const routes = new Set<string>();
    transactions.forEach((tr) => {
      if (tr.route_number && tr.route_number !== "-") {
        routes.add(tr.route_number);
      }
    });
    return Array.from(routes).sort();
  }, [transactions]);

  // Filtering is now applied to the current page only
  const filteredTransactions = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    const pickedDate = selectedDate.trim();
    const normalize = (value: string) => value.trim().toLowerCase();
    return transactions.filter((tr) => {
      if (busNumberFilter !== "all" && normalize(tr.bus_number) !== normalize(busNumberFilter)) {
        return false;
      }
      if (routeFilter !== "all" && normalize(tr.route_number) !== normalize(routeFilter)) {
        return false;
      }
      if (pickedDate) {
        const trDate = tr.transaction_date ? new Date(tr.transaction_date) : null;
        const trDateKey = trDate && !Number.isNaN(trDate.getTime())
          ? trDate.toLocaleDateString("en-CA")
          : "";
        if (trDateKey !== pickedDate) {
          return false;
        }
      }
      if (!term) return true;
      return (
        tr.ticket_number.toLowerCase().includes(term) ||
        tr.route_number.toLowerCase().includes(term) ||
        tr.bus_number.toLowerCase().includes(term) ||
        tr.from_stop_name.toLowerCase().includes(term) ||
        tr.to_stop_name.toLowerCase().includes(term)
      );
    });
  }, [transactions, searchQuery, busNumberFilter, routeFilter, selectedDate]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, busNumberFilter, routeFilter, selectedDate]);

  // No client-side pagination, just use filteredTransactions
  const paginatedTransactions = filteredTransactions;
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const visibleTransactionCount = filteredTransactions.length;
  const visibleTransactionTotal = filteredTransactions.reduce(
    (sum, tr) => sum + Number(tr.amount || 0),
    0
  );

  const closeExportMenu = () => {
    setIsExportMenuOpen(false);
  };

  const handleExportAll = () => {
    if (isExporting) return;
    closeExportMenu();
    setIsExporting(true);

    try {
      const timestamp = new Date().toISOString().slice(0, 10);
      downloadTransactionsCsv(`transactions-all-${timestamp}.csv`, filteredTransactions);
      dispatch(
        addNotification({
          id: `export-all-${Date.now()}`,
          type: "success",
          message: `Exported ${filteredTransactions.length} transactions`,
          timestamp: new Date().toISOString(),
          read: false,
        })
      );
    } catch {
      dispatch(
        addNotification({
          id: `export-all-error-${Date.now()}`,
          type: "error",
          message: "Failed to export transactions",
          timestamp: new Date().toISOString(),
          read: false,
        })
      );
    }

    setTimeout(() => {
      setIsExporting(false);
    }, 500);
  };

  const handleExportToday = () => {
    if (isExporting) return;
    closeExportMenu();
    setIsExporting(true);

    try {
      const now = new Date();
      const todaysRows = filteredTransactions.filter((tr) => {
        const dt = tr.transaction_date ? new Date(tr.transaction_date) : null;
        if (!dt || Number.isNaN(dt.getTime())) return false;
        return (
          dt.getFullYear() === now.getFullYear() &&
          dt.getMonth() === now.getMonth() &&
          dt.getDate() === now.getDate()
        );
      });

      const timestamp = new Date().toISOString().slice(0, 10);
      downloadTransactionsCsv(`${timestamp} transactions report.csv`, todaysRows);
      dispatch(
        addNotification({
          id: `export-today-${Date.now()}`,
          type: "success",
          message: `Exported ${todaysRows.length} today transactions`,
          timestamp: new Date().toISOString(),
          read: false,
        })
      );
    } catch {
      dispatch(
        addNotification({
          id: `export-today-error-${Date.now()}`,
          type: "error",
          message: "Failed to export today transactions",
          timestamp: new Date().toISOString(),
          read: false,
        })
      );
    }

    setTimeout(() => {
      setIsExporting(false);
    }, 500);
  };

  const openCustomRange = () => {
    closeExportMenu();
    setCustomStartDate("");
    setCustomEndDate("");
    setCustomDateError(null);
    setIsCustomRangeOpen(true);
  };

  const handleCloseCustomRange = () => {
    if (isExporting) return;
    setIsCustomRangeOpen(false);
    setCustomStartDate("");
    setCustomEndDate("");
    setCustomDateError(null);
  };

  const handleConfirmCustomRange = async () => {
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

    try {
      const body: any = {
        date_from: customStartDate,
        date_to: customEndDate,
      };
      if (routeFilter !== "all") body.route = routeFilter;
      if (busNumberFilter !== "all") body.bus = busNumberFilter;

      const response = await api.post(`/reports/export-transactions-csv`, body, {
        responseType: "blob",
        timeout: 120000,
      });

      const blob = new Blob([response.data], { type: response.headers["content-type"] || "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      const filename = `transactions-${customStartDate}-to-${customEndDate}.csv`;
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      dispatch(
        addNotification({
          id: `export-custom-${Date.now()}`,
          type: "success",
          message: `Export started for ${customStartDate} to ${customEndDate}`,
          timestamp: new Date().toISOString(),
          read: false,
        })
      );
    } catch (err: any) {
      console.error("Export custom range failed", err);
      const backendMsg = err?.response?.data?.error || err?.message || "Failed to export custom range";
      dispatch(
        addNotification({
          id: `export-custom-error-${Date.now()}`,
          type: "error",
          message: backendMsg,
          timestamp: new Date().toISOString(),
          read: false,
        })
      );
    } finally {
      setIsExporting(false);
      setIsCustomRangeOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 mb-1">{t("reports.title")}</h1>
        <p className="text-sm text-slate-500">{t("reports.description")}</p>
      </div>

      {/* Filter section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">{t("reports.filterTransactions")}</h2>
        <div className="flex flex-col gap-3 md:flex-row md:items-start">
          {/* Search */}
          <div className="flex-1 min-w-[220px]">
            <p className="text-[11px] font-semibold text-slate-600 mb-1">{t("reports.search")}</p>
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
                placeholder={t("reports.searchPlaceholder")}
                className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Bus number filter */}
          <div className="min-w-[180px]">
            <p className="text-[11px] font-semibold text-slate-600 mb-1">{t("reports.busNumber")}</p>
            <select
              value={busNumberFilter}
              onChange={(e) => setBusNumberFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">{t("reports.allBusNumbers")}</option>
              {registeredBusNumbers.map((busNumber) => (
                <option key={busNumber} value={busNumber}>
                  {busNumber}
                </option>
              ))}
            </select>
          </div>

          {/* Route filter (custom dropdown) */}
          <div className="min-w-[160px]" ref={routeDropdownRef}>
            <p className="text-[11px] font-semibold text-slate-600 mb-1">{t("reports.route")}</p>
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsRouteOpen((open) => !open)}
                className="w-full inline-flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:outline-none transition-colors duration-150 ease-out focus:border-blue-500 focus:bg-blue-50/40"
              >
                <span>{routeFilter === "all" ? t("reports.allRoutes") : routeFilter}</span>
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
                  {routeOptions.map((route) => (
                    <button
                      key={route}
                      type="button"
                      onClick={() => {
                        setRouteFilter(route);
                        setIsRouteOpen(false);
                      }}
                      className={`w-full px-3 py-2 text-left text-xs transition-colors duration-100 ${
                        routeFilter === route
                          ? "bg-blue-50 text-blue-700"
                          : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {route}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Date filter (calendar picker) */}
          <div className="min-w-[200px]">
            <p className="text-[11px] font-semibold text-slate-600 mb-1">
              Date
            </p>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                type="button"
                onClick={() => setSelectedDate("")}
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
              >
                All
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Transactions table layout (no data yet) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">{t("reports.transactionDetails")}</h2>
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
                  <button type="button" onClick={handleExportAll} className="w-full text-left px-3 py-2 hover:bg-slate-50">{t("reports.exportAll")}</button>
                  <button type="button" onClick={handleExportToday} className="w-full text-left px-3 py-2 hover:bg-slate-50">{t("reports.exportToday")}</button>
                  <button type="button" onClick={openCustomRange} className="w-full text-left px-3 py-2 hover:bg-slate-50 border-t border-slate-100">{t("reports.exportCustomRange")}</button>
                </div>
            )}
          </div>
        </div>
        <div className="px-6 py-4 overflow-x-auto">
          <table className="min-w-full text-left text-xs text-slate-700">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4 font-semibold">{t("reports.headers.route")}</th>
                <th className="py-2 pr-4 font-semibold">{t("reports.headers.ticket")}</th>
                <th className="py-2 pr-4 font-semibold">{t("reports.headers.bus")}</th>
                <th className="py-2 pr-4 font-semibold">{t("reports.headers.date")}</th>
                <th className="py-2 pr-4 font-semibold">{t("reports.headers.time")}</th>
                <th className="py-2 pr-4 font-semibold">{t("reports.headers.amount")}</th>
                <th className="py-2 pr-4 font-semibold">{t("reports.headers.start")}</th>
                <th className="py-2 pr-0 font-semibold">{t("reports.headers.end")}</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingTransactions && (
                <tr>
                  <td
                    colSpan={8}
                    className="py-6 text-center text-[11px] text-slate-400"
                  >
                    Loading transactions...
                  </td>
                </tr>
              )}

              {!isLoadingTransactions && transactionsError && (
                <tr>
                  <td
                    colSpan={8}
                    className="py-6 text-center text-[11px] text-red-500"
                  >
                    {transactionsError}
                  </td>
                </tr>
              )}

              {!isLoadingTransactions && !transactionsError && filteredTransactions.length === 0 && (
                <tr>
                    <td colSpan={8} className="py-6 text-center text-[11px] text-slate-400">{t("reports.noData")}</td>
                </tr>
              )}

              {!isLoadingTransactions && !transactionsError && paginatedTransactions.map((tr) => {
                const dt = tr.transaction_date ? new Date(tr.transaction_date) : null;
                const dateLabel = dt && !Number.isNaN(dt.getTime())
                  ? dt.toLocaleDateString()
                  : "-";
                const timeLabel = dt && !Number.isNaN(dt.getTime())
                  ? dt.toLocaleTimeString()
                  : "-";

                return (
                  <tr key={tr.id} className="border-b border-slate-100 last:border-b-0">
                    <td className="py-3 pr-4">{tr.route_number || "-"}</td>
                    <td className="py-3 pr-4">{tr.ticket_number || "-"}</td>
                    <td className="py-3 pr-4">{tr.bus_number || "-"}</td>
                    <td className="py-3 pr-4">{dateLabel}</td>
                    <td className="py-3 pr-4">{timeLabel}</td>
                    <td className="py-3 pr-4 text-emerald-600 font-semibold">Rs. {Number(tr.amount || 0).toFixed(2)}</td>
                    <td className="py-3 pr-4">{tr.from_stop_name || "-"}</td>
                    <td className="py-3 pr-0">{tr.to_stop_name || "-"}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-100/70 text-sm text-slate-700">
                <td className="py-3 pr-4" />
                <td className="py-3 pr-4" />
                <td className="py-3 pr-4" />
                <td className="py-3 pr-4" />
                <td className="py-3 pr-4 font-semibold text-slate-700">{t("reports.totalLabel")}</td>
                <td className="py-3 pr-4 font-bold text-emerald-600">
                  Rs. {visibleTransactionTotal.toFixed(2)}
                </td>
                <td className="py-3 pr-4" />
                <td className="py-3 pr-0 text-slate-500">
                  {visibleTransactionCount} {t("reports.transactions")}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        {!isLoadingTransactions && !transactionsError && filteredTransactions.length > 0 && (
          <div className="px-6 pb-4 flex items-center justify-end gap-2 text-xs text-slate-600">
            <span className="mr-2">
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={currentPage === 1}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              disabled={currentPage === totalPages}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next page
            </button>
          </div>
        )}
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
