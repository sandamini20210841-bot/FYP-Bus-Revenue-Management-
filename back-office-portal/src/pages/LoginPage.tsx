import { FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch } from "../store";
import type { RootState } from "../store";
import { setAuthError, setAuthLoading, setToken, setUser } from "../store/slices/authSlice";
import api from "../utils/axios";
import type { AxiosError } from "axios";
import { clearPermissionCache } from "../hooks/useAccessPermissions";

const LoginPage = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: Location })?.from?.pathname || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const theme = useSelector((state: RootState) => state.ui.theme);
  const isDark = theme === "dark";

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setLocalError(null);
    dispatch(setAuthError(null));
    dispatch(setAuthLoading(true));
    setSubmitting(true);

    try {
      const response = await api.post("/auth/login", {
        email,
        password,
        portal: "backoffice",
      });
      const { token, refreshToken, user } = response.data;

      const rawRole = (user?.role || "").toString().toLowerCase();
      const isAllowedRole =
        rawRole === "admin" || rawRole === "bus_owner" || rawRole === "accountant" || rawRole === "time_keeper";

      if (!isAllowedRole) {
        setLocalError(
          "This back-office portal is only for admin, bus owner and accountant accounts. Riders should use the FareLink mobile app."
        );
        return;
      }

      if (token) {
        localStorage.setItem("authToken", token);
      }
      if (refreshToken) {
        localStorage.setItem("refreshToken", refreshToken);
      }

      if (user) {
        const mappedUser = {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role || "admin",
          permissions: [] as string[],
        };
        localStorage.setItem("authUser", JSON.stringify(mappedUser));
        dispatch(setUser(mappedUser));
      }

      if (token && refreshToken) {
        dispatch(setToken({ token, refreshToken }));
      }

      clearPermissionCache();

      const homePath = rawRole === "time_keeper" ? "/routes" : "/dashboard";
      const targetPath = from === "/" ? homePath : from;
      navigate(targetPath, { replace: true });
    } catch (error) {
      console.error("Login failed", error);
      const axiosErr = error as AxiosError<{ error?: string }>;
      const backendMessage = axiosErr.response?.data?.error;
      if (backendMessage === "Access denied") {
        setLocalError("Access denied");
      } else if (backendMessage === "Invalid email or password") {
        setLocalError("Invalid email or password. Please try again.");
      } else {
        setLocalError("Invalid email or password. Please try again.");
      }
      dispatch(setAuthError("Login failed"));
    } finally {
      dispatch(setAuthLoading(false));
      setSubmitting(false);
    }
  };

  const { t } = useTranslation();

  return (
    <div
      className={`min-h-screen flex items-center justify-center px-4 ${
        isDark ? "bg-slate-950" : "bg-slate-50"
      }`}
    >
      <div
        className={`w-full max-w-md rounded-2xl border p-8 shadow-lg ${
          isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
        }`}
      >
        <h1 className={`text-2xl font-semibold mb-2 ${isDark ? "text-slate-100" : "text-slate-900"}`}>
          {t("auth.signIn")}
        </h1>
        <p className={`text-sm mb-6 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
          {t("auth.signIn")}
        </p>

        {localError && (
          <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/40 px-3 py-2 text-sm text-red-200">
            {localError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={`block text-sm font-medium mb-1 ${isDark ? "text-slate-200" : "text-slate-700"}`}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={`w-full rounded-lg border px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/70 focus:border-blue-500/70 ${
                isDark
                  ? "border-slate-700 bg-slate-950 text-slate-100"
                  : "border-slate-200 bg-white text-slate-900"
              }`}
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className={`block text-sm font-medium mb-1 ${isDark ? "text-slate-200" : "text-slate-700"}`}>
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className={`w-full rounded-lg border px-3 pr-10 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/70 focus:border-blue-500/70 ${
                  isDark
                    ? "border-slate-700 bg-slate-950 text-slate-100"
                    : "border-slate-200 bg-white text-slate-900"
                }`}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className={`absolute inset-y-0 right-0 flex items-center pr-3 ${
                  isDark ? "text-slate-400 hover:text-slate-200" : "text-slate-400 hover:text-slate-600"
                }`}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
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
                    <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-5 0-9.27-3-11-8 1.02-2.93 2.98-5.21 5.35-6.56" />
                    <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c5 0 9.27 3 11 8-.61 1.75-1.53 3.3-2.69 4.62" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
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
                    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div className="flex justify-end">
            <Link
              to="/forgot-password"
              className="text-xs font-medium text-blue-600 hover:text-blue-500"
            >
              {t("auth.forgotPassword")}
            </Link>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/70 focus:ring-offset-0 disabled:opacity-60"
          >
            {submitting ? t("common.loading") : t("auth.signIn")}
          </button>
        </form>

        <p className={`mt-6 text-xs text-center ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            Don&apos;t have an account?{" "}
            <Link to="/register" className="font-medium text-blue-600 hover:text-blue-500">
              {t("auth.createAccount")}
            </Link>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
