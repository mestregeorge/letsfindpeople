import { useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import Landing from "./pages/Landing";
import Console from "./pages/Console";
import Admin from "./pages/Admin";

import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";
import { DbDataProvider } from "./context/DbDataContext";
import { AuthProvider } from "./context/AuthContext";

import './app.css';

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