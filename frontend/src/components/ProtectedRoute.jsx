import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "../auth";

export default function ProtectedRoute({ children }) {
  const { user, ready } = useAuth();
  const location = useLocation();

  if (!ready) {
    return (
      <div className="page-loading">
        <span className="loader" aria-hidden="true" />
        <p>Opening the library…</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
