import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "../hooks/useAppHooks";
import { removeNotification } from "../store/slices/uiSlice";

const AUTO_DISMISS_MS = 1600;

const NotificationContainer = () => {
  const dispatch = useAppDispatch();
  const notifications = useAppSelector((state) => state.ui.notifications);

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
    <div className="fixed inset-x-0 top-3 z-50 flex justify-center px-4">
      <div className="space-y-2 flex flex-col items-center">
        {notifications.map((notif) => (
          <div
            key={notif.id}
            className="inline-flex items-center justify-center rounded-full px-4 py-1.5 text-xs shadow-lg border backdrop-blur-sm bg-slate-900/90 border-slate-700 text-slate-100 max-w-[140px] text-center"
          >
            {notif.message}
          </div>
        ))}
      </div>
    </div>
  );
};

export default NotificationContainer;
