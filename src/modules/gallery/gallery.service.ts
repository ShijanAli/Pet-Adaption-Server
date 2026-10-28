import { prisma } from '@/lib/prisma';
import { AppError } from '@/shared/errors/AppError';
import { createCrudService } from '@/shared/crud/crud.factory';
import { assertIdsExist } from '@/shared/utils/db';
import { whereIdOrSlug } from '@/shared/utils/validation';
import {
  albumInclude,
  albumQueryConfig,
  itemInclude,
  itemQueryConfig,
  PUBLIC_ITEM_WHERE,
} from './gallery.constant';
import type {
  AlbumListQuery,
  BulkCreateInput,
  CreateItemInput,
  ItemListQuery,
  UpdateItemInput,
} from './gallery.validation';

/* ───────────────────────── albums ───────────────────────── */

const albums = createCrudService({
  delegate: () => prisma.galleryAlbum,
  entityName: 'Album',
  slugFrom: 'title',
  queryConfig: albumQueryConfig,
});

type AlbumRow = {
  coverImage: string | null;
  items: { fileUrl: string }[];
  _count: { items: number };
};

/** `cover` = coverImage, or the first image of the album */
const albumDto = <T extends AlbumRow>({ items, _count, ...album }: T) => ({
  ...album,
  cover: album.coverImage ?? items[0]?.fileUrl ?? null,
  itemCount: _count.items,
});

export const AlbumService = {
  async getAll(query: AlbumListQuery, canManage: boolean) {
    const { data, meta } = await albums.getAll(canManage ? query : { ...query, status: 'active' });
    // include depends on the caller, so it is loaded in a second step
    const ids = (data as { id: number }[]).map((a) => a.id);
    const rows = await prisma.galleryAlbum.findMany({
      where: { id: { in: ids } },
      include: albumInclude(!canManage),
    });
    const byId = new Map(rows.map((r) => [r.id, albumDto(r)]));
    return { data: ids.map((id) => byId.get(id)!), meta };
  },

  async getByIdOrSlug(idOrSlug: string, canManage: boolean) {
    const album = await prisma.galleryAlbum.findFirst({
      where: { ...whereIdOrSlug(idOrSlug), ...(!canManage && { status: 'active' as const }) },
      include: albumInclude(!canManage),
    });
    if (!album) throw AppError.notFound('Album');
    return albumDto(album);
  },

  create: albums.create,

  update: albums.update,

  /** Items stay in the gallery without an album (album_id → null) */
  remove: albums.remove,
};

/* ───────────────────────── items ───────────────────────── */

const items = createCrudService({
  delegate: () => prisma.galleryItem,
  entityName: 'Gallery item',
  queryConfig: itemQueryConfig,
  include: itemInclude,
});

const assertTargets = async (albumId?: number | null, serviceId?: number | null) => {
  await Promise.all([
    albumId ? assertIdsExist(prisma.galleryAlbum, [albumId], 'album') : undefined,
    serviceId ? assertIdsExist(prisma.service, [serviceId], 'service') : undefined,
  ]);
};

export const GalleryItemService = {
  getAll(query: ItemListQuery, canManage: boolean) {
    return canManage
      ? items.getAll(query)
      : items.getAll({ ...query, status: undefined }, PUBLIC_ITEM_WHERE);
  },

  getById: (id: number, canManage: boolean) =>
    items.getOne({ id, ...(!canManage && PUBLIC_ITEM_WHERE) }),

  async create(actorId: number, input: CreateItemInput) {
    await assertTargets(input.albumId, input.serviceId);
    return items.create({ ...input, uploadedById: actorId });
  },

  /** Many images at once (after POST /uploads/images) */
  async bulkCreate(actorId: number, { albumId, serviceId, items: rows }: BulkCreateInput) {
    await assertTargets(albumId, serviceId);
    const last = albumId
      ? await prisma.galleryItem.aggregate({ where: { albumId }, _max: { sortOrder: true } })
      : null;
    const start = (last?._max.sortOrder ?? -1) + 1;

    await prisma.galleryItem.createMany({
      data: rows.map((row, i) => ({
        ...row,
        albumId,
        serviceId,
        mediaType: 'image' as const,
        sortOrder: start + i,
        uploadedById: actorId,
      })),
    });
    return { created: rows.length };
  },

  async update(id: number, input: UpdateItemInput) {
    const existing = await prisma.galleryItem.findUnique({ where: { id } });
    if (!existing) throw AppError.notFound('Gallery item');
    if (
      (input.mediaType ?? existing.mediaType) === 'video' &&
      (input.beforeImageUrl ?? existing.beforeImageUrl)
    ) {
      throw AppError.unprocessable('Before/after is only supported for images', [
        { path: 'beforeImageUrl', message: 'Only for images' },
      ]);
    }
    await assertTargets(input.albumId, input.serviceId);
    return items.update(id, input);
  },

  remove: items.remove,

  /** Drag & drop ordering from the admin panel */
  async reorder(rows: { id: number; sortOrder: number }[]) {
    const ids = [...new Set(rows.map((r) => r.id))];
    await assertIdsExist(prisma.galleryItem, ids, 'gallery item');
    await prisma.$transaction(
      rows.map((r) =>
        prisma.galleryItem.update({ where: { id: r.id }, data: { sortOrder: r.sortOrder } }),
      ),
    );
    return { updated: rows.length };
  },
};
