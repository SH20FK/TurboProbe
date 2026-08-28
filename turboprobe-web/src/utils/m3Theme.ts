import { useState, useEffect, useCallback } from 'react';
import {
  argbFromHex,
  hexFromArgb,
  SchemeExpressive,
  SchemeVibrant,
  SchemeTonalSpot,
  Hct,
} from '@material/material-color-utilities';

export interface ThemePreset {
  id: string;
  name: string;
  seed: string;
  schemeType: 'expressive' | 'vibrant' | 'tonalSpot';
  accentColor: string;
}

export const THEME_PRESETS: ThemePreset[] = [
  { id: 'coral', name: 'Pixel Coral', seed: '#FF715B', schemeType: 'expressive', accentColor: '#FF715B' },
  { id: 'mint', name: 'Cyber Mint', seed: '#00E5A3', schemeType: 'vibrant', accentColor: '#00E5A3' },
  { id: 'iris', name: 'Iris Violet', seed: '#7C4DFF', schemeType: 'tonalSpot', accentColor: '#D0BCFF' },
  { id: 'amber', name: 'Solar Amber', seed: '#FFB703', schemeType: 'expressive', accentColor: '#FFB703' },
  { id: 'hazel', name: 'Pixel Hazel', seed: '#839688', schemeType: 'expressive', accentColor: '#A1B5A6' },
  { id: 'cyan', name: 'Electric Cyan', seed: '#00D2FF', schemeType: 'vibrant', accentColor: '#00D2FF' },
];

export function applyM3Theme(seedHex: string, schemeType: 'expressive' | 'vibrant' | 'tonalSpot' = 'expressive', isDark = true) {
  try {
    const argb = argbFromHex(seedHex);
    const hct = Hct.fromInt(argb);

    const scheme =
      schemeType === 'expressive'
        ? new SchemeExpressive(hct, isDark, 0.0)
        : schemeType === 'vibrant'
        ? new SchemeVibrant(hct, isDark, 0.0)
        : new SchemeTonalSpot(hct, isDark, 0.0);

    const root = document.documentElement;

    const tokens: Record<string, string> = {
      '--md-sys-color-primary': hexFromArgb(scheme.primary),
      '--md-sys-color-on-primary': hexFromArgb(scheme.onPrimary),
      '--md-sys-color-primary-container': hexFromArgb(scheme.primaryContainer),
      '--md-sys-color-on-primary-container': hexFromArgb(scheme.onPrimaryContainer),

      '--md-sys-color-secondary': hexFromArgb(scheme.secondary),
      '--md-sys-color-on-secondary': hexFromArgb(scheme.onSecondary),
      '--md-sys-color-secondary-container': hexFromArgb(scheme.secondaryContainer),
      '--md-sys-color-on-secondary-container': hexFromArgb(scheme.onSecondaryContainer),

      '--md-sys-color-tertiary': hexFromArgb(scheme.tertiary),
      '--md-sys-color-on-tertiary': hexFromArgb(scheme.onTertiary),
      '--md-sys-color-tertiary-container': hexFromArgb(scheme.tertiaryContainer),
      '--md-sys-color-on-tertiary-container': hexFromArgb(scheme.onTertiaryContainer),

      '--md-sys-color-surface': hexFromArgb(scheme.surface),
      '--md-sys-color-on-surface': hexFromArgb(scheme.onSurface),
      '--md-sys-color-on-surface-variant': hexFromArgb(scheme.onSurfaceVariant),
      '--md-sys-color-outline': hexFromArgb(scheme.outline),
      '--md-sys-color-outline-variant': hexFromArgb(scheme.outlineVariant),

      '--md-sys-color-surface-container-lowest': isDark ? '#0F0D13' : '#FFFFFF',
      '--md-sys-color-surface-container-low': isDark ? '#1D1B20' : '#F7F2FA',
      '--md-sys-color-surface-container': isDark ? '#211F26' : '#F3EDF7',
      '--md-sys-color-surface-container-high': isDark ? '#2B2930' : '#ECE6F0',
      '--md-sys-color-surface-container-highest': isDark ? '#36343B' : '#E6E0E9',

      '--md-sys-color-inverse-surface': hexFromArgb(scheme.inverseSurface),
      '--md-sys-color-inverse-on-surface': hexFromArgb(scheme.inverseOnSurface),
      '--md-sys-color-inverse-primary': hexFromArgb(scheme.inversePrimary),
    };

    Object.entries(tokens).forEach(([key, val]) => {
      root.style.setProperty(key, val);
    });
  } catch (err) {
    console.error('Failed to apply M3 dynamic theme:', err);
  }
}

export function useDynamicTheme(initialPresetId = 'coral', isDark = true) {
  const [activePresetId, setActivePresetId] = useState<string>(() => {
    return localStorage.getItem('turboprobe_m3_theme') || initialPresetId;
  });

  const activePreset = THEME_PRESETS.find((p) => p.id === activePresetId) || THEME_PRESETS[0];

  const selectPreset = useCallback((presetId: string) => {
    setActivePresetId(presetId);
    localStorage.setItem('turboprobe_m3_theme', presetId);
  }, []);

  useEffect(() => {
    applyM3Theme(activePreset.seed, activePreset.schemeType, isDark);
  }, [activePreset, isDark]);

  return {
    presets: THEME_PRESETS,
    activePreset,
    selectPreset,
  };
}
