import { z } from 'zod';
import { listQuerySchema } from '@/shared/utils/queryBuilder';
import {
  activeStatusSchema,
  booleanQuery,
  nonEmpty,
  slugSchema,
  urlSchema,
} from '@/shared/utils/validation';
import { ALBUM_SORTABLE_FIELDS, ITEM_SORTABLE_FIELDS, MAX_BULK_ITEMS } from './gallery.constant';

const albumFields = {
  title: z.string().trim().min(2).max(150),
  slug: slugSchema.optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  coverImage: urlSchema.nullable().optional(),
  sortOrder: z.number().int().min(0).max(100_000).optional(),
  status: activeStatusSchema,
};

const mediaType = z.enum(['image', 'video']);

const itemFields = {
  albumId: z.number().int().positive().nullable().optional(),
  serviceId: z.number().int().positive().nullable().optional(),
  title: z.string().trim().max(150).nullable().optional(),
  caption: z.string().trim().max(2000).nullable().optional(),
  mediaType,
  fileUrl: urlSchema.describe('Image URL from /uploads, or a video URL (YouTube / Cloudinary)'),
  thumbnailUrl: urlSchema.nullable().optional(),
  beforeImageUrl: urlSchema.nullable().optional().describe('Before/after photos (grooming)'),
  altText: z.string().trim().max(255).nullable().optional(),
  isFeatured: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(100_000).optional(),
  status: activeStatusSchema,
};

const beforeOnlyForImages = (v: { mediaType?: string; beforeImageUrl?: string | null }) =>
  !(v.mediaType === 'video' && v.beforeImageUrl);
const beforeRule = {
  path: ['beforeImageUrl'],
  message: 'Before/after is only supported for images',
};

export const GalleryValidation = {
  albumListQuery: listQuerySchema(
    ALBUM_SORTABLE_FIELDS,
    { status: activeStatusSchema.optional().describe('Admins only') },
    { sortBy: 'sortOrder', sortOrder: 'asc' },
  ),

  createAlbum: z.object({ ...albumFields, status: albumFields.status.default('active') }),

  updateAlbum: nonEmpty(z.object(albumFields).partial().strict()),

  itemListQuery: listQuerySchema(
    ITEM_SORTABLE_FIELDS,
    {
      album: z.string().trim().optional().describe('Album slug'),
      albumId: z.coerce.number().int().positive().optional(),
      serviceId: z.coerce.number().int().positive().optional(),
      mediaType: mediaType.optional(),
      isFeatured: booleanQuery,
      status: activeStatusSchema.optional().describe('Admins only'),
    },
    { sortBy: 'sortOrder', sortOrder: 'asc' },
  ),

  createItem: z
    .object({
      ...itemFields,
      mediaType: mediaType.default('image'),
      status: itemFields.status.default('active'),
    })
    .refine(beforeOnlyForImages, beforeRule),

  updateItem: nonEmpty(z.object(itemFields).partial().strict()).refine(
    beforeOnlyForImages,
    beforeRule,
  ),

  bulkCreate: z.object({
    albumId: z.number().int().positive().nullable().optional(),
    serviceId: z.number().int().positive().nullable().optional(),
    items: z
      .array(
        z.object({
          fileUrl: urlSchema,
          title: z.string().trim().max(150).optional(),
          altText: z.string().trim().max(255).optional(),
        }),
      )
      .min(1)
      .max(MAX_BULK_ITEMS),
  }),

  reorder: z.object({
    items: z
      .array(
        z.object({
          id: z.number().int().positive(),
          sortOrder: z.number().int().min(0).max(100_000),
        }),
      )
      .min(1)
      .max(500),
  }),
};

export type AlbumListQuery = z.infer<typeof GalleryValidation.albumListQuery>;
export type ItemListQuery = z.infer<typeof GalleryValidation.itemListQuery>;
export type CreateItemInput = z.infer<typeof GalleryValidation.createItem>;
export type UpdateItemInput = z.infer<typeof GalleryValidation.updateItem>;
export type BulkCreateInput = z.infer<typeof GalleryValidation.bulkCreate>;
