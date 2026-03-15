import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { Provider } from "react-redux";
import { store } from "./store";
import NotificationContainer from "./components/NotificationContainer";
import RequireAuth from "./components/RequireAuth";
import SessionManager from "./components/SessionManager";
import RegisterPage from "./pages/RegisterPage";
import LoginPage from "./pages/LoginPage";
import PurchaseTicketPage from "./pages/PurchaseTicketPage";
import ProfilePage from "./pages/ProfilePage";
import EditProfilePage from "./pages/EditProfilePage";
import SettingsPage from "./pages/SettingsPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";

function App() {
  return (
    <Provider store={store}>
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
                <div>Ticket History Page</div>
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
    </Provider>
  );
}

export default App;
