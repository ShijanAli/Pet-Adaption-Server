import { createModuleRouter } from '@/shared/http/createModuleRouter';
import { PERMISSIONS as P } from '@/shared/constants/permissions';
import { idOrSlugParam, idParam } from '@/shared/utils/validation';
import { AlbumController, GalleryItemController } from './gallery.controller';
import { GalleryValidation } from './gallery.validation';

/* ───────── Albums ───────── */
const albums = createModuleRouter('/gallery/albums', 'Gallery', 'Photo / video gallery');

albums.get(
  '/',
  {
    summary: 'List albums (with cover + item count)',
    access: 'optional',
    query: GalleryValidation.albumListQuery,
  },
  AlbumController.getAll,
);
albums.get(
  '/:idOrSlug',
  { summary: 'Get an album by id or slug', access: 'optional', params: idOrSlugParam },
  AlbumController.getOne,
);
albums.post(
  '/',
  {
    summary: 'Create an album',
    access: { permissions: [P.GALLERY.CREATE] },
    body: GalleryValidation.createAlbum,
  },
  AlbumController.create,
);
albums.patch(
  '/:id',
  {
    summary: 'Update an album',
    access: { permissions: [P.GALLERY.UPDATE] },
    params: idParam,
    body: GalleryValidation.updateAlbum,
  },
  AlbumController.update,
);
albums.delete(
  '/:id',
  {
    summary: 'Delete an album',
    description: 'Its items are kept and simply become album-less.',
    access: { permissions: [P.GALLERY.DELETE] },
    params: idParam,
  },
  AlbumController.remove,
);

/* ───────── Items ───────── */
const items = createModuleRouter('/gallery/items', 'Gallery', 'Photo / video gallery');

items.get(
  '/',
  {
    summary: 'List gallery items',
    description:
      'Filters: album (slug), albumId, serviceId, mediaType, isFeatured. Public sees active items only.',
    access: 'optional',
    query: GalleryValidation.itemListQuery,
  },
  GalleryItemController.getAll,
);

items.post(
  '/bulk',
  {
    summary: 'Add many images at once',
    description: 'Upload with `POST /uploads/images?folder=gallery`, then send the URLs here.',
    access: { permissions: [P.GALLERY.CREATE] },
    body: GalleryValidation.bulkCreate,
  },
  GalleryItemController.bulkCreate,
);

items.patch(
  '/reorder',
  {
    summary: 'Save drag & drop order',
    access: { permissions: [P.GALLERY.UPDATE] },
    body: GalleryValidation.reorder,
  },
  GalleryItemController.reorder,
);

items.get(
  '/:id',
  { summary: 'Get a gallery item', access: 'optional', params: idParam },
  GalleryItemController.getById,
);

items.post(
  '/',
  {
    summary: 'Add an image / video',
    access: { permissions: [P.GALLERY.CREATE] },
    body: GalleryValidation.createItem,
  },
  GalleryItemController.create,
);

items.patch(
  '/:id',
  {
    summary: 'Update a gallery item',
    access: { permissions: [P.GALLERY.UPDATE] },
    params: idParam,
    body: GalleryValidation.updateItem,
  },
  GalleryItemController.update,
);

items.delete(
  '/:id',
  {
    summary: 'Delete a gallery item',
    access: { permissions: [P.GALLERY.DELETE] },
    params: idParam,
  },
  GalleryItemController.remove,
);

export const galleryAlbumRoutes = albums;
export const galleryItemRoutes = items;
