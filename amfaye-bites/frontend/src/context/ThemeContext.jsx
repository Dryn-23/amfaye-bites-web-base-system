import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
} from "react";

const ThemeContext = createContext(null);
const KEY = "ab-theme";
const choices = ["light", "dark", "system"];
const valid = (value) => (choices.includes(value) ? value : "light");
const systemDark = () =>
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-color-scheme: dark)").matches;
function storedPreference() {
  try {
    return valid(localStorage.getItem(KEY));
  } catch {
    return "light";
  }
}
function applyTheme(theme, preference) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.dataset.themePreference = preference;
  root.style.colorScheme = theme;
  if (theme === "dark") root.style.backgroundColor = "#191612";
  else root.style.removeProperty("background-color");
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.dataset.lightColor ||= meta.content;
    meta.content = theme === "dark" ? "#191612" : meta.dataset.lightColor;
  }
}

export function ThemeProvider({ children }) {
  const [preference, setPreference] = useState(storedPreference);
  const [osDark, setOsDark] = useState(systemDark);
  const [storageError, setStorageError] = useState(false);
  const theme =
    preference === "system" ? (osDark ? "dark" : "light") : preference;
  useLayoutEffect(() => {
    applyTheme(theme, preference);
  }, [theme, preference]);
  useEffect(() => {
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    const onSystem = () => setOsDark(Boolean(media?.matches));
    const onStorage = (event) => {
      if (event.key === KEY || event.key === null) {
        setPreference(storedPreference());
        setStorageError(false);
      }
    };
    media?.addEventListener("change", onSystem);
    window.addEventListener("storage", onStorage);
    return () => {
      media?.removeEventListener("change", onSystem);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  function selectPreference(value) {
    const next = valid(value);
    setPreference(next);
    try {
      localStorage.setItem(KEY, next);
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }
  return (
    <ThemeContext.Provider
      value={{ preference, theme, selectPreference, storageError }}
    >
      {children}
    </ThemeContext.Provider>
  );
}
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside ThemeProvider");
  return context;
}
