import { describe, it, expect, beforeEach } from 'vitest';
import { useLibraryStore } from './library.store';
import type { IContent } from '../types/content';

const q = (id: string) => ({ identifier: id, name: id }) as IContent;

describe('library store: "Other questions" paging', () => {
  beforeEach(() => useLibraryStore.getState().clearOtherContent());

  it('keeps the real total and pages on from where the browse stopped (positive)', () => {
    const s = useLibraryStore.getState();
    // First page: 20 searched, 19 left after dropping a match; 339 others in all out of 341.
    s.setOtherContent({ content: Array.from({ length: 19 }, (_, i) => q(`a${i}`)), total: 339, rawCount: 20, rawTotal: 341 });
    s.appendOtherContent([q('b1'), q('b2')], 20);
    const now = useLibraryStore.getState();
    expect(now.otherTotal).toBe(339);
    expect(now.otherOffset).toBe(40);
    expect(now.otherContent).toHaveLength(21);
  });

  it('clears the list and its counts (negative)', () => {
    const s = useLibraryStore.getState();
    s.setOtherContent({ content: [q('a')], total: 1, rawCount: 3, rawTotal: 3 });
    s.clearOtherContent();
    expect(useLibraryStore.getState()).toMatchObject({ otherTotal: 0, otherOffset: 0, otherRawTotal: 0, otherContent: [] });
  });
});
