import type { QueryBuilderConfig } from '@/shared/utils/queryBuilder';

export const ALBUM_SORTABLE_FIELDS = ['sortOrder', 'createdAt', 'title'] as const;
export const ITEM_SORTABLE_FIELDS = ['sortOrder', 'createdAt'] as const;

export const MAX_BULK_ITEMS = 50;

export const albumQueryConfig: QueryBuilderConfig = {
  searchableFields: ['title', 'description'],
  filterableFields: ['status'],
};

export const itemQueryConfig: QueryBuilderConfig = {
  searchableFields: ['title', 'caption', 'altText'],
  filterableFields: {
    album: 'album.slug',
    albumId: 'albumId',
    serviceId: 'serviceId',
    mediaType: 'mediaType',
    isFeatured: 'isFeatured',
    status: 'status',
  },
};

/** Items of the public site: active, and not inside an inactive album */
export const PUBLIC_ITEM_WHERE = {
  status: 'active',
  OR: [{ albumId: null }, { album: { status: 'active' } }],
} as const;

export const albumInclude = (activeItemsOnly: boolean) =>
  ({
    _count: {
      select: { items: activeItemsOnly ? { where: { status: 'active' as const } } : true },
    },
    // fallback cover when no cover image was set
    items: {
      where: { mediaType: 'image' as const, ...(activeItemsOnly && { status: 'active' as const }) },
      orderBy: { sortOrder: 'asc' as const },
      take: 1,
      select: { fileUrl: true },
    },
  }) as const;

export const itemInclude = {
  album: { select: { id: true, title: true, slug: true } },
  service: { select: { id: true, name: true, slug: true } },
} as const;
