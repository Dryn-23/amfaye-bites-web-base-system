import { createContext, useContext, useState, useEffect } from "react";
import { api } from "../services/api";
const Context = createContext();
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (localStorage.getItem("ab-token"))
      api("/auth/me")
        .then(setUser)
        .catch(() => localStorage.removeItem("ab-token"))
        .finally(() => setLoading(false));
    else setLoading(false);
  }, []);
  const authenticate = async (path, body) => {
    const data = await api("/auth/" + path, { method: "POST", body });
    localStorage.setItem("ab-token", data.token);
    setUser(data.user);
    return data.user;
  };
  const logout = async () => {
    try {
      await api("/auth/logout", { method: "POST" });
    } finally {
      localStorage.removeItem("ab-token");
      setUser(null);
    }
  };
  return (
    <Context.Provider value={{ user, setUser, loading, authenticate, logout }}>
      {children}
    </Context.Provider>
  );
}
export const useAuth = () => useContext(Context);
