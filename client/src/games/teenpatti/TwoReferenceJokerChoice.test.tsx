// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { TwoReferenceJokerChoice } from './TwoReferenceJokerChoice';

afterEach(() => cleanup());

function renderChoice(onConfirm = vi.fn()) {
  render(
    <TwoReferenceJokerChoice
      reason="SIDESHOW"
      requiredForMe
      requiredPlayerCount={2}
      assignment={null}
      optionA={['4', '6', '9']}
      optionB={['8', '10', '5']}
      onConfirm={onConfirm}
    />,
  );
  return onConfirm;
}

describe('Bug 10 — Two-Reference Joker confirmation', () => {
  it('does not submit when Option A is first selected; it shows the exact jokers and requires confirmation', () => {
    const onConfirm = renderChoice();

    fireEvent.click(screen.getByRole('button', { name: /Option A · Jokers: 4 · 6 · 9/i }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByText('You selected Option A')).toBeTruthy();
    expect(screen.getByText('Jokers: 4 · 6 · 9')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Confirm Option A' })).toBeTruthy();
  });

  it('submits only after the separate confirmation tap', () => {
    const onConfirm = renderChoice();

    fireEvent.click(screen.getByRole('button', { name: /Option B · Jokers: 8 · 10 · 5/i }));
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm Option B' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith(1);
  });

  it('lets the player back out and change the draft before anything reaches the server', () => {
    const onConfirm = renderChoice();

    fireEvent.click(screen.getByRole('button', { name: /Option A · Jokers/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Change choice' }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Option A · Jokers/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Option B · Jokers/i })).toBeTruthy();
  });

  it('shows the locked private joker set after the server acknowledges the assignment', () => {
    const onConfirm = vi.fn();
    render(
      <TwoReferenceJokerChoice
        reason="SHOWDOWN"
        requiredForMe
        requiredPlayerCount={2}
        assignment={{ upDownReferenceIndex: 0 }}
        optionA={['4', '6', '9']}
        optionB={['8', '10', '5']}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByText(/Chosen jokers:/i).textContent).toContain('4 · 6 · 9');
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
