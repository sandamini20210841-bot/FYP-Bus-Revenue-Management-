import React, { useEffect, useRef, useState } from "react";

type DiscrepancyStatus = "pending" | "investigating" | "escalated" | "resolved";
type DiscrepancySeverity = "low" | "medium" | "high" | "critical";

const statusOptions: { label: string; value: DiscrepancyStatus | "all" }[] = [
  { label: "All Statuses", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Investigating", value: "investigating" },
  { label: "Escalated", value: "escalated" },
  { label: "Resolved", value: "resolved" },
];

const severityOptions: { label: string; value: DiscrepancySeverity | "all" }[] = [
  { label: "All Severities", value: "all" },
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" },
  { label: "Critical", value: "critical" },
];

const DiscrepanciesPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<DiscrepancyStatus | "all">("all");
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<DiscrepancySeverity | "all">("all");
  const [isSeverityOpen, setIsSeverityOpen] = useState(false);

  const statusDropdownRef = useRef<HTMLDivElement | null>(null);
  const severityDropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isStatusOpen && !isSeverityOpen) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;

      if (
        isStatusOpen &&
        statusDropdownRef.current &&
        !statusDropdownRef.current.contains(target)
      ) {
        setIsStatusOpen(false);
      }

      if (
        isSeverityOpen &&
        severityDropdownRef.current &&
        !severityDropdownRef.current.contains(target)
      ) {
        setIsSeverityOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isStatusOpen, isSeverityOpen]);

  const totalCount = 0;
  const shownCount = 0;
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 mb-1">
          Discrepancies
        </h1>
        <p className="text-sm text-slate-500">
          Manage and track revenue discrepancies
        </p>
      </div>

      {/* Filters + Export */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex-1 flex flex-col gap-3 md:flex-row md:items-start">
          {/* Search */}
          <div className="flex-1 min-w-[220px]">
            <p className="text-[11px] font-semibold text-slate-600 mb-1">Search</p>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
                <img
                  src="/images/search.png"
                  alt="Search"
                  className="h-4 w-4 object-contain opacity-60"
                />
              </span>
              <input
                type="text"
                placeholder="Search by ID, route, bus, or driver..."
                className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Status filter (custom dropdown with rounded menu) */}
          <div className="min-w-[160px]" ref={statusDropdownRef}>
            <p className="text-[11px] font-semibold text-slate-600 mb-1">Status</p>
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsStatusOpen((open) => !open)}
                className="w-full inline-flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:outline-none transition-colors duration-150 ease-out focus:border-blue-500 focus:bg-blue-50/40"
              >
                <span>
                  {statusOptions.find((o) => o.value === statusFilter)?.label ||
                    "All Statuses"}
                </span>
                <span className="text-slate-400 flex items-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    className="h-3.5 w-3.5"
                    aria-hidden="true"
                  >
                    <path
                      d="M5 8l5 5 5-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              </button>

              {isStatusOpen && (
                <div className="absolute z-10 mt-1 left-0 right-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
                  {statusOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setStatusFilter(option.value as DiscrepancyStatus | "all");
                        setIsStatusOpen(false);
                      }}
                      className={`w-full px-3 py-1.5 text-left text-xs transition-colors duration-100 ${
                        statusFilter === option.value
                          ? "bg-blue-50 text-blue-700"
                          : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Severity filter (custom dropdown matching status) */}
          <div className="min-w-[160px]" ref={severityDropdownRef}>
            <p className="text-[11px] font-semibold text-slate-600 mb-1">Severity</p>
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsSeverityOpen((open) => !open)}
                className="w-full inline-flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:outline-none transition-colors duration-150 ease-out focus:border-blue-500 focus:bg-blue-50/40"
              >
                <span>
                  {severityOptions.find((o) => o.value === severityFilter)?.label ||
                    "All Severities"}
                </span>
                <span className="text-slate-400 flex items-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    className="h-3.5 w-3.5"
                    aria-hidden="true"
                  >
                    <path
                      d="M5 8l5 5 5-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              </button>

              {isSeverityOpen && (
                <div className="absolute z-10 mt-1 left-0 right-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
                  {severityOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setSeverityFilter(option.value as DiscrepancySeverity | "all");
                        setIsSeverityOpen(false);
                      }}
                      className={`w-full px-3 py-1.5 text-left text-xs transition-colors duration-100 ${
                        severityFilter === option.value
                          ? "bg-blue-50 text-blue-700"
                          : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Export button */}
        <div className="flex flex-col items-start">
          {/* spacer to align with label row without showing a title */}
          <div className="mb-1 h-[14px]" />
          <button
            type="button"
            disabled
            className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs font-medium text-white shadow-sm opacity-60 cursor-not-allowed"
          >
            <span className="flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                className="h-4 w-4"
                aria-hidden="true"
              >
                <path
                  d="M10 3v8m0 0l-3-3m3 3l3-3M4 14h12v3H4z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span>Export Report</span>
          </button>
        </div>
      </div>

      {/* List header */}
      <p className="text-xs text-slate-500">
        Showing {shownCount} of {totalCount} discrepancies
      </p>

      {/* Discrepancy list */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="px-6 py-8 text-center text-sm text-slate-400">
          No discrepancies to display yet.
        </div>
      </div>
    </div>
  );
};

export default DiscrepanciesPage;
