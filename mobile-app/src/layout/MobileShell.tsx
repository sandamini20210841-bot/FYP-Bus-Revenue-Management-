import { ReactNode, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppDispatch } from "../hooks/useAppHooks";
import { logout } from "../store/slices/authSlice";

interface MobileShellProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  showBackButton?: boolean;
}

const MobileShell = ({ title, subtitle, children, showBackButton = false }: MobileShellProps) => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    dispatch(logout());
    localStorage.removeItem("authToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("authUser");
    setMenuOpen(false);
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-white">
      <header className="px-5 pt-4 pb-3 flex items-center justify-between">
        {showBackButton ? (
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mr-3 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white bg-white text-slate-900 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-white/70"
            aria-label="Go back"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        ) : (
          <span className="w-8" />
        )}

        <div className="flex flex-col flex-1 items-center">
          <h1 className="text-lg font-semibold text-center">{title}</h1>
          {subtitle && (
            <p className="text-[11px] text-slate-400 mt-0.5 text-center">
              {subtitle}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen((prev) => !prev)}
          className="ml-3 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white bg-white text-slate-900 shadow-sm hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-white/70"
          aria-label="Open menu"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      </header>

      <main className="flex-1 px-5 pb-6">{children}</main>

      {menuOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40"
          onClick={() => setMenuOpen(false)}
        >
          <div
            className="absolute right-0 top-0 h-full w-60 max-w-[70%] bg-slate-900 shadow-xl border-l border-slate-800 flex flex-col pt-4 pb-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 pb-4 border-b border-slate-800 mb-2">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Menu
              </p>
            </div>

            <nav className="flex-1 px-2 space-y-1 text-sm">
              <button
                type="button"
                onClick={() => {
                  navigate("/tickets/purchase");
                  setMenuOpen(false);
                }}
                className="flex w-full items-center rounded-lg px-3 py-2 text-slate-100 hover:bg-slate-800/80"
              >
                <span className="mr-3 inline-flex h-7 w-7 items-center justify-center rounded-md bg-slate-800 text-emerald-400">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="5" width="18" height="14" rx="2" ry="2" />
                    <path d="M7 9h10M7 13h6" />
                  </svg>
                </span>
                <span>Purchase ticket</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  navigate("/tickets/history");
                  setMenuOpen(false);
                }}
                className="flex w-full items-center rounded-lg px-3 py-2 text-slate-100 hover:bg-slate-800/80"
              >
                <span className="mr-3 inline-flex h-7 w-7 items-center justify-center rounded-md bg-slate-800 text-emerald-400">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 4h18" />
                    <path d="M3 10h18" />
                    <path d="M3 16h18" />
                    <path d="M3 22h18" />
                  </svg>
                </span>
                <span>History</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  navigate("/profile");
                  setMenuOpen(false);
                }}
                className="flex w-full items-center rounded-lg px-3 py-2 text-slate-100 hover:bg-slate-800/80"
              >
                <span className="mr-3 inline-flex h-7 w-7 items-center justify-center rounded-md bg-slate-800 text-emerald-400">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z" />
                    <path d="M4 20a8 8 0 0 1 16 0" />
                  </svg>
                </span>
                <span>Profile</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  navigate("/settings");
                  setMenuOpen(false);
                }}
                className="flex w-full items-center rounded-lg px-3 py-2 text-slate-100 hover:bg-slate-800/80"
              >
                <span className="mr-3 inline-flex h-7 w-7 items-center justify-center rounded-md bg-slate-800 text-emerald-400">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.65 1.65 0 0 0 15 19.4a1.65 1.65 0 0 0-1 .6 1.65 1.65 0 0 0-.33 1.82l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 8.6 15a1.65 1.65 0 0 0-1.82-.33l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 9.6a1.65 1.65 0 0 0-.6-1A1.65 1.65 0 0 0 6.6 7.4l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-.6 1.65 1.65 0 0 0 .33-1.82l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 15 8.6a1.65 1.65 0 0 0 1 .6 1.65 1.65 0 0 0 1.82-.33l.06.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 15Z" />
                  </svg>
                </span>
                <span>Settings</span>
              </button>
            </nav>

            <div className="mt-auto px-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center rounded-lg px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300"
              >
                <span className="mr-3 inline-flex h-7 w-7 items-center justify-center rounded-md bg-red-500/10 text-red-400">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                </span>
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileShell;
