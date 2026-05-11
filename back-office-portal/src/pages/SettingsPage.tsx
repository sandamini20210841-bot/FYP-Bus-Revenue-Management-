import React from "react";
import i18n from "../utils/i18n";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { setTheme } from "../store/slices/uiSlice";
import type { RootState, AppDispatch } from "../store";

const LANG_OPTIONS: { value: string; label: string }[] = [
  { value: "si", label: "Sinhala" },
  { value: "ta", label: "Tamil" },
  { value: "en", label: "English" },
];

const SettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const current = i18n.language || localStorage.getItem("language") || "en";
  const dispatch = useDispatch<AppDispatch>();
  const theme = useSelector((state: RootState) => state.ui.theme);
  const isDark = theme === "dark";

  const toggleTheme = () => {
    dispatch(setTheme(isDark ? "light" : "dark"));
  };

  const handleChange = (lang: string) => {
    i18n.changeLanguage(lang);
    try {
      localStorage.setItem("language", lang);
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 mb-1">{t("common.settings")}</h1>
        <p className="text-sm text-slate-500">{t("common.settings")}</p>
      </div>

      <div
        className={`rounded-2xl border shadow-sm p-6 max-w-2xl ${
          isDark ? "bg-slate-900 border-slate-800 text-slate-100" : "bg-white border-slate-200 text-slate-900"
        }`}
      >
        <div className="space-y-4">
          <div>
            <label className={`block text-xs font-medium mb-1 ${isDark ? "text-slate-200" : "text-slate-700"}`}>
              Language
            </label>
            <select
              value={current}
              onChange={(e) => handleChange(e.target.value)}
              className={`w-full rounded-lg border px-3 py-2 text-sm ${
                isDark
                  ? "border-slate-700 bg-slate-950 text-slate-100"
                  : "border-slate-200 bg-white text-slate-900"
              }`}
            >
              {LANG_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            Select the portal language. The change is saved locally.
          </p>
          <div className="flex items-center justify-between pt-2">
            <div>
              <p className={`text-xs font-medium ${isDark ? "text-slate-200" : "text-slate-700"}`}>Theme</p>
              <p className={`text-[11px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                {isDark ? "Dark" : "Light"}
              </p>
            </div>
            <button
              type="button"
              onClick={toggleTheme}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                isDark ? "bg-slate-700" : "bg-slate-200"
              }`}
              aria-label="Toggle theme"
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                  isDark ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
