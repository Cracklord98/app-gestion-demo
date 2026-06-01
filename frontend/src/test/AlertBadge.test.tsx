import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AlertBadge } from '../features/dashboard/AlertBadge';

describe('AlertBadge', () => {
  it('renders "OK" for level "ok"', () => {
    render(<AlertBadge level="ok" />);
    expect(screen.getByText(/OK/i)).toBeInTheDocument();
  });

  it('renders "Superado" for level "exceeded"', () => {
    render(<AlertBadge level="exceeded" />);
    expect(screen.getByText(/Superado/i)).toBeInTheDocument();
  });

  it('renders "Cerca límite" for level "warning"', () => {
    render(<AlertBadge level="warning" />);
    expect(screen.getByText(/Cerca límite/i)).toBeInTheDocument();
  });

  it('applies red background color for exceeded', () => {
    const { container } = render(<AlertBadge level="exceeded" />);
    const span = container.firstChild as HTMLElement;
    // jsdom normalizes hex → rgb
    expect(span.style.background).toMatch(/rgb\(254,\s*226,\s*226\)/);
    expect(span.style.color).toMatch(/rgb\(153,\s*27,\s*27\)/);
  });

  it('applies green background color for ok', () => {
    const { container } = render(<AlertBadge level="ok" />);
    const span = container.firstChild as HTMLElement;
    expect(span.style.background).toMatch(/rgb\(220,\s*252,\s*231\)/);
    expect(span.style.color).toMatch(/rgb\(22,\s*101,\s*52\)/);
  });

  it('applies yellow background color for warning', () => {
    const { container } = render(<AlertBadge level="warning" />);
    const span = container.firstChild as HTMLElement;
    expect(span.style.background).toMatch(/rgb\(254,\s*249,\s*195\)/);
    expect(span.style.color).toMatch(/rgb\(146,\s*64,\s*14\)/);
  });
});
