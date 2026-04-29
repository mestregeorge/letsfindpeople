import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";

import Landing from "./pages/Landing";
import Console from "./pages/Console";
import Admin from "./pages/Admin";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import Cookies from "./pages/Cookies";
import Refunds from "./pages/Refunds";
import Contact from "./pages/Contact";
import ErrorPage from "./pages/ErrorPage";

import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";
import { DbDataProvider } from "./context/DbDataContext";
import { AuthProvider, useAuth } from "./context/AuthContext";

import './App.css';

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, [pathname]);

  return null;
}

function AuthRedirectHandler() {
  const { session, isLoading, isAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const hasAuthHash = window.location.hash.includes("access_token=");
    const isAuthCallback = location.pathname === "/auth/callback" || hasAuthHash;

    if (!isAuthCallback || isLoading || !session) return;

    navigate(isAdmin ? "/admin" : "/console", { replace: true });
  }, [isAdmin, isLoading, location.pathname, navigate, session]);

  return null;
}

function AuthCallback() {
  return (
    <div className="d-flex justify-content-center align-items-center" style={{ minHeight: "60vh" }}>
      <div className="spinner-border spinner-primary" role="status">
        <span className="visually-hidden">Loading...</span>
      </div>
    </div>
  );
}

function App() {
  const [savedProfile, setSavedProfile] = useState(null);

  return (
    <AuthProvider>
      <DbDataProvider>
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <ScrollToTop />
          <AuthRedirectHandler />
          <div className="app-wrapper">
            <Navbar onProfileSave={setSavedProfile} />
            <main className="app-content">
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route path="/console" element={<ProtectedRoute><Console currentUser={savedProfile} /></ProtectedRoute>} />
                <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/cookies" element={<Cookies />} />
                <Route path="/refunds" element={<Refunds />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="*" element={<ErrorPage type="notFound" />} />
              </Routes>
            </main>
            <Footer />
          </div>
        </BrowserRouter>
      </DbDataProvider>
    </AuthProvider>
  );
}

export default App;
