import { useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { Provider } from "react-redux";
import { store, type RootState, type AppDispatch } from "./store";
import { useDispatch, useSelector } from "react-redux";
import NotificationContainer from "./components/NotificationContainer";
import RequireAuth from "./components/RequireAuth";
import SessionManager from "./components/SessionManager";
import RegisterPage from "./pages/RegisterPage";
import LoginPage from "./pages/LoginPage";
import PurchaseTicketPage from "./pages/PurchaseTicketPage";
import HistoryPage from "./pages/HistoryPage";
import ProfilePage from "./pages/ProfilePage";
import EditProfilePage from "./pages/EditProfilePage";
import SettingsPage from "./pages/SettingsPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import { setTheme } from "./store/slices/uiSlice";

function App() {
  return (
    <Provider store={store}>
      <ThemeManager>
        <Router>
          <NotificationContainer />
          <SessionManager />
          <Routes>
            {/* Auth Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route
              path="/verify-otp"
              element={<div>OTP Verification Page</div>}
            />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />

            {/* Main Routes - landing is login */}
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route
              path="/tickets/purchase"
              element={
                <RequireAuth>
                  <PurchaseTicketPage />
                </RequireAuth>
              }
            />
            <Route
              path="/tickets/history"
              element={
                <RequireAuth>
                  <HistoryPage />
                </RequireAuth>
              }
            />
            <Route
              path="/profile"
              element={
                <RequireAuth>
                  <ProfilePage />
                </RequireAuth>
              }
            />
            <Route
              path="/profile/edit"
              element={
                <RequireAuth>
                  <EditProfilePage />
                </RequireAuth>
              }
            />
            <Route
              path="/settings"
              element={
                <RequireAuth>
                  <SettingsPage />
                </RequireAuth>
              }
            />

            {/* Catch all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </ThemeManager>
    </Provider>
  );
}

export default App;

const ThemeManager = ({ children }: { children: JSX.Element }) => {
  const dispatch = useDispatch<AppDispatch>();
  const theme = useSelector((state: RootState) => state.ui.theme);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("theme");
    if (stored === "dark" || stored === "light") {
      dispatch(setTheme(stored));
    }
  }, [dispatch]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.classList.toggle("dark", theme === "dark");
    try {
      localStorage.setItem("theme", theme);
    } catch {
      // ignore storage errors
    }
  }, [theme]);

  return children;
};
