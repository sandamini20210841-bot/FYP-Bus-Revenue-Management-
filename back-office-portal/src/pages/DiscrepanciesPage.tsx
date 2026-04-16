import React, { useCallback, useEffect, useMemo, useState } from "react";
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

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<DiscrepancyStatus | "all">("all");
  const [severityFilter, setSeverityFilter] = useState<DiscrepancySeverity | "all">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [statsResponse, listResponse] = await Promise.all([
        api.get("/discrepancies/stats"),
        api.get("/discrepancies", {
          params: {
            page: 1,
            limit: 200,
            status: statusFilter === "all" ? undefined : statusFilter,
            severity: severityFilter === "all" ? undefined : severityFilter,
            dateFrom: dateFrom || undefined,
            dateTo: dateTo || undefined,
          },
        }),
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
    } catch {
      setItems([]);
      setStats({ totalDiscrepancies: 0, totalLoss: 0 });
      setError("Failed to load discrepancies.");
    } finally {
      setIsLoading(false);
    }
  }, [dateFrom, dateTo, severityFilter, statusFilter]);

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
      await runAnalysis();
      await loadData();
    };
    void run();
  }, [loadData, runAnalysis]);

  const filteredItems = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    if (!term) return items;

    return items.filter((item) => {
      return (
        item.id.toLowerCase().includes(term) ||
        item.route_number.toLowerCase().includes(term) ||
        item.bus_number.toLowerCase().includes(term) ||
        item.notes.toLowerCase().includes(term)
      );
    });
  }, [items, searchQuery]);

  const updateStatus = async (id: string, status: DiscrepancyStatus, notes: string) => {
    try {
      await api.put(`/discrepancies/${id}/status`, { status, notes });
      await loadData();
    } catch {
      setError("Failed to update discrepancy status.");
    }
  };

  return (
    <div className="space-y-6">
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
          <p className="text-xs text-slate-500">System Analysis</p>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                void (async () => {
                  await runAnalysis();
                  await loadData();
                })();
              }}
              disabled={isAnalyzing}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isAnalyzing ? "Analyzing..." : "Run Analysis"}
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by ID, route, bus"
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900"
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as DiscrepancyStatus | "all")}
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value as DiscrepancySeverity | "all")}
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900"
          >
            {severityOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900"
          />

          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900"
          />
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
              <article key={item.id} className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-semibold text-slate-900">{displayId}</h2>
                    <span className={`rounded-full border px-3 py-0.5 text-xs font-medium capitalize ${severityBadgeClass(item.severity)}`}>
                      {item.severity}
                    </span>
                    <span className={`rounded-full border px-3 py-0.5 text-xs font-medium capitalize ${statusBadgeClass(item.status)}`}>
                      {item.status}
                    </span>
                  </div>

                  <div className="text-right">
                    <p className="text-4xl font-bold text-red-600">-Rs {item.loss_amount.toFixed(2)}</p>
                    <p className="text-sm text-slate-500">Expected: Rs {item.expected_revenue.toFixed(2)}</p>
                    <p className="text-sm text-slate-500">Actual: Rs {item.actual_revenue.toFixed(2)}</p>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3 text-sm">
                  <div>
                    <p className="text-slate-500">Route</p>
                    <p className="text-xl font-semibold text-slate-900">{item.route_number || "-"}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Bus Number</p>
                    <p className="text-xl font-semibold text-slate-900">{item.bus_number || "-"}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Date</p>
                    <p className="text-xl font-semibold text-slate-900">{dateLabel}</p>
                  </div>
                </div>

                <p className="mt-4 text-lg text-slate-600">
                  {item.notes || "System detected abnormal revenue drop for this bus/date."}
                </p>

                <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-3 text-sm text-slate-600">
                  <p>Daily baseline: Rs {item.expected_daily.toFixed(2)}</p>
                  <p>Weekly baseline: Rs {item.expected_weekly.toFixed(2)}</p>
                  <p>Monthly baseline: Rs {item.expected_monthly.toFixed(2)}</p>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-slate-500">Status:</span>
                  <select
                    value={item.status}
                    onChange={(e) => {
                      void updateStatus(item.id, e.target.value as DiscrepancyStatus, item.notes);
                    }}
                    className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
                  >
                    <option value="pending">Pending</option>
                    <option value="investigating">Investigating</option>
                    <option value="escalated">Escalated</option>
                    <option value="resolved">Resolved</option>
                  </select>
                  <span className="text-xs text-slate-500">Model: {item.detection_method || "timeseries_residual_v1"}</span>
                  <span className="text-xs text-slate-500">Score: {item.anomaly_score.toFixed(2)}</span>
                </div>
              </article>
            );
          })}
      </div>
    </div>
  );
};

export default DiscrepanciesPage;
