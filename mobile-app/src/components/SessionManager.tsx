import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../hooks/useAppHooks";
import { logout } from "../store/slices/authSlice";

const INACTIVITY_LIMIT_MS = 30 * 60 * 1000; // 30 minutes

const SessionManager = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const storedLast = window.localStorage.getItem("lastActivity");
    const now = Date.now();
    if (storedLast) {
      const diff = now - Number(storedLast);
      if (diff > INACTIVITY_LIMIT_MS) {
        dispatch(logout());
        window.localStorage.removeItem("authToken");
        window.localStorage.removeItem("refreshToken");
        window.localStorage.removeItem("authUser");
        window.localStorage.removeItem("lastActivity");
        navigate("/login", { replace: true });
        return;
      }
    }

    let timeoutId: number;

    const resetTimer = () => {
      window.localStorage.setItem("lastActivity", Date.now().toString());
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      timeoutId = window.setTimeout(() => {
        dispatch(logout());
        window.localStorage.removeItem("authToken");
        window.localStorage.removeItem("refreshToken");
        window.localStorage.removeItem("authUser");
        window.localStorage.removeItem("lastActivity");
        navigate("/login", { replace: true });
      }, INACTIVITY_LIMIT_MS);
    };

    const events: Array<keyof WindowEventMap> = [
      "click",
      "keydown",
      "touchstart",
      "mousemove",
    ];

    events.forEach((event) => window.addEventListener(event, resetTimer));
    resetTimer();

    return () => {
      events.forEach((event) => window.removeEventListener(event, resetTimer));
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [isAuthenticated, dispatch, navigate]);

  return null;
};

export default SessionManager;
