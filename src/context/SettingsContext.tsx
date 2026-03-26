import { createContext, useContext, useState } from "react";

interface Settings {
  token: string | null;
}

const defaults: Settings = {
  token: null,
};

function load(): Settings {
  try {
    return {
      ...defaults,
      ...JSON.parse(localStorage.getItem("settings") ?? "{}"),
    };
  } catch {
    return defaults;
  }
}

function save(settings: Settings) {
  localStorage.setItem("settings", JSON.stringify(settings));
}

const SettingsContext = createContext<{
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
}>({ settings: defaults, updateSettings: () => {} });

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(load);

  const updateSettings = (patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      save(next);
      return next;
    });
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);
