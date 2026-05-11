import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import api from "../utils/axios";
import MobileShell from "../layout/MobileShell";
import { useAppSelector } from "../hooks/useAppHooks";

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const theme = useAppSelector((state) => state.ui.theme);
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

  return (
    <MobileShell title="Forgot password" showBackButton>
      <div className="mt-2">
        <p className={`text-[11px] mb-4 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
          Enter the email associated with your account. If it exists, we&apos;ll send instructions to reset your password.
        </p>

        {message && (
          <div className="mb-3 rounded-lg bg-emerald-500/10 border border-emerald-500/40 px-3 py-2 text-[11px] text-emerald-200">
            {message}
          </div>
        )}

        {error && (
          <div className="mb-3 rounded-lg bg-red-500/10 border border-red-500/40 px-3 py-2 text-[11px] text-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className={`block text-xs font-medium mb-1 ${isDark ? "text-slate-200" : "text-slate-700"}`}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={`w-full rounded-lg border px-3 py-2 text-xs placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/70 focus:border-blue-500/70 ${
                isDark
                  ? "border-slate-700 bg-slate-900/60 text-white"
                  : "border-slate-200 bg-white text-slate-900"
              }`}
              placeholder="you@example.com"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="mt-1 inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-medium text-white shadow-sm transition hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/70 focus:ring-offset-0 disabled:opacity-60"
          >
            {submitting ? "Sending..." : "Send reset link"}
          </button>
        </form>

        <p className={`mt-5 text-[11px] text-center ${isDark ? "text-slate-400" : "text-slate-500"}`}>
          Remembered your password?{" "}
          <Link
            to="/login"
            className="font-medium text-blue-600 hover:text-blue-500"
          >
            Back to sign in
          </Link>
        </p>
      </div>
    </MobileShell>
  );
};

export default ForgotPasswordPage;
