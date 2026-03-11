import React from "react";
import { useNavigate } from "react-router-dom";

const DashboardPage: React.FC = () => {
  // This dashboard intentionally shows the layout only,
  // without live or mock data values.
  const navigate = useNavigate();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-semibold text-slate-900 mb-1">
          Dashboard
        </h1>
        <p className="text-sm text-slate-500">
          Overview of revenue discrepancies and system status
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col justify-between">
          <div className="text-xs font-medium text-slate-500 mb-6 flex items-center gap-2">
            <span>Total Discrepancies</span>
          </div>
          <div>
            <p className="text-3xl font-semibold text-slate-300">-</p>
            <p className="text-xs text-slate-400 mt-1">No data available</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col justify-between">
          <div className="text-xs font-medium text-slate-500 mb-6 flex items-center gap-2">
            <span>Pending Review</span>
          </div>
          <div>
            <p className="text-3xl font-semibold text-slate-300">-</p>
            <p className="text-xs text-slate-400 mt-1">No data available</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col justify-between">
          <div className="text-xs font-medium text-slate-500 mb-6 flex items-center gap-2">
            <span>Under Investigation</span>
          </div>
          <div>
            <p className="text-3xl font-semibold text-slate-300">-</p>
            <p className="text-xs text-slate-400 mt-1">No data available</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col justify-between">
          <div className="text-xs font-medium text-slate-500 mb-2 flex items-center justify-between">
            <span>Total Revenue Loss</span>
            <span className="text-slate-400 text-base">$</span>
          </div>
          <div>
            <p className="text-3xl font-semibold text-slate-300">-</p>
            <p className="text-xs text-slate-400 mt-1">No data available</p>
          </div>
        </div>
      </div>

      {/* Recent discrepancies */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Recent Discrepancies
            </h2>
          </div>
          <button
            type="button"
            onClick={() => navigate("/discrepancies")}
            className="text-xs font-medium text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
          >
            <span>View All</span>
            <span>→</span>
          </button>
        </div>

        <div className="px-6 py-8 text-center text-sm text-slate-400">
          No recent discrepancies to display.
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
