import { getCollection, type CollectionEntry } from "astro:content";
import { tagSlug } from "@lib/utils";

/** Anything tagged: posts and projects share one taxonomy. */
export type TaggedEntry =
  | CollectionEntry<"blog">
  | CollectionEntry<"projects">;

export type TagGroup = {
  slug: string;
  /** Display form, taken from the first entry that used the tag. */
  label: string;
  entries: TaggedEntry[];
};

const byNewest = (a: TaggedEntry, b: TaggedEntry) =>
  b.data.date.valueOf() - a.data.date.valueOf();

/**
 * Every published post and project, newest first. Drafts are excluded here so
 * no page has to remember to filter them.
 */
export async function getTaggedEntries(): Promise<TaggedEntry[]> {
  const [posts, projects] = await Promise.all([
    getCollection("blog", ({ data }) => !data.draft),
    getCollection("projects", ({ data }) => !data.draft),
  ]);

  return [...posts, ...projects].sort(byNewest);
}

/**
 * Group entries by tag slug, so "ML" and "ml" resolve to one page. Sorted by
 * how much is filed under each tag — the index reads as a map of what the site
 * is actually about, rather than as an alphabet.
 */
export async function getTagGroups(): Promise<TagGroup[]> {
  const entries = await getTaggedEntries();
  const groups = new Map<string, TagGroup>();

  for (const entry of entries) {
    for (const tag of entry.data.tags ?? []) {
      const slug = tagSlug(tag);
      if (!slug) continue;

      const group = groups.get(slug) ?? { slug, label: tag, entries: [] };
      group.entries.push(entry);
      groups.set(slug, group);
    }
  }

  return [...groups.values()].sort(
    (a, b) =>
      b.entries.length - a.entries.length || a.label.localeCompare(b.label),
  );
}
