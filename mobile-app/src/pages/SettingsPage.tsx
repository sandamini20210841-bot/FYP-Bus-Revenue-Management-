import { FormEvent, useState } from "react";
import MobileShell from "../layout/MobileShell";
import api from "../utils/axios";

const SettingsPage = () => {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changing, setChanging] = useState(false);
  const [changeError, setChangeError] = useState<string | null>(null);
  const [changeSuccess, setChangeSuccess] = useState<string | null>(null);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setChangeError(null);
    setChangeSuccess(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setChangeError("All password fields are required");
      return;
    }

    if (newPassword !== confirmPassword) {
      setChangeError("New passwords do not match");
      return;
    }

    if (newPassword.length < 8) {
      setChangeError("New password must be at least 8 characters");
      return;
    }

    try {
      setChanging(true);
      await api.post("/users/me/change-password", {
        current_password: currentPassword,
        new_password: newPassword,
      });

      setChangeSuccess("Password updated successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      console.error("Change password failed", err);
      const message = err?.response?.data?.error || "Could not change password. Please try again.";
      setChangeError(message);
    } finally {
      setChanging(false);
    }
  };

  return (
    <MobileShell title="Settings" subtitle="Manage your app preferences.">
      <div className="max-w-sm mx-auto mt-4 space-y-4 text-xs">
        <section className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3">
          <h2 className="text-[13px] font-semibold mb-2">Account</h2>
          <p className="text-slate-400 mb-2">
            Basic information about your account. You can edit your profile details from the Profile screen.
          </p>
          <ul className="space-y-1.5 text-slate-300 mb-3">
            <li className="flex items-center justify-between">
              <span className="text-slate-400">Profile</span>
              <span className="text-slate-200 text-[11px]">View and edit from Profile</span>
            </li>
          </ul>

          <div className="mt-3 border-t border-slate-800 pt-3">
            <h3 className="text-[12px] font-semibold mb-2">Change password</h3>
            {changeError && (
              <div className="mb-2 rounded-lg bg-red-500/10 border border-red-500/40 px-3 py-2 text-red-200">
                {changeError}
              </div>
            )}
            {changeSuccess && (
              <div className="mb-2 rounded-lg bg-emerald-500/10 border border-emerald-500/40 px-3 py-2 text-emerald-200">
                {changeSuccess}
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-2">
              <div>
                <label className="block text-xs font-medium text-slate-200 mb-1">
                  Current password
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full rounded-lg border border-slate-800 bg-slate-900/60 px-3 pr-9 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/70"
                    placeholder="Enter your current password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-200"
                    aria-label={showCurrentPassword ? "Hide password" : "Show password"}
                  >
                    {showCurrentPassword ? (
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
                        <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c5 0 9.27 3 11 7-.61 1.75-1.53 3.3-2.69 4.62" />
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

              <div>
                <label className="block text-xs font-medium text-slate-200 mb-1">
                  New password
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full rounded-lg border border-slate-800 bg-slate-900/60 px-3 pr-9 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/70"
                    placeholder="At least 8 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-200"
                    aria-label={showNewPassword ? "Hide password" : "Show password"}
                  >
                    {showNewPassword ? (
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
                        <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c5 0 9.27 3 11 7-.61 1.75-1.53 3.3-2.69 4.62" />
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

              <div>
                <label className="block text-xs font-medium text-slate-200 mb-1">
                  Confirm new password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/70"
                  placeholder="Repeat new password"
                />
              </div>

              <button
                type="submit"
                disabled={changing}
                className="mt-1 inline-flex w-full items-center justify-center rounded-lg bg-emerald-500 px-4 py-2 text-xs font-medium text-white shadow-sm transition hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/70 disabled:opacity-60"
              >
                {changing ? "Updating..." : "Update password"}
              </button>
            </form>
          </div>
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3">
          <h2 className="text-[13px] font-semibold mb-2">Notifications</h2>
          <p className="text-slate-400 text-[11px]">
            Notification preferences will be configurable here in a future version.
          </p>
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3">
          <h2 className="text-[13px] font-semibold mb-2">App</h2>
          <p className="text-slate-400 text-[11px] mb-1">
            Default settings for language and theme.
          </p>
          <div className="flex items-center justify-between py-1">
            <span className="text-slate-300">Language</span>
            <span className="text-slate-400 text-[11px]">English (default)</span>
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-slate-300">Theme</span>
            <span className="text-slate-400 text-[11px]">Dark</span>
          </div>
        </section>

        <p className="mt-2 text-[11px] text-slate-500 text-center">
          More settings can be added here as the app grows.
        </p>
      </div>
    </MobileShell>
  );
};

export default SettingsPage;
