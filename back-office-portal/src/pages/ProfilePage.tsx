import React from "react";
import { useSelector } from "react-redux";
import type { RootState } from "../store";

const ProfilePage: React.FC = () => {
  const user = useSelector((state: RootState) => state.auth.user);
  const fullName = user?.fullName || "User";
  const email = user?.email || "-";
  const role = user?.role || "admin";
  const phone = "-";

  const initials = fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join("");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900 mb-1">
          Profile
        </h1>
        <p className="text-sm text-slate-500">
          View your account information and basic details.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col md:flex-row gap-6">
        <div className="flex flex-col items-center md:items-start md:w-1/3 border-r border-slate-100 pr-0 md:pr-6">
          <div className="h-20 w-20 rounded-2xl bg-blue-600 text-white flex items-center justify-center text-2xl font-semibold mb-3">
            {initials || "U"}
          </div>
          <div className="text-center md:text-left">
            <p className="text-base font-semibold text-slate-900">
              {fullName}
            </p>
            <p className="text-xs font-medium text-blue-600 uppercase tracking-wide mt-1">
              {role}
            </p>
            <p className="text-xs text-slate-400 mt-3">
              This profile is for the back-office portal user.
            </p>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-500">Full name</p>
            <p className="text-sm font-semibold text-slate-900">{fullName}</p>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-500">Email</p>
            <p className="text-sm text-slate-900">{email}</p>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-500">Phone number</p>
            <p className="text-sm text-slate-900">{phone}</p>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-500">Role</p>
            <p className="text-sm text-slate-900 capitalize">{role}</p>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-500">Status</p>
            <p className="inline-flex items-center gap-2 text-sm text-emerald-600">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Active
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-500">Security</p>
            <p className="text-xs text-slate-500">
              Password and security settings can be managed from the settings
              page.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
