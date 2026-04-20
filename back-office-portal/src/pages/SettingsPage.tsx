import React from "react";
import i18n from "../utils/i18n";
import { useTranslation } from "react-i18next";

const LANG_OPTIONS: { value: string; label: string }[] = [
  { value: "si", label: "Sinhala" },
  { value: "ta", label: "Tamil" },
  { value: "en", label: "English" },
];

const SettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const current = i18n.language || localStorage.getItem("language") || "en";

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

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 max-w-2xl">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Language</label>
            <select
              value={current}
              onChange={(e) => handleChange(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              {LANG_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <p className="text-xs text-slate-500">Select the portal language. The change is saved locally.</p>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
