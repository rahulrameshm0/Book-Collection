import { Route, Routes } from "react-router-dom";

import ProtectedRoute from "./components/ProtectedRoute";
import LibraryPage from "./pages/LibraryPage";
import LoginPage from "./pages/LoginPage";
import ReaderPage from "./pages/ReaderPage";
import RegisterPage from "./pages/RegisterPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LibraryPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/books/:slug"
        element={
          <ProtectedRoute>
            <ReaderPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="*"
        element={
          <main className="page-message">
            <h1>This page is missing.</h1>
            <p>The shelf you were looking for is not here.</p>
            <a className="button button--solid" href="/">
              Back to the library
            </a>
          </main>
        }
      />
    </Routes>
  );
}
