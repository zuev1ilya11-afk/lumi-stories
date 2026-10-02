import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { App } from './App';

it('renders the LUMI shell', () => {
  render(<App production={false} />);
  expect(screen.getByText('LUMI')).toBeInTheDocument();
});

it('asks the user to open LUMI from Telegram in production without initData', () => {
  render(<App production />);
  expect(screen.getByText('Откройте LUMI из Telegram')).toBeInTheDocument();
});
