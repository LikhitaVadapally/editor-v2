import { useCallback, useEffect, useRef } from 'react';
import { useLibraryStore } from '../store/library.store';
import { useEditorStore } from '../store/editor.store';
import { useCopyRegistryStore } from '../store/copyRegistry.store';
import { compositeSearch, DEFAULT_SEARCH_FIELDS } from '../api/content';
import { SKILL_FRAMEWORK_FIELD, asCodes, currentSetSkills, useSetSkills, useSkillFrameworkOptions } from './useSkillFramework';
import type { LibraryFilters } from '../store/library.store';
import type { IContent } from '../types/content';

const PAGE_SIZE = 20;

/**
 * Filters for the questions that teach the set's skills: the set's skill framework, and at least
 * one of its skills under the framework's own field (a list means "any of").
 */
export function buildSetLibraryFilters(
  frameworkId: string, skillField: string, skills: string[],
): Record<string, unknown> {
  return { [SKILL_FRAMEWORK_FIELD]: [frameworkId], [skillField]: skills };
}

/**
 * The "Other questions" list: everything the plain browse found, minus what the matching list
 * already shows and anything that carries one of the set's skills (so paging the matching list
 * can't surface a question twice).
 */
export function selectOtherQuestions(
  others: IContent[], shownIds: Set<string>, frameworkId: string, skillField: string, skills: string[],
): IContent[] {
  const wanted = new Set(skills);
  return others.filter((item) => {
    if (shownIds.has(item.identifier)) return false;
    const meta = item as unknown as Record<string, unknown>;
    if (meta[SKILL_FRAMEWORK_FIELD] !== frameworkId) return true;
    return !asCodes(meta[skillField]).some((code) => wanted.has(code));
  });
}

/**
 * How many "Other questions" there are: the plain browse's count less the matching ones, which the
 * plain browse also finds (it is the same search without the skill filter).
 *
 * Not done server-side: composite search can exclude the skill codes (`{ [skillField]: { '!=': codes } }`),
 * but not "this framework AND these codes" together, and the skill field (`skill`) is shared with
 * curriculum frameworks, so another framework's question carrying the same code would vanish too.
 */
export function otherQuestionsTotal(otherCount: number, matchedCount: number): number {
  return Math.max(0, otherCount - matchedCount);
}

/**
 * Fields each library search asks for: the defaults plus the skill framework and its skill field
 * once the set's framework is known, so rows can show their skills and "Other questions" can drop
 * the matching ones.
 */
export function librarySearchFields(skillField: string | undefined): string[] | undefined {
  return skillField ? [...DEFAULT_SEARCH_FIELDS, SKILL_FRAMEWORK_FIELD, skillField] : undefined;
}

/** The hint above the library: ask for the set's skills when it has none yet and the channel offers frameworks. */
export function setLibraryHint(opts: { ready: boolean; hasFrameworks: boolean }): 'pickSkills' | null {
  return !opts.ready && opts.hasFrameworks ? 'pickSkills' : null;
}

// Module-level, not per-hook-instance — every caller (the LibraryDock panel
// AND imperative refreshes from elsewhere, e.g. after a question is
// created) must share one sequence counter. Two independent counters would
// let a stale response from one caller land after a newer request from the
// other, since neither would recognize the other's requestId as current.
let requestSeq = 0;
// "Other questions" pages on its own; a fresh browse bumps this too so a page still in flight is dropped.
let otherSeq = 0;

function browseFilters(filter: string, advancedFilters: LibraryFilters): Record<string, unknown> {
  const filters: Record<string, unknown> = { status: ['Live'] };
  if (filter && filter !== 'all') filters['primaryCategory'] = [filter];
  if (advancedFilters?.board?.length) filters['board'] = advancedFilters.board;
  if (advancedFilters?.medium?.length) filters['medium'] = advancedFilters.medium;
  if (advancedFilters?.gradeLevel?.length) filters['gradeLevel'] = advancedFilters.gradeLevel;
  if (advancedFilters?.subject?.length) filters['subject'] = advancedFilters.subject;
  return filters;
}

const sortOf = (sortAZ: boolean): Record<string, string> => (sortAZ ? { name: 'asc' } : { lastUpdatedOn: 'desc' });

async function loadLibrary(
  channel: string,
  query = '',
  filter = 'all',
  advancedFilters: LibraryFilters = {},
  reset = true,
  sortAZ = false,
): Promise<void> {
  const requestId = ++requestSeq;
  const state = useLibraryStore.getState();
  if (reset) { otherSeq++; state.setOtherLoading(false); }
  state.setLoading(true);
  try {
    const filters = browseFilters(filter, advancedFilters);

    // With skills on the set, the main list is the questions tagged with them; the rest of the
    // same browse sits below it under "Other questions".
    const set = currentSetSkills();
    const matching = set.ready && set.frameworkId && set.skillField
      ? buildSetLibraryFilters(set.frameworkId, set.skillField, set.skills)
      : undefined;

    const currentOffset = reset ? 0 : state.offset;
    const sortBy = sortOf(sortAZ);
    const [{ content, count }, others] = await Promise.all([
      compositeSearch({
        filters: { ...filters, ...(matching ?? {}) },
        query,
        limit: query ? 50 : PAGE_SIZE,
        offset: currentOffset,
        channel: channel || undefined,
        sortBy,
        fields: librarySearchFields(set.frameworkId ? set.skillField : undefined),
      }),
      // Only on a fresh browse; each list has its own "Load more".
      matching && reset
        ? compositeSearch({
          filters,
          query,
          limit: PAGE_SIZE,
          offset: 0,
          channel: channel || undefined,
          sortBy,
          fields: librarySearchFields(set.skillField),
        })
        : Promise.resolve(undefined),
    ]);

    if (requestId !== requestSeq) return; // stale response — a newer load superseded it
    // Copies (see copyRegistry.store.ts) are visibility:"Default" so their
    // own future edits stay isolated, but they're private to whichever
    // questionset they were copied into — never independently discoverable.
    const { isCopy } = useCopyRegistryStore.getState();
    const filtered = content.filter((item) => !isCopy(item.identifier));
    if (reset) state.setContent(filtered, count, content.length);
    else state.appendContent(filtered, count, content.length);

    if (!matching) state.setOtherContent([]);
    else if (others) {
      const shown = new Set(useLibraryStore.getState().allContent.map((item) => item.identifier));
      state.setOtherContent(
        selectOtherQuestions(
          others.content.filter((item) => !isCopy(item.identifier)),
          shown, set.frameworkId as string, set.skillField as string, set.skills,
        ),
        otherQuestionsTotal(others.count, count),
        others.content.length,
        others.count,
      );
    }
  } catch (e) {
    console.error('[useLibrary] load error:', e);
  } finally {
    if (requestId === requestSeq) useLibraryStore.getState().setLoading(false);
  }
}

/** The next page of "Other questions": the plain browse from where it stopped, minus anything matching. */
async function loadMoreOtherQuestions(channel: string): Promise<void> {
  const state = useLibraryStore.getState();
  const set = currentSetSkills();
  if (state.otherLoading || !set.ready || !set.frameworkId || !set.skillField) return;
  const seq = ++otherSeq;
  state.setOtherLoading(true);
  try {
    const { searchQuery, activeFilter, advancedFilters, sortAZ, otherOffset } = state;
    const { content } = await compositeSearch({
      filters: browseFilters(activeFilter, advancedFilters),
      query: searchQuery,
      limit: PAGE_SIZE,
      offset: otherOffset,
      channel: channel || undefined,
      sortBy: sortOf(sortAZ),
      fields: librarySearchFields(set.skillField),
    });
    if (seq !== otherSeq) return; // a fresh browse replaced the list meanwhile
    const now = useLibraryStore.getState();
    const { isCopy } = useCopyRegistryStore.getState();
    const shown = new Set([...now.allContent, ...now.allOtherContent].map((item) => item.identifier));
    now.appendOtherContent(
      selectOtherQuestions(content.filter((item) => !isCopy(item.identifier)), shown, set.frameworkId, set.skillField, set.skills),
      content.length,
    );
  } catch (e) {
    console.error('[useLibrary] other questions load error:', e);
  } finally {
    if (seq === otherSeq) useLibraryStore.getState().setOtherLoading(false);
  }
}

/**
 * Re-run the library search with whatever query/filter is currently active —
 * e.g. after a new standalone question is created, so it shows up without
 * the user having to re-search manually. Callable from outside a component
 * (not a hook), unlike `useLibrary()`'s `refetch`.
 */
export function refreshLibrary(): void {
  const channel = useEditorStore.getState().editorConfig?.context?.channel ?? '';
  const { searchQuery, activeFilter, advancedFilters, sortAZ } = useLibraryStore.getState();
  void loadLibrary(channel, searchQuery, activeFilter, advancedFilters, true, sortAZ);
}

export function useLibrary() {
  const store = useLibraryStore();
  const channel = useEditorStore((s) => s.editorConfig?.context?.channel ?? '');
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // Clear a pending debounced search on unmount so it can't fire into the
  // global library store after the panel closes.
  useEffect(() => () => clearTimeout(searchTimerRef.current), []);

  const load = useCallback(
    (
      query = '',
      filter = 'all',
      advancedFilters: LibraryFilters = {},
      reset = true,
      sortAZ = false,
    ) => loadLibrary(channel, query, filter, advancedFilters, reset, sortAZ),
    [channel],
  );

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel]);

  // Re-run the current browse when the set's skills change, so the two sections follow them.
  // Skipped on mount: the effect above already loads, and the framework's field arrives later.
  const setSkills = useSetSkills();
  const hasFrameworks = useSkillFrameworkOptions().length > 0;
  // Keyed on the framework and its field too, not only once skills are chosen: rows show their skills
  // as soon as the set's framework is known, which needs the skill field in the search.
  const skillsKey = setSkills.frameworkId && setSkills.skillField
    ? `${setSkills.frameworkId}|${setSkills.skillField}|${setSkills.skills.join(',')}`
    : '';
  const firstSkillsKey = useRef(true);
  useEffect(() => {
    if (firstSkillsKey.current) { firstSkillsKey.current = false; if (!skillsKey) return; }
    load(store.searchQuery, store.activeFilter, store.advancedFilters, true, store.sortAZ);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skillsKey]);

  const search = useCallback(
    (query: string) => {
      store.setSearch(query);
      clearTimeout(searchTimerRef.current);
      searchTimerRef.current = setTimeout(
        () => load(query, store.activeFilter, store.advancedFilters, true, store.sortAZ),
        300,
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store.activeFilter, store.advancedFilters, store.sortAZ, load],
  );

  const setFilter = useCallback(
    (filter: string) => {
      store.setFilter(filter);
      load(store.searchQuery, filter, store.advancedFilters, true, store.sortAZ);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store.searchQuery, store.advancedFilters, store.sortAZ, load],
  );

  const applyAdvancedFilters = useCallback(
    (advancedFilters: LibraryFilters) => {
      store.setAdvancedFilters(advancedFilters);
      load(store.searchQuery, store.activeFilter, advancedFilters, true, store.sortAZ);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store.searchQuery, store.activeFilter, store.sortAZ, load],
  );

  const toggleSort = useCallback(() => {
    const next = !store.sortAZ;
    store.setSortAZ(next);
    load(store.searchQuery, store.activeFilter, store.advancedFilters, true, next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.sortAZ, store.searchQuery, store.activeFilter, store.advancedFilters, load]);

  const loadMore = useCallback(() => {
    if (store.isLoading) return;
    load(store.searchQuery, store.activeFilter, store.advancedFilters, false, store.sortAZ);
  }, [store.isLoading, store.searchQuery, store.activeFilter, store.advancedFilters, store.sortAZ, load]);

  return {
    content: store.filteredContent,
    /** The main list holds the questions tagged with the set's skills. */
    skillMatched: setSkills.ready,
    otherContent: store.otherContent,
    /** All "Other questions", not just the loaded ones. */
    otherTotal: store.otherTotal,
    hasMoreOther: store.otherOffset < store.otherRawTotal,
    otherLoading: store.otherLoading,
    loadMoreOther: () => { void loadMoreOtherQuestions(channel); },
    hint: setLibraryHint({ ready: setSkills.ready, hasFrameworks }),
    isLoading: store.isLoading,
    totalCount: store.totalCount,
    activeFilter: store.activeFilter,
    advancedFilters: store.advancedFilters,
    searchQuery: store.searchQuery,
    sortAZ: store.sortAZ,
    hasMore: store.allContent.length < store.totalCount,
    search,
    setFilter,
    applyAdvancedFilters,
    toggleSort,
    loadMore,
    refetch: () => load(store.searchQuery, store.activeFilter, store.advancedFilters, true, store.sortAZ),
  };
}
