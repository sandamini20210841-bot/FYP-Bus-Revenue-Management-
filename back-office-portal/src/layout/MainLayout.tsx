import React, { ReactNode } from "react";
import { NavLink } from "react-router-dom";

interface MainLayoutProps {
  children: ReactNode;
}

const navLinkBaseClasses =
  "flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors";

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  return (
    <div className="flex h-screen bg-slate-50 text-slate-900">
      {/* Sidebar */}
      <aside className="w-72 bg-white border-r border-slate-200 flex flex-col">
        <div className="px-6 pt-6 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white text-xl">
              🚌
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-slate-900">
                Bus Revenue
              </span>
              <span className="text-xs text-slate-500">
                Discrepancy Management
              </span>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `${navLinkBaseClasses} ${
                isActive
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-600 hover:bg-slate-50"
              }`
            }
          >
            <span className="text-lg">🏠</span>
            <span>Dashboard</span>
          </NavLink>

          <NavLink
            to="/discrepancies"
            className={({ isActive }) =>
              `${navLinkBaseClasses} ${
                isActive
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-600 hover:bg-slate-50"
              }`
            }
          >
            <span className="text-lg">⚠️</span>
            <span>Discrepancies</span>
          </NavLink>

          <NavLink
            to="/routes"
            className={({ isActive }) =>
              `${navLinkBaseClasses} ${
                isActive
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-600 hover:bg-slate-50"
              }`
            }
          >
            <span className="text-lg">🗺️</span>
            <span>Routes</span>
          </NavLink>

          <NavLink
            to="/reports"
            className={({ isActive }) =>
              `${navLinkBaseClasses} ${
                isActive
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-600 hover:bg-slate-50"
              }`
            }
          >
            <span className="text-lg">📊</span>
            <span>Reports</span>
          </NavLink>
        </nav>

        <div className="px-4 pb-6 pt-2">
          <div className="rounded-2xl bg-slate-50 border border-slate-200 px-4 py-3">
            <p className="text-xs font-medium text-slate-500 mb-2">
              System Status
            </p>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <span className="text-xs font-medium text-slate-700">
                All Systems Operational
              </span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-8 py-6">{children}</div>
      </main>
    </div>
  );
};

export default MainLayout;
