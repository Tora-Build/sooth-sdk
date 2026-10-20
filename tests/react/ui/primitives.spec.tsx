// @vitest-environment jsdom
import React, { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Notice, Segmented, Sheet } from '../../../src/react/ui/primitives.js';

afterEach(cleanup);

function SheetHarness({ onClose }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(true)}>Open trade</button>
      <Sheet
        open={open}
        title="Trade"
        closeLabel="Close"
        onClose={() => {
          onClose?.();
          setOpen(false);
        }}
      >
        <input aria-label="Amount" />
        <button>Review</button>
      </Sheet>
    </div>
  );
}

describe('Sheet', () => {
  it('closes on Escape and returns focus to the opener', () => {
    const onClose = vi.fn();
    render(<SheetHarness onClose={onClose} />);
    const opener = screen.getByRole('button', { name: 'Open trade' });
    opener.focus();
    fireEvent.click(opener);

    const dialog = screen.getByRole('dialog', { name: 'Trade' });
    expect(dialog.contains(document.activeElement)).toBe(true);

    fireEvent.keyDown(screen.getByLabelText('Amount'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('wraps Tab focus inside the sheet', () => {
    render(<SheetHarness />);
    fireEvent.click(screen.getByRole('button', { name: 'Open trade' }));
    const review = screen.getByRole('button', { name: 'Review' });
    review.focus();
    fireEvent.keyDown(review, { key: 'Tab' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close' }));
    fireEvent.keyDown(document.activeElement!, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(review);
  });
});

describe('Segmented', () => {
  function Harness() {
    const [value, setValue] = useState<'a' | 'b' | 'c'>('a');
    return (
      <Segmented
        label="Side"
        value={value}
        onChange={setValue}
        options={[
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B', disabled: true },
          { value: 'c', label: 'C' },
        ]}
      />
    );
  }

  it('moves selection with arrow keys, skipping disabled options, with roving tabindex', () => {
    render(<Harness />);
    const a = screen.getByRole('radio', { name: 'A' });
    const c = screen.getByRole('radio', { name: 'C' });
    expect(a.tabIndex).toBe(0);
    expect(c.tabIndex).toBe(-1);
    a.focus();

    fireEvent.keyDown(a, { key: 'ArrowRight' });
    expect(c.getAttribute('aria-checked')).toBe('true');
    expect(document.activeElement).toBe(c);
    expect(c.tabIndex).toBe(0);

    fireEvent.keyDown(c, { key: 'ArrowRight' });
    expect(a.getAttribute('aria-checked')).toBe('true');

    fireEvent.keyDown(a, { key: 'End' });
    expect(c.getAttribute('aria-checked')).toBe('true');
    fireEvent.keyDown(c, { key: 'Home' });
    expect(a.getAttribute('aria-checked')).toBe('true');
  });
});

describe('Notice', () => {
  it('announces errors assertively and other tones politely', () => {
    render(
      <>
        <Notice tone="error">Failed</Notice>
        <Notice tone="warn">Careful</Notice>
      </>,
    );
    expect(screen.getByRole('alert').textContent).toContain('Failed');
    expect(screen.getByRole('status').textContent).toContain('Careful');
  });
});
