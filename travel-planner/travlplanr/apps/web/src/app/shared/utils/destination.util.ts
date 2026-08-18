export interface DestinationListItem {
  id?: string;
  name: string;
  description?: string;
  image?: string;
  price?: number;
  region?: string;
  country?: string;
  tags?: string[];
  /** Google Places place_id when suggestion came from Places Autocomplete. */
  placeId?: string;
  lat?: number;
  lng?: number;
  source?: string;
}

/** Collapse duplicate API rows that share the same destination name. */
export function dedupeDestinationsByName<T extends DestinationListItem>(destinations: T[]): T[] {
  const grouped = new Map<string, T[]>();

  for (const dest of destinations) {
    const key = dest.name.trim().toLowerCase();
    const bucket = grouped.get(key);
    if (bucket) {
      bucket.push(dest);
    } else {
      grouped.set(key, [dest]);
    }
  }

  const merged: T[] = [];
  for (const items of grouped.values()) {
    if (items.length === 1) {
      merged.push(items[0]);
      continue;
    }

    const base = { ...items[0] };
    const tags = new Set<string>();
    let description = base.description || '';
    let image = base.image || '';
    let price = base.price || 0;

    for (const item of items) {
      for (const tag of item.tags || []) {
        tags.add(tag);
      }
      const desc = (item.description || '').trim();
      if (desc.length > description.length) {
        description = desc;
      }
      const img = item.image || '';
      if (img && (!image || img.toLowerCase().includes('rated'))) {
        image = img;
      }
      price = Math.max(price, item.price || 0);
    }

    merged.push({
      ...base,
      tags: [...tags].sort(),
      description,
      image,
      price,
    });
  }

  return merged.sort((a, b) => a.name.localeCompare(b.name));
}
