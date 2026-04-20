import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import api from "../utils/axios";

const DashboardPage: React.FC = () => {
  const { t } = useTranslation();
  // Dashboard summary values fetched from /discrepancies/stats
  const navigate = useNavigate();

  const [stats, setStats] = useState<{
    totalDiscrepancies: number;
    totalLoss: number;
    countByStatus?: Record<string, number>;
  }>({ totalDiscrepancies: 0, totalLoss: 0 });

  useEffect(() => {
    const loadStats = async () => {
      try {
        const resp = await api.get("/discrepancies/stats");
        // backend may return stats at top-level or nested under `stats` (support both)
        const payload = resp.data || {};
        const nested = payload.stats || payload;
        const rawCounts = nested.countByStatus || payload.byStatus || {};
        // normalize keys to lowercase
        const counts: Record<string, number> = {};
        Object.keys(rawCounts).forEach((k) => {
          counts[String(k).trim().toLowerCase()] = Number((rawCounts as any)[k] || 0);
        });

        setStats({
          totalDiscrepancies: Number(nested.totalDiscrepancies || payload.totalDiscrepancies || 0),
          totalLoss: Number(nested.totalLoss || payload.totalLoss || 0),
          countByStatus: counts,
        });
      } catch (e) {
        // ignore
      }
    };
    void loadStats();
  }, []);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 mb-1">{t("dashboard.title")}</h1>
        <p className="text-sm text-slate-500">{t("dashboard.title")}</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col justify-between">
          <div className="text-xs font-medium text-slate-500 mb-6 flex items-center gap-2">
            <span>{t("dashboard.totalDiscrepancies")}</span>
          </div>
          <div>
            <p className="text-3xl font-semibold text-slate-900">{stats.totalDiscrepancies || '-'}</p>
            
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col justify-between">
          <div className="text-xs font-medium text-slate-500 mb-6 flex items-center gap-2">
            <span>{t("discrepancies.pending")}</span>
          </div>
          <div>
            <p className="text-3xl font-semibold text-slate-900">{(stats.countByStatus && stats.countByStatus['pending']) || 0}</p>
            
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col justify-between">
          <div className="text-xs font-medium text-slate-500 mb-6 flex items-center gap-2">
            <span>{t("discrepancies.investigating")}</span>
          </div>
          <div>
            <p className="text-3xl font-semibold text-slate-900">{(stats.countByStatus && stats.countByStatus['investigating']) || 0}</p>
            
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col justify-between">
          <div className="text-xs font-medium text-slate-500 mb-2 flex items-center justify-between">
            <span>{t("dashboard.revenueLoss")}</span>
            <span className="text-slate-400 text-base">Rs</span>
          </div>
          <div>
            <p className="text-3xl font-semibold text-red-600">Rs {Number(stats.totalLoss || 0).toFixed(2)}</p>
            
          </div>
        </div>
      </div>

      {/* Recent discrepancies */}
      <RecentDiscrepancies navigate={navigate} />
    </div>
  );
};

export default DashboardPage;

type RecentProps = {
  navigate: (to: string) => void;
};

const RecentDiscrepancies: React.FC<RecentProps> = ({ navigate }) => {
  const { t } = useTranslation();
  const [items, setItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const resp = await api.get("/discrepancies", { params: { page: 1, limit: 5 } });
        const rows = Array.isArray(resp.data?.discrepancies) ? resp.data.discrepancies : [];
        setItems(rows);
      } catch (e) {
        setItems([]);
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, []);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{t("dashboard.recentDiscrepancies")}</h2>
        </div>
        <button
          type="button"
          onClick={() => navigate("/discrepancies")}
          className="text-xs font-medium text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
        >
          <span>{t("actions.viewAll")}</span>
          <span>→</span>
        </button>
      </div>

      <div className="p-4">
        {isLoading && (
          <div className="text-sm text-slate-500 px-4 py-6 text-center">{t("common.loading")}</div>
        )}

        {!isLoading && items.length === 0 && (
          <div className="px-6 py-8 text-center text-sm text-slate-400">{t("dashboard.noRecent")}</div>
        )}

        {!isLoading && items.length > 0 && (
          <div className="space-y-3">
            {items.map((it: any) => {
              const txDate = it.transaction_date ? new Date(it.transaction_date) : null;
              const dateLabel = txDate && !Number.isNaN(txDate.getTime()) ? txDate.toISOString().slice(0, 10) : "-";
              const displayId = it.id ? `DISC-${String(it.id).slice(0, 8).toUpperCase()}` : "DISC-UNKNOWN";
              return (
                <div key={it.id} className="flex items-center justify-between rounded-lg border border-slate-100 p-3">
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{displayId}</div>
                      <div className="text-xs text-slate-500">{it.route_number || '-'} • {it.bus_number || '-'}</div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-sm font-semibold text-red-600">-Rs {Number(it.loss_amount || 0).toFixed(2)}</div>
                    <div className="text-xs text-slate-500">{dateLabel}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
