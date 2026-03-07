import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { Provider } from "react-redux";
import { store } from "./store";

function App() {
  return (
    <Provider store={store}>
      <Router>
        <Routes>
          {/* Auth Routes - TODO: Create these pages */}
          <Route path="/login" element={<div>Login Page</div>} />
          <Route path="/register" element={<div>Register Page</div>} />
          <Route
            path="/verify-otp"
            element={<div>OTP Verification Page</div>}
          />

          {/* Main Routes - TODO: Create these pages */}
          <Route path="/" element={<div>Home Page</div>} />
          <Route
            path="/tickets/purchase"
            element={<div>Purchase Ticket Page</div>}
          />
          <Route
            path="/tickets/history"
            element={<div>Ticket History Page</div>}
          />
          <Route path="/profile" element={<div>Profile Page</div>} />
          <Route path="/profile/edit" element={<div>Edit Profile Page</div>} />
          <Route path="/settings" element={<div>Settings Page</div>} />

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </Provider>
  );
}

export default App;
