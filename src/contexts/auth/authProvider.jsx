import { useState } from "react";
import { AuthContext } from "./authContext";

export default function AuthProvider({ children }) {
  const [user, setUser] = useState({});
  const [token, _setToken] = useState(localStorage.getItem("ACCESS_TOKEN"));
  const [role, _setRole] = useState(localStorage.getItem("ROLE") || "guest"); // guest , user , admin , company

  const setToken = (token) => {
    _setToken(token);
    if (token) {
      localStorage.setItem("ACCESS_TOKEN", token);
    } else {
      localStorage.removeItem("ACCESS_TOKEN");
    }
  };

  const setRole = (role) => {
    _setRole(role);
    if (role) {
      localStorage.setItem("ROLE", role);
    } else {
      localStorage.removeItem("ROLE");
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, setUser, token, setToken, role, setRole }}
    >
      {children}
    </AuthContext.Provider>
  );
}
