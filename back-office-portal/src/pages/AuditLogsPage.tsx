import React from "react";

const AuditLogsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 mb-1">Audit Logs</h1>
        <p className="text-sm text-slate-500">
          View and monitor important system actions.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
        <p className="text-sm text-slate-500">
          Audit log records will appear here once logging is enabled.
        </p>
      </div>
    </div>
  );
};

export default AuditLogsPage;
