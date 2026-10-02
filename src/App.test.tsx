import { render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { App } from './App';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it('renders the LUMI shell', () => {
  render(<App />);
  expect(screen.getByText('LUMI')).toBeInTheDocument();
});

it('asks the user to open LUMI from Telegram in production without initData', () => {
  vi.stubEnv('PROD', true);
  vi.stubGlobal('window', { Telegram: undefined });
  render(<App />);
  expect(screen.getByText('Откройте LUMI из Telegram')).toBeInTheDocument();
});
