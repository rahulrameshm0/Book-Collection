import { useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";

import { AuthProvider } from "./auth";
import ProtectedRoute from "./components/ProtectedRoute";
import BookPage from "./pages/BookPage";
import HomePage from "./pages/HomePage";
import LibraryPage from "./pages/LibraryPage";
import LoginPage from "./pages/LoginPage";
import ReaderPage from "./pages/ReaderPage";
import RegisterPage from "./pages/RegisterPage";
import ShelfPage from "./pages/ShelfPage";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <AuthProvider>
      <ScrollToTop />
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/library" element={<LibraryPage />} />
        <Route path="/books/:id" element={<BookPage />} />
        <Route path="/books/:id/read/:index" element={<ReaderPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/shelf"
          element={
            <ProtectedRoute>
              <ShelfPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="*"
          element={
            <main className="page empty" id="main">
              <h2>This page is missing.</h2>
              <p>The shelf you were looking for is not here.</p>
              <a className="btn btn--solid" href="/">
                Back to the library
              </a>
            </main>
          }
        />
      </Routes>
    </AuthProvider>
  );
}
