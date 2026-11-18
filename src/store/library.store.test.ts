import { describe, it, expect, beforeEach } from 'vitest';
import { useLibraryStore } from './library.store';
import type { IContent } from '../types/content';

const q = (id: string) => ({ identifier: id, name: id }) as IContent;

describe('library store: "Other questions" paging', () => {
  beforeEach(() => useLibraryStore.getState().setOtherContent([]));

  it('keeps the real total and pages on from where the browse stopped (positive)', () => {
    const s = useLibraryStore.getState();
    // First page: 20 searched, 19 left after dropping a match; 339 others in all out of 341.
    s.setOtherContent(Array.from({ length: 19 }, (_, i) => q(`a${i}`)), 339, 20, 341);
    s.appendOtherContent([q('b1'), q('b2')], 20);
    const now = useLibraryStore.getState();
    expect(now.otherTotal).toBe(339);
    expect(now.otherOffset).toBe(40);
    expect(now.otherContent).toHaveLength(21);
    expect(now.otherOffset < now.otherRawTotal).toBe(true);
  });

  it('has nothing more to load once the browse is exhausted, and clears to zero (negative)', () => {
    const s = useLibraryStore.getState();
    s.setOtherContent([q('a')], 1, 3, 3);
    expect(useLibraryStore.getState().otherOffset < useLibraryStore.getState().otherRawTotal).toBe(false);
    s.setOtherContent([]);
    expect(useLibraryStore.getState()).toMatchObject({ otherTotal: 0, otherOffset: 0, otherRawTotal: 0, otherContent: [] });
  });
});
