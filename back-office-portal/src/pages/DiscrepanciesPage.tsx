import React, { useCallback, useEffect, useMemo, useState } from "react";
// modal will be implemented inline
import api from "../utils/axios";

type DiscrepancyStatus = "pending" | "investigating" | "escalated" | "resolved";
type DiscrepancySeverity = "low" | "medium" | "high" | "critical";

type DiscrepancyItem = {
  id: string;
  route_number: string;
  bus_number: string;
  transaction_date: string;
  expected_revenue: number;
  expected_daily: number;
  expected_weekly: number;
  expected_monthly: number;
  actual_revenue: number;
  actual_weekly: number;
  actual_monthly: number;
  loss_amount: number;
  anomaly_score: number;
  status: DiscrepancyStatus;
  severity: DiscrepancySeverity;
  notes: string;
  detection_method: string;
};

type DiscrepancyStats = {
  totalDiscrepancies: number;
  totalLoss: number;
};

const statusOptions: Array<{ label: string; value: DiscrepancyStatus | "all" }> = [
  { label: "All Statuses", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Investigating", value: "investigating" },
  { label: "Escalated", value: "escalated" },
  { label: "Resolved", value: "resolved" },
];

const severityOptions: Array<{ label: string; value: DiscrepancySeverity | "all" }> = [
  { label: "All Severities", value: "all" },
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" },
  { label: "Critical", value: "critical" },
];

const severityBadgeClass = (severity: DiscrepancySeverity) => {
  switch (severity) {
    case "critical":
      return "border-red-300 bg-red-50 text-red-700";
    case "high":
      return "border-orange-300 bg-orange-50 text-orange-700";
    case "medium":
      return "border-amber-300 bg-amber-50 text-amber-700";
    default:
      return "border-slate-300 bg-slate-50 text-slate-700";
  }
};

const statusBadgeClass = (status: DiscrepancyStatus) => {
  switch (status) {
    case "resolved":
      return "border-emerald-300 bg-emerald-50 text-emerald-700";
    case "investigating":
      return "border-blue-300 bg-blue-50 text-blue-700";
    case "escalated":
      return "border-red-300 bg-red-50 text-red-700";
    default:
      return "border-slate-300 bg-slate-50 text-slate-700";
  }
};

const DiscrepanciesPage: React.FC = () => {
  const [items, setItems] = useState<DiscrepancyItem[]>([]);
  const [stats, setStats] = useState<DiscrepancyStats>({ totalDiscrepancies: 0, totalLoss: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<DiscrepancyStatus | "all">("all");
  const [severityFilter, setSeverityFilter] = useState<DiscrepancySeverity | "all">("all");
  const [selectedDate, setSelectedDate] = useState("");
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<DiscrepancyItem | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = {
        page: 1,
        limit: 200,
        status: statusFilter === "all" ? undefined : statusFilter,
        severity: severityFilter === "all" ? undefined : severityFilter,
        dateFrom: selectedDate || undefined,
        dateTo: selectedDate || undefined,
      };

      

      const [statsResponse, listResponse] = await Promise.all([
        api.get("/discrepancies/stats"),
        api.get("/discrepancies", { params }),
      ]);

      

      const rows = Array.isArray(listResponse.data?.discrepancies)
        ? listResponse.data.discrepancies
        : [];

      const mapped: DiscrepancyItem[] = rows.map((row: any) => ({
        id: row.id || "",
        route_number: row.route_number || "-",
        bus_number: row.bus_number || "-",
        transaction_date: row.transaction_date || "",
        expected_revenue: Number(row.expected_revenue || 0),
        expected_daily: Number(row.expected_daily || 0),
        expected_weekly: Number(row.expected_weekly || 0),
        expected_monthly: Number(row.expected_monthly || 0),
        actual_revenue: Number(row.actual_revenue || 0),
        actual_weekly: Number(row.actual_weekly || 0),
        actual_monthly: Number(row.actual_monthly || 0),
        loss_amount: Number(row.loss_amount || 0),
        anomaly_score: Number(row.anomaly_score || 0),
        status: (row.status || "pending") as DiscrepancyStatus,
        severity: (row.severity || "low") as DiscrepancySeverity,
        notes: row.notes || "",
        detection_method: row.detection_method || "timeseries_residual_v1",
      }));

      setItems(mapped);
      setStats({
        totalDiscrepancies: Number(statsResponse.data?.totalDiscrepancies || mapped.length),
        totalLoss: Number(statsResponse.data?.totalLoss || 0),
      });

      

      // keep modal selected item in sync with refreshed data
      setSelectedItem((prev) => {
        if (!prev) return prev;
        const found = mapped.find((it) => it.id === prev.id);
        return found || prev;
      });
    } catch {
      setItems([]);
      setStats({ totalDiscrepancies: 0, totalLoss: 0 });
      setError("Failed to load discrepancies.");
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate, severityFilter, statusFilter]);

  const runAnalysis = useCallback(async () => {
    setIsAnalyzing(true);
    try {
      await api.post("/discrepancies/analyze", null, { params: { days: 90 } });
    } catch {
      // continue to load whatever data is already available
    } finally {
      setIsAnalyzing(false);
    }
  }, []);
  useEffect(() => {
    const run = async () => {
      await loadData();
    };
    void run();
  }, [loadData, runAnalysis]);

  useEffect(() => {
    void loadData();

    // poll for updates every 2 minutes (120000 ms)
    const interval = setInterval(() => {
      void loadData();
    }, 120000);

    return () => clearInterval(interval);
  }, [loadData]);

  // Export current items as CSV
  const exportReport = () => {
    if (!items || items.length === 0) return;
    const headers = [
      "ID",
      "Route",
      "Bus Number",
      "Date",
      "Expected Revenue",
      "Actual Revenue",
      "Loss Amount",
      "Status",
      "Severity",
      "Notes",
    ];

    const rows = items.map((it) => [
      it.id,
      it.route_number,
      it.bus_number,
      it.transaction_date,
      it.expected_revenue.toFixed(2),
      it.actual_revenue.toFixed(2),
      it.loss_amount.toFixed(2),
      it.status,
      it.severity,
      (it.notes || "").replace(/\n/g, " "),
    ]);

    const csvContent = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `discrepancies_report_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const filteredItems = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();

    return items.filter((item) => {
      // search term
      if (term) {
        const matchesTerm =
          (item.id || "").toLowerCase().includes(term) ||
          (item.route_number || "").toLowerCase().includes(term) ||
          (item.bus_number || "").toLowerCase().includes(term) ||
          (item.notes || "").toLowerCase().includes(term);
        if (!matchesTerm) return false;
      }

      // status filter
      if (statusFilter && statusFilter !== "all") {
        if (String(item.status || "").trim().toLowerCase() !== String(statusFilter).trim().toLowerCase()) return false;
      }

      // severity filter
      if (severityFilter && severityFilter !== "all") {
        if (String(item.severity || "").trim().toLowerCase() !== String(severityFilter).trim().toLowerCase()) return false;
      }

      // date filter (match exact day)
      if (selectedDate) {
        const tx = item.transaction_date ? new Date(item.transaction_date) : null;
        if (!tx || Number.isNaN(tx.getTime())) return false;
        const y = tx.getFullYear();
        const m = String(tx.getMonth() + 1).padStart(2, "0");
        const d = String(tx.getDate()).padStart(2, "0");
        const txLabel = `${y}-${m}-${d}`;
        if (txLabel !== selectedDate) return false;
      }

      return true;
    });
  }, [items, searchQuery, statusFilter, severityFilter, selectedDate]);

  

  const updateStatus = async (id: string, status: DiscrepancyStatus, notes: string) => {
    try {
      await api.put(`/discrepancies/${id}/status`, { status, notes });
      await loadData();
    } catch {
      setError("Failed to update discrepancy status.");
    }
  };

  return (
    <div className="space-y-6 text-sm">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 mb-1">Discrepancies</h1>
        <p className="text-sm text-slate-500">
          ML-based anomaly detection on bus revenue (daily, weekly and monthly baselines).
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Total Discrepancies</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{stats.totalDiscrepancies}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Total Loss</p>
          <p className="mt-1 text-2xl font-semibold text-red-600">Rs {stats.totalLoss.toFixed(2)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Export</p>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => exportReport()}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
            >
              Export report
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-full md:w-1/4">
            <label htmlFor="searchInput" className="text-[11px] font-semibold text-slate-600 mb-1 block">Search</label>
            <div className="relative">
              <input
                id="searchInput"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by ticket, route, bus number, start, origin"
                className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              </div>
            </div>
          </div>

          <div className="w-full md:w-1/6">
            <label htmlFor="statusFilter" className="text-[11px] font-semibold text-slate-600 mb-1 block">Status</label>
            <div className="relative">
              <select
                id="statusFilter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as DiscrepancyStatus | "all")}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 appearance-none pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
          </div>

          <div className="w-full md:w-1/6">
            <label htmlFor="severityFilter" className="text-[11px] font-semibold text-slate-600 mb-1 block">Severity</label>
            <div className="relative">
              <select
                id="severityFilter"
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value as DiscrepancySeverity | "all")}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 appearance-none pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {severityOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
          </div>

          <div className="w-full md:w-1/4">
            <label htmlFor="selectedDate" className="text-[11px] font-semibold text-slate-600 mb-1 block">Date</label>
            <div className="relative">
              <input
                id="selectedDate"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M16 3v4M8 3v4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-xs text-red-600">{error}</div>
      )}

      

      <div className="space-y-4">
        {isLoading && (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-400">
            Loading discrepancies...
          </div>
        )}
      {isDetailsOpen && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-4xl rounded-2xl bg-white border border-slate-200 shadow-xl overflow-hidden">
            <div className="flex items-start justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Discrepancy Details</h3>
                <p className="text-xs text-slate-500 mt-1">Revenue and status details</p>
              </div>
              <button type="button" onClick={() => setIsDetailsOpen(false)} className="text-slate-400 hover:text-slate-600 text-lg leading-none">×</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 px-5 py-4">
              <div className="md:col-span-2 space-y-4">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <h4 className="text-sm font-medium text-slate-800 mb-3">Revenue Details</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="text-xs text-slate-500">Expected Revenue</p>
                      <p className="mt-2 text-lg font-bold text-slate-900">Rs {selectedItem.expected_revenue.toFixed(2)}</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="text-xs text-slate-500">Actual Revenue</p>
                      <p className="mt-2 text-lg font-bold text-slate-900">Rs {selectedItem.actual_revenue.toFixed(2)}</p>
                    </div>
                    <div className="rounded-lg bg-red-50 p-3">
                      <p className="text-xs text-slate-500">Difference</p>
                      <p className="mt-2 text-lg font-bold text-red-600">-Rs {selectedItem.loss_amount.toFixed(2)}</p>
                    </div>
                  </div>
                  <hr className="my-4" />
                  <div>
                    <h5 className="text-sm font-medium text-slate-800 mb-2">Impact Analysis</h5>
                    <p className="text-xs text-slate-600">{selectedItem.notes || "No additional notes."}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <h4 className="text-sm font-medium text-slate-800 mb-3">Status Management</h4>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-2">Current Status</label>
                    <select
                      value={selectedItem.status}
                      onChange={(e) => {
                        const next = e.target.value as DiscrepancyStatus;
                        setSelectedItem((prev) => (prev ? { ...prev, status: next } : prev));
                      }}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    >
                      <option value="pending">Pending</option>
                      <option value="investigating">Investigating</option>
                      <option value="escalated">Escalated</option>
                      <option value="resolved">Resolved</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-100">
              <button
                type="button"
                onClick={async () => {
                  if (!selectedItem) return;
                  setIsSaving(true);
                  setError(null);
                  try {
                    await api.put(`/discrepancies/${selectedItem.id}/status`, { status: selectedItem.status, notes: selectedItem.notes || "" });
                    await loadData();
                    setIsDetailsOpen(false);
                  } catch (err) {
                    setError("Failed to save changes.");
                  } finally {
                    setIsSaving(false);
                  }
                }}
                disabled={isSaving}
                className={`rounded-full px-4 py-1.5 text-xs font-medium text-white ${isSaving ? 'bg-blue-500' : 'bg-blue-600 hover:bg-blue-700'}`}
              >
                {isSaving ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}

        {!isLoading && filteredItems.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-400">
            No anomalies detected for current filters.
          </div>
        )}

        {!isLoading &&
          filteredItems.map((item) => {
            const txDate = item.transaction_date ? new Date(item.transaction_date) : null;
            const dateLabel = txDate && !Number.isNaN(txDate.getTime()) ? txDate.toISOString().slice(0, 10) : "-";
            const displayId = item.id ? `DISC-${item.id.slice(0, 8).toUpperCase()}` : "DISC-UNKNOWN";

            return (
              <article key={item.id} className="rounded-md border border-slate-200 bg-white px-3 py-2 shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-slate-900">{displayId}</h2>
                    <span className={`rounded-full border px-3 py-0.5 text-xs font-medium capitalize ${severityBadgeClass(item.severity)}`}>
                      {item.severity}
                    </span>
                    <span className={`rounded-full border px-3 py-0.5 text-xs font-medium capitalize ${statusBadgeClass(item.status)}`}>
                      {item.status}
                    </span>
                  </div>

                  <div className="text-right">
                    <p className="text-xl font-bold text-red-600">-Rs {item.loss_amount.toFixed(2)}</p>
                    <p className="text-xs text-slate-500">Expected: Rs {item.expected_revenue.toFixed(2)}</p>
                    <p className="text-xs text-slate-500">Actual: Rs {item.actual_revenue.toFixed(2)}</p>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3 text-sm">
                  <div>
                    <p className="text-slate-500">Route</p>
                    <p className="text-base font-semibold text-slate-900">{item.route_number || "-"}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Bus Number</p>
                    <p className="text-base font-semibold text-slate-900">{item.bus_number || "-"}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Date</p>
                    <p className="text-base font-semibold text-slate-900">{dateLabel}</p>
                  </div>
                </div>

                {item.notes && !item.notes.startsWith("System-detected anomaly") && (
                  <p className="mt-3 text-xs text-slate-600">{item.notes}</p>
                )}

                

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedItem(item);
                      setIsDetailsOpen(true);
                    }}
                    className="rounded-lg border border-slate-200 px-3 py-1 text-xs inline-flex items-center gap-2 bg-white"
                  >
                    <svg className="h-4 w-4 text-slate-600" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span>View Details</span>
                  </button>
                </div>
              </article>
            );
          })}
      </div>
    </div>
  );
};

export default DiscrepanciesPage;
