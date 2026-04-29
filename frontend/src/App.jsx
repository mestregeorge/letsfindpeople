import { useEffect, useRef, useState } from "react";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";

import Landing from "./pages/Landing";
import Console from "./pages/Console";
import Admin from "./pages/Admin";

import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";
import { DbDataProvider } from "./context/DbDataContext";
import { AuthProvider } from "./context/AuthContext";

import './App.css';

const policyRoutes = {
  "/privacy": {
    fileName: "privacy",
    title: "Privacy Policy",
  },
  "/terms": {
    fileName: "terms",
    title: "Terms & Conditions",
  },
  "/cookies": {
    fileName: "cookies",
    title: "Cookies Policy",
  },
  "/refunds": {
    fileName: "refunds",
    title: "Refunds Policy",
  },
  "/contact": {
    fileName: "contacts",
    title: "Contact Information",
  },
};

function PolicyModalRoute({ policy }) {
  const navigate = useNavigate();
  const closeButtonRef = useRef(null);
  const [paragraphHtml, setParagraphHtml] = useState("");

  const closeModal = () => {
    navigate("/", { replace: true });
  };

  useEffect(() => {
    fetch(`/policies/${policy.fileName}.html`)
      .then(response => response.text())
      .then(html => setParagraphHtml(html))
      .catch(error => console.error("Error loading policy:", error));
  }, [policy.fileName]);

  useEffect(() => {
    closeButtonRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === "Escape") closeModal();
    };

    document.body.classList.add("modal-open");
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.classList.remove("modal-open");
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <>
      <Landing />
      <div
        className="modal show"
        tabIndex="-1"
        aria-labelledby="routePolicyModalLabel"
        aria-modal="true"
        role="dialog"
        style={{ display: "block" }}
      >
        <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header">
              <h1 className="modal-title fs-5" id="routePolicyModalLabel">
                {policy.title}
              </h1>
              <button
                type="button"
                className="btn-close"
                aria-label="Close"
                onClick={closeModal}
                ref={closeButtonRef}
              ></button>
            </div>
            <div
              className="modal-body"
              dangerouslySetInnerHTML={{ __html: paragraphHtml }}
            ></div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" onClick={closeModal}></div>
    </>
  );
}

function App() {
  const [savedProfile, setSavedProfile] = useState(null);

  return (
    <AuthProvider>
      <DbDataProvider>
        <BrowserRouter>
          <div className="app-wrapper">
            <Navbar onProfileSave={setSavedProfile} />
            <main className="app-content">
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/console" element={<ProtectedRoute><Console currentUser={savedProfile} /></ProtectedRoute>} />
                <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
                <Route path="/privacy" element={<PolicyModalRoute policy={policyRoutes["/privacy"]} />} />
                <Route path="/terms" element={<PolicyModalRoute policy={policyRoutes["/terms"]} />} />
                <Route path="/cookies" element={<PolicyModalRoute policy={policyRoutes["/cookies"]} />} />
                <Route path="/refunds" element={<PolicyModalRoute policy={policyRoutes["/refunds"]} />} />
                <Route path="/contact" element={<PolicyModalRoute policy={policyRoutes["/contact"]} />} />
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
