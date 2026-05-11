import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import api from "../utils/axios";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import type { RootState } from "../store";

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const theme = useSelector((state: RootState) => state.ui.theme);
  const isDark = theme === "dark";

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setMessage(null);
    setError(null);
    setSubmitting(true);

    try {
      const response = await api.post("/auth/forgot-password", { email });
      const backendMessage = (response.data && response.data.message) ||
        "If an account exists for this email, password reset instructions have been sent.";
      setMessage(backendMessage);
    } catch (err) {
      console.error("Forgot password request failed", err);
      setError("Unable to process request right now. Please try again.");
    } finally {
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
          {t("auth.forgotPassword")}
        </h1>
        <p className={`text-sm mb-6 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
          {t("auth.forgotPassword")}
        </p>

        {message && (
          <div className="mb-4 rounded-lg bg-emerald-500/10 border border-emerald-500/40 px-3 py-2 text-sm text-emerald-200">
            {message}
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/40 px-3 py-2 text-sm text-red-200">
            {error}
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

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/70 focus:ring-offset-0 disabled:opacity-60"
          >
            {submitting ? t("common.loading") : t("auth.forgotPassword")}
          </button>
        </form>

        <p className={`mt-6 text-xs text-center ${isDark ? "text-slate-400" : "text-slate-500"}`}>
          Remembered your password?{" "}
          <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500">
            {t("auth.signIn")}
          </Link>
        </p>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
