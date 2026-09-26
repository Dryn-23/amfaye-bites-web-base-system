import { useId } from "react";
import { Sun, Moon, Monitor, Check } from "lucide-react";
import { useTheme } from "../context/ThemeContext";
const options = [
  {
    value: "light",
    label: "Light",
    text: "Your original warm bakery colors.",
    Icon: Sun,
  },
  {
    value: "dark",
    label: "Dark",
    text: "Warm dark surfaces and caramel accents.",
    Icon: Moon,
  },
  {
    value: "system",
    label: "System",
    text: "Follow your device's appearance.",
    Icon: Monitor,
  },
];
export default function AppearanceSettings() {
  const { preference, theme, selectPreference, storageError } = useTheme();
  const id = useId();
  return (
    <section className="panel appearance-settings" aria-labelledby={id}>
      <div className="appearance-heading">
        <div>
          <span className="eyebrow">MAKE YOURSELF COMFORTABLE</span>
          <h3 id={id}>Appearance</h3>
        </div>
        <span className="appearance-current">
          {theme === "dark" ? <Moon size={15} /> : <Sun size={15} />}
          {theme === "dark" ? "Dark mode" : "Light mode"}
        </span>
      </div>
      <p>
        Choose how Amfaye Bites looks on this browser. Changes apply immediately
        across the storefront and staff portal.
      </p>
      <fieldset className="appearance-options">
        <legend className="appearance-sr-only">Color theme</legend>
        {options.map(({ value, label, text, Icon }) => (
          <label
            key={value}
            className={`appearance-option ${preference === value ? "is-selected" : ""}`}
          >
            <input
              type="radio"
              name={`theme-${id}`}
              value={value}
              checked={preference === value}
              onChange={() => selectPreference(value)}
            />
            <span
              className={`appearance-preview preview-${value}`}
              aria-hidden="true"
            >
              <span className="appearance-mini-sidebar" />
              <span className="appearance-mini-content">
                <i />
                <span>
                  <i />
                  <i />
                </span>
              </span>
            </span>
            <span className="appearance-option-label">
              <Icon size={17} />
              {label}
              {preference === value && (
                <Check size={15} className="appearance-check" />
              )}
            </span>
            <span className="appearance-option-description">{text}</span>
          </label>
        ))}
      </fieldset>
      <p className="appearance-save-note" role="status">
        {storageError
          ? "Applied for this visit. Browser storage is unavailable, so this choice may not survive a reload."
          : "Saved automatically on this browser. This changes your view only, not other users' screens."}
      </p>
    </section>
  );
}
