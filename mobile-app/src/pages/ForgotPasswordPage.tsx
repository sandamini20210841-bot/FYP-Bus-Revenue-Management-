import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import api from "../utils/axios";
import MobileShell from "../layout/MobileShell";

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
        <p className="text-[11px] text-slate-400 mb-4">
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
            <label className="block text-xs font-medium text-slate-200 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500/70"
              placeholder="you@example.com"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="mt-1 inline-flex w-full items-center justify-center rounded-lg border border-white bg-white px-4 py-2.5 text-xs font-medium text-slate-900 shadow-sm transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-white/70 focus:ring-offset-0 disabled:opacity-60"
          >
            {submitting ? "Sending..." : "Send reset link"}
          </button>
        </form>

        <p className="mt-5 text-[11px] text-slate-400 text-center">
          Remembered your password?{" "}
          <Link
            to="/login"
            className="font-medium text-emerald-400 hover:text-emerald-300"
          >
            Back to sign in
          </Link>
        </p>
      </div>
    </MobileShell>
  );
};

export default ForgotPasswordPage;
