/**
 * @typedef {"light" | "dark"} Theme
 * @typedef {{ theme: Theme, cause: null }} ThemeRead
 * @typedef {{ theme: "light", cause: unknown }} ThemeReadFailure
 * @typedef {{ saved: true }} ThemeSave
 * @typedef {{ saved: false, cause: unknown }} ThemeSaveFailure
 */

/**
 * Light is the default. Dark is the black-and-teal scheme.
 * @param {string | null | undefined} stored
 * @returns {Theme}
 */
export function resolveTheme(stored) {
  return stored === "dark" ? "dark" : "light";
}

const STORAGE_KEY = "aum-theme";

/**
 * @returns {ThemeRead | ThemeReadFailure}
 */
function readStoredTheme() {
  try {
    return { theme: resolveTheme(localStorage.getItem(STORAGE_KEY)), cause: null };
  } catch (error) {
    console.error("theme preference unreadable", error);
    return { theme: "light", cause: error };
  }
}

/**
 * @param {Theme} theme
 * @returns {ThemeSave | ThemeSaveFailure}
 */
function storeTheme(theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
    return { saved: true };
  } catch (error) {
    console.error("theme preference unsaved", { theme, error });
    return { saved: false, cause: error };
  }
}

/**
 * @param {Theme} theme
 */
function applyTheme(theme) {
  if (theme === "dark") document.documentElement.setAttribute("data-theme", "dark");
  else document.documentElement.removeAttribute("data-theme");

  document.querySelectorAll("[data-theme-choice]").forEach((node) => {
    if (!(node instanceof HTMLButtonElement)) return;
    const selected = node.dataset.themeChoice === theme;
    node.setAttribute("aria-pressed", selected ? "true" : "false");
  });
}

function bootTheme() {
  applyTheme(readStoredTheme().theme);
  document.querySelectorAll("[data-theme-choice]").forEach((node) => {
    if (!(node instanceof HTMLButtonElement)) return;
    node.addEventListener("click", () => {
      const theme = resolveTheme(node.dataset.themeChoice);
      applyTheme(theme);
      storeTheme(theme);
    });
  });
}

if (typeof document !== "undefined") bootTheme();
