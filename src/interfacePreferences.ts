import { useState } from 'react';

type Preference = 'motion' | 'haptics';
const fallback: Partial<Record<Preference, boolean>> = {};

export function readInterfacePreference(name: Preference): boolean {
  if (fallback[name] !== undefined) return fallback[name];
  try { return sessionStorage.getItem(`lumi:interface:${name}`) !== 'off'; }
  catch { return fallback[name] ?? true; }
}

export function useInterfacePreference(name: Preference) {
  const [enabled, setEnabled] = useState(() => readInterfacePreference(name));
  function toggle() {
    const next = !enabled;
    try {
      sessionStorage.setItem(`lumi:interface:${name}`, next ? 'on' : 'off');
      delete fallback[name];
    }
    catch { fallback[name] = next; }
    setEnabled(next);
  }
  return [enabled, toggle] as const;
}
