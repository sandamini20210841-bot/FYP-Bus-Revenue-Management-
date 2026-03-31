import React, { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState, AppDispatch } from "../store";
import { removeNotification } from "../store/slices/alertsSlice";

const AUTO_DISMISS_MS = 2000;

const NotificationContainer: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const notifications = useSelector(
    (state: RootState) => state.alerts.notifications
  );

  useEffect(() => {
    if (!notifications.length) return;

    const timers = notifications.map((notif) =>
      setTimeout(() => {
        dispatch(removeNotification(notif.id));
      }, AUTO_DISMISS_MS)
    );

    return () => {
      timers.forEach((t) => clearTimeout(t));
    };
  }, [notifications, dispatch]);

  if (!notifications.length) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col items-end space-y-2">
      {notifications.map((notif) => {
        const baseClasses =
          "max-w-xs rounded-lg shadow-lg border px-4 py-2 text-xs flex items-start gap-2";
        const colorClasses =
          notif.type === "error"
            ? "bg-red-600 border-red-700 text-white"
            : notif.type === "success"
            ? "bg-emerald-600 border-emerald-700 text-white"
            : "bg-slate-900/90 border-slate-800 text-slate-50";

        return (
          <div key={notif.id} className={`${baseClasses} ${colorClasses}`}>
            <span className="mt-0.5">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                className="h-4 w-4"
                aria-hidden="true"
              >
                <path
                  d="M10 3.5L3.5 16.5H16.5L10 3.5Z"
                  fill="currentColor"
                />
                <path
                  d="M10 8V11.5"
                  stroke="white"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
                <circle cx="10" cy="13.5" r="0.8" fill="white" />
              </svg>
            </span>
            <span className="flex-1 leading-snug">{notif.message}</span>
            <button
              type="button"
              onClick={() => dispatch(removeNotification(notif.id))}
              className="ml-2 text-xs text-white/80 hover:text-white"
              aria-label="Dismiss notification"
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default NotificationContainer;
