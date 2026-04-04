import React, { useEffect, useMemo, useState } from "react";
import api from "../utils/axios";

type AuditLogRow = {
  id: string;
  userName: string;
  message: string;
  timestamp: string;
  ipAddress?: string;
};

const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadAuditLogs = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await api.get("/audit/logs", {
          params: { page: 1, limit: 100 },
        });

        const rows = Array.isArray(response.data?.logs) ? response.data.logs : [];
        const mapped: AuditLogRow[] = rows.map((row: any) => ({
          id: String(row.id || ""),
          userName: String(row.userName || "Unknown user"),
          message: String(row.message || row.details || row.action || "Action recorded"),
          timestamp: String(row.timestamp || ""),
          ipAddress: typeof row.ipAddress === "string" ? row.ipAddress : undefined,
        }));
        setLogs(mapped);
      } catch (err: any) {
        const message = err?.response?.data?.error;
        setError(message || "Failed to load audit logs.");
        setLogs([]);
      } finally {
        setIsLoading(false);
      }
    };

    void loadAuditLogs();
  }, []);

  const hasLogs = useMemo(() => logs.length > 0, [logs]);

  const formatDate = (iso: string) => {
    if (!iso) return "-";
    const dt = new Date(iso);
    if (Number.isNaN(dt.getTime())) return "-";
    return dt.toLocaleDateString();
  };

  const formatTime = (iso: string) => {
    if (!iso) return "-";
    const dt = new Date(iso);
    if (Number.isNaN(dt.getTime())) return "-";
    return dt.toLocaleTimeString();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 mb-1">Audit Logs</h1>
        <p className="text-sm text-slate-500">
          View log date and time, user, and action.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-900">Activity Logs</h2>
        </div>
        <div className="px-6 py-4 overflow-x-auto">
          <table className="min-w-full text-left text-xs text-slate-700">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4 font-semibold">Date</th>
                <th className="py-2 pr-4 font-semibold">Time</th>
                <th className="py-2 pr-4 font-semibold">User</th>
                <th className="py-2 pr-4 font-semibold">Action</th>
                <th className="py-2 pr-0 font-semibold">IP Address</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-[11px] text-slate-400">
                    Loading audit logs...
                  </td>
                </tr>
              )}

              {!isLoading && error && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-[11px] text-red-500">
                    {error}
                  </td>
                </tr>
              )}

              {!isLoading && !error && !hasLogs && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-[11px] text-slate-400">
                    No audit log records found.
                  </td>
                </tr>
              )}

              {!isLoading && !error &&
                logs.map((log) => (
                  <tr key={log.id} className="border-b border-slate-100 last:border-b-0">
                    <td className="py-3 pr-4">{formatDate(log.timestamp)}</td>
                    <td className="py-3 pr-4">{formatTime(log.timestamp)}</td>
                    <td className="py-3 pr-4">{log.userName || "-"}</td>
                    <td className="py-3 pr-4">{log.message || "-"}</td>
                    <td className="py-3 pr-0">{log.ipAddress || "-"}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AuditLogsPage;
