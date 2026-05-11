import React, { ReactNode, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { NavLink, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import type { RootState, AppDispatch } from "../store";
import { logout } from "../store/slices/authSlice";
import NotificationContainer from "../components/NotificationContainer";
import { clearPermissionCache, useAccessPermissions } from "../hooks/useAccessPermissions";

interface MainLayoutProps {
  children: ReactNode;
}

const navLinkBaseClasses =
  "flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors";

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const userFromStore = useSelector((state: RootState) => state.auth.user);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const { canView } = useAccessPermissions();
  const theme = useSelector((state: RootState) => state.ui.theme);
  const isDark = theme === "dark";
  const { t } = useTranslation();

  const fullName = useMemo(() => {
    if (userFromStore?.fullName) return userFromStore.fullName;

    if (typeof window !== "undefined") {
      const raw = localStorage.getItem("authUser");
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as { fullName?: string };
          if (parsed.fullName) return parsed.fullName;
        } catch {
          // ignore parse errors
        }
      }
    }

    return "User";
  }, [userFromStore]);

  const rawRole = useMemo(() => {
    if (userFromStore?.role) return userFromStore.role.toLowerCase();
    if (typeof window !== "undefined") {
      const raw = localStorage.getItem("authUser");
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as { role?: string };
          return (parsed.role || "admin").toLowerCase();
        } catch {
          // ignore
        }
      }
    }
    return "admin";
  }, [userFromStore]);

  const roleLabel = useMemo(() => {
    if (rawRole === "bus_owner") return "Bus owner";
    if (rawRole === "time_keeper") return "Time keeper";
    if (rawRole === "accountant") return "Accountant";
    return "Admin";
  }, [rawRole]);

  return (
    <div
      className={`flex h-screen ${
        isDark ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900"
      }`}
    >
      {/* Sidebar */}
      <aside
        className={`w-72 flex flex-col ${
          isDark ? "bg-slate-900 border-r border-slate-800" : "bg-white border-r border-slate-200"
        }`}
      >
        <div
          className={`px-6 pt-6 pb-4 ${
            isDark ? "border-b border-slate-800" : "border-b border-slate-100"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white text-xl">
              <svg
                className="h-5 w-5 text-white"
                viewBox="0 0 20 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect
                  x="4.5"
                  y="3.5"
                  width="11"
                  height="9"
                  rx="2"
                  stroke="currentColor"
                  strokeWidth="1.4"
                />
                <rect
                  x="5.5"
                  y="4.5"
                  width="9"
                  height="3.5"
                  rx="0.9"
                  stroke="currentColor"
                  strokeWidth="1.2"
                />
                <path
                  d="M6 13.5H8.25"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
                <path
                  d="M11.75 13.5H14"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
                <circle cx="7" cy="14.5" r="1" fill="currentColor" />
                <circle cx="13" cy="14.5" r="1" fill="currentColor" />
                <path
                  d="M7 8.5V10.25"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                />
                <path
                  d="M13 8.5V10.25"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <div className="flex flex-col">
              <span className={`text-sm font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>
                FareLink
              </span>
              <span className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                Back-office portal
              </span>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {canView("dashboard") && (
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              `${navLinkBaseClasses} ${
                isActive
                  ? isDark
                    ? "bg-slate-800 text-white"
                    : "bg-blue-50 text-blue-700"
                  : isDark
                    ? "text-slate-300 hover:bg-slate-800"
                    : "text-slate-600 hover:bg-slate-50"
              }`
            }
          >
            <span className="text-lg">
              <svg
                className={`h-5 w-5 ${isDark ? "text-slate-300" : "text-slate-600"}`}
                viewBox="0 0 20 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect x="3" y="3" width="6" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.4" />
                <rect x="11" y="3" width="6" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.4" />
                <rect x="3" y="11" width="6" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.4" />
                <rect x="11" y="11" width="6" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.4" />
              </svg>
            </span>
            <span>{t("common.dashboard")}</span>
          </NavLink>
          )}

          {canView("discrepancies") && (
          <NavLink
            to="/discrepancies"
            className={({ isActive }) =>
              `${navLinkBaseClasses} ${
                isActive
                  ? isDark
                    ? "bg-slate-800 text-white"
                    : "bg-blue-50 text-blue-700"
                  : isDark
                    ? "text-slate-300 hover:bg-slate-800"
                    : "text-slate-600 hover:bg-slate-50"
              }`
            }
          >
            <span className="text-lg">
              <svg
                className={`h-5 w-5 ${isDark ? "text-slate-300" : "text-slate-600"}`}
                viewBox="0 0 20 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M3.75 15.5L10 4.5L16.25 15.5H3.75Z"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M10 8.25V11.5"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M10 13.5H10.01"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span>{t("common.discrepancies")}</span>
          </NavLink>
          )}

          {canView("routes") && (
          <NavLink
            to="/routes"
            className={({ isActive }) =>
              `${navLinkBaseClasses} ${
                isActive
                  ? isDark
                    ? "bg-slate-800 text-white"
                    : "bg-blue-50 text-blue-700"
                  : isDark
                    ? "text-slate-300 hover:bg-slate-800"
                    : "text-slate-600 hover:bg-slate-50"
              }`
            }
          >
            <span className="text-lg">
              <svg
                className={`h-5 w-5 ${isDark ? "text-slate-300" : "text-slate-600"}`}
                viewBox="0 0 20 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M4 4.75L8 3.5L12 4.75L16 3.5V15.25L12 16.5L8 15.25L4 16.5V4.75Z"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M8 3.75V15.25"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M12 4.75V16.25"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span>{t("common.routes")}</span>
          </NavLink>
          )}

          {canView("buses") && (
          <NavLink
            to="/buses"
            className={({ isActive }) =>
              `${navLinkBaseClasses} ${
                isActive
                  ? isDark
                    ? "bg-slate-800 text-white"
                    : "bg-blue-50 text-blue-700"
                  : isDark
                    ? "text-slate-300 hover:bg-slate-800"
                    : "text-slate-600 hover:bg-slate-50"
              }`
            }
          >
            <span className="text-lg">
              <svg
                className={`h-5 w-5 ${isDark ? "text-slate-300" : "text-slate-600"}`}
                viewBox="0 0 20 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect x="3.5" y="5" width="13" height="7" rx="1.6" stroke="currentColor" strokeWidth="1.4" />
                <circle cx="7" cy="13.5" r="1" fill="currentColor" />
                <circle cx="13" cy="13.5" r="1" fill="currentColor" />
              </svg>
            </span>
            <span>{t("common.buses")}</span>
          </NavLink>
          )}

          {canView("summary") && (
          <NavLink
            to="/summary"
            className={({ isActive }) =>
              `${navLinkBaseClasses} ${
                isActive
                  ? isDark
                    ? "bg-slate-800 text-white"
                    : "bg-blue-50 text-blue-700"
                  : isDark
                    ? "text-slate-300 hover:bg-slate-800"
                    : "text-slate-600 hover:bg-slate-50"
              }`
            }
          >
            <span className="text-lg">
              <svg
                className={`h-5 w-5 ${isDark ? "text-slate-300" : "text-slate-600"}`}
                viewBox="0 0 20 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M3 5.5H17"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
                <path
                  d="M3 10H17"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
                <path
                  d="M3 14.5H17"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
                <circle cx="6" cy="5.5" r="1" fill="currentColor" />
                <circle cx="10" cy="10" r="1" fill="currentColor" />
                <circle cx="14" cy="14.5" r="1" fill="currentColor" />
              </svg>
            </span>
            <span>{t("common.summary")}</span>
          </NavLink>
          )}

          {canView("timetable") && (
          <NavLink
            to="/timetable"
            className={({ isActive }) =>
              `${navLinkBaseClasses} ${
                isActive
                  ? isDark
                    ? "bg-slate-800 text-white"
                    : "bg-blue-50 text-blue-700"
                  : isDark
                    ? "text-slate-300 hover:bg-slate-800"
                    : "text-slate-600 hover:bg-slate-50"
              }`
            }
          >
            <span className="text-lg">
              <svg
                className={`h-5 w-5 ${isDark ? "text-slate-300" : "text-slate-600"}`}
                viewBox="0 0 20 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect x="3" y="4" width="14" height="13" rx="1.8" stroke="currentColor" strokeWidth="1.4" />
                <path d="M3 8H17" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                <path d="M7 3V6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                <path d="M13 3V6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </span>
            <span>{t("common.timetable")}</span>
          </NavLink>
          )}

          {canView("reports") && (
          <NavLink
            to="/reports"
            className={({ isActive }) =>
              `${navLinkBaseClasses} ${
                isActive
                  ? isDark
                    ? "bg-slate-800 text-white"
                    : "bg-blue-50 text-blue-700"
                  : isDark
                    ? "text-slate-300 hover:bg-slate-800"
                    : "text-slate-600 hover:bg-slate-50"
              }`
            }
          >
            <span className="text-lg">
              <svg
                className={`h-5 w-5 ${isDark ? "text-slate-300" : "text-slate-600"}`}
                viewBox="0 0 20 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M4.5 11.5V15.5"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M9.5 8.5V15.5"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M14.5 5.5V15.5"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M3 15.5H17"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span>{t("common.reports")}</span>
          </NavLink>
          )}

          {canView("users") && (
          <NavLink
            to="/users"
            className={({ isActive }) =>
              `${navLinkBaseClasses} ${
                isActive
                  ? isDark
                    ? "bg-slate-800 text-white"
                    : "bg-blue-50 text-blue-700"
                  : isDark
                    ? "text-slate-300 hover:bg-slate-800"
                    : "text-slate-600 hover:bg-slate-50"
              }`
            }
          >
            <span className="text-lg">
              <svg
                className={`h-5 w-5 ${isDark ? "text-slate-300" : "text-slate-600"}`}
                viewBox="0 0 20 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle cx="7" cy="7" r="2.2" stroke="currentColor" strokeWidth="1.4" />
                <circle cx="13" cy="7" r="2.2" stroke="currentColor" strokeWidth="1.4" />
                <path d="M3.75 14.5C4.4 12.95 5.85 12 7.5 12H8.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                <path d="M11.5 12H12.5C14.15 12 15.6 12.95 16.25 14.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </span>
            <span>{t("common.users")}</span>
          </NavLink>
          )}

          {rawRole === "admin" && canView("audit_logs") && (
            <NavLink
              to="/audit-logs"
              className={({ isActive }) =>
                `${navLinkBaseClasses} ${
                  isActive
                    ? isDark
                      ? "bg-slate-800 text-white"
                      : "bg-blue-50 text-blue-700"
                    : isDark
                      ? "text-slate-300 hover:bg-slate-800"
                      : "text-slate-600 hover:bg-slate-50"
                }`
              }
            >
              <span className="text-lg">
                <svg
                  className={`h-5 w-5 ${isDark ? "text-slate-300" : "text-slate-600"}`}
                  viewBox="0 0 20 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <rect x="4" y="3.5" width="12" height="13" rx="1.8" stroke="currentColor" strokeWidth="1.4" />
                  <path d="M7 7.25H13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  <path d="M7 10H13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  <path d="M7 12.75H11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
              </span>
              <span>{t("common.auditLogs")}</span>
            </NavLink>
          )}
        </nav>

        <div className="px-4 pb-6 pt-2 relative">
          <button
            type="button"
            onClick={() => setIsUserMenuOpen((prev) => !prev)}
            className={`w-full rounded-2xl border px-4 py-3 flex items-center justify-between text-left transition ${
              isDark
                ? "bg-slate-900 border-slate-800 hover:bg-slate-800"
                : "bg-slate-50 border-slate-200 hover:bg-slate-100"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-semibold">
                {fullName
                  .split(" ")
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((n) => n[0]?.toUpperCase())
                  .join("") || "U"}
              </div>
              <div className="flex flex-col">
                <span className={`text-sm font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>
                  {fullName}
                </span>
                <span className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  {roleLabel}
                </span>
              </div>
            </div>
            <svg
              className={`h-5 w-5 ${isDark ? "text-slate-400" : "text-slate-500"}`}
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M5 7.5L10 12.5L15 7.5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          {isUserMenuOpen && (
            <div
              className={`absolute left-4 right-4 bottom-20 rounded-xl border shadow-lg py-1 text-sm z-10 ${
                isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  setIsUserMenuOpen(false);
                  navigate("/profile");
                }}
                className={`w-full flex items-center justify-between px-3 py-2 ${
                  isDark ? "hover:bg-slate-800 text-slate-200" : "hover:bg-slate-50 text-slate-700"
                }`}
              >
                <span className="flex items-center gap-2">
                  <svg
                    className={`h-5 w-5 ${isDark ? "text-slate-400" : "text-slate-500"}`}
                    viewBox="0 0 20 20"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M10 10.5C11.933 10.5 13.5 8.933 13.5 7C13.5 5.067 11.933 3.5 10 3.5C8.067 3.5 6.5 5.067 6.5 7C6.5 8.933 8.067 10.5 10 10.5Z"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M5 15.75C5.774 14.246 7.273 13.25 9 13.25H11C12.727 13.25 14.226 14.246 15 15.75"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span>{t("common.profile")}</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsUserMenuOpen(false);
                  navigate("/settings");
                }}
                className={`w-full flex items-center justify-between px-3 py-2 ${
                  isDark ? "hover:bg-slate-800 text-slate-200" : "hover:bg-slate-50 text-slate-700"
                }`}
              >
                <span className="flex items-center gap-2">
                  <svg
                    className={`h-5 w-5 ${isDark ? "text-slate-400" : "text-slate-500"}`}
                    viewBox="0 0 20 20"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M11.9167 3.29167L12.3083 4.51667C12.3917 4.775 12.6167 4.95833 12.8833 4.975L14.2333 5.06667C14.85 5.10833 15.3 5.675 15.1917 6.28333L14.9667 7.55C14.9167 7.825 15.0083 8.10833 15.2083 8.3L16.1667 9.23333C16.6083 9.66667 16.6083 10.35 16.1667 10.7833L15.2083 11.7167C15.0083 11.9083 14.9167 12.1917 14.9667 12.4667L15.1917 13.7333C15.3 14.3417 14.85 14.9083 14.2333 14.95L12.8833 15.0417C12.6167 15.0583 12.3917 15.2417 12.3083 15.5L11.9167 16.725C11.725 17.3333 11.0583 17.6417 10.4833 17.3667C10.0917 17.1833 9.53333 17.1833 9.14167 17.3667C8.56667 17.6417 7.9 17.3333 7.70833 16.725L7.31667 15.5C7.23333 15.2417 7.00833 15.0583 6.74167 15.0417L5.39167 14.95C4.775 14.9083 4.325 14.3417 4.43333 13.7333L4.65833 12.4667C4.70833 12.1917 4.61667 11.9083 4.41667 11.7167L3.45833 10.7833C3.01667 10.35 3.01667 9.66667 3.45833 9.23333L4.41667 8.3C4.61667 8.10833 4.70833 7.825 4.65833 7.55L4.43333 6.28333C4.325 5.675 4.775 5.10833 5.39167 5.06667L6.74167 4.975C7.00833 4.95833 7.23333 4.775 7.31667 4.51667L7.70833 3.29167C7.9 2.68333 8.56667 2.375 9.14167 2.65C9.53333 2.83333 10.0917 2.83333 10.4833 2.65C11.0583 2.375 11.725 2.68333 11.9167 3.29167Z"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M12.5 10C12.5 11.3807 11.3807 12.5 10 12.5C8.61929 12.5 7.5 11.3807 7.5 10C7.5 8.61929 8.61929 7.5 10 7.5C11.3807 7.5 12.5 8.61929 12.5 10Z"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span>{t("common.settings")}</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsUserMenuOpen(false);
                  localStorage.removeItem("authToken");
                  localStorage.removeItem("refreshToken");
                  localStorage.removeItem("authUser");
                  clearPermissionCache();
                  dispatch(logout());
                  navigate("/login");
                }}
                className={`w-full flex items-center justify-between px-3 py-2 text-red-600 mt-1 border-t ${
                  isDark
                    ? "border-slate-800 hover:bg-red-500/10"
                    : "border-slate-100 hover:bg-red-50"
                }`}
              >
                <span className="flex items-center gap-2">
                  <svg
                    className="h-5 w-5 text-red-500"
                    viewBox="0 0 20 20"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M11.5 4.5H6.75C5.7835 4.5 5 5.2835 5 6.25V13.75C5 14.7165 5.7835 15.5 6.75 15.5H11.5"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M13.5 10L9.5 6.5M13.5 10L9.5 13.5M13.5 10H9.5"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span>{t("common.logout")}</span>
                </span>
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto relative">
        <NotificationContainer />
        <div className="max-w-6xl mx-auto px-8 py-6">{children}</div>
      </main>
    </div>
  );
};

export default MainLayout;
