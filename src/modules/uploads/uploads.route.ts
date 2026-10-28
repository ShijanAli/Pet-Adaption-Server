import { createModuleRouter } from '@/shared/http/createModuleRouter';
import { PERMISSIONS as P } from '@/shared/constants/permissions';
import {
  MAX_FILES_PER_REQUEST,
  uploadMultipleImages,
  uploadSingleImage,
} from '@/shared/middlewares/upload';
import { UploadController } from './uploads.controller';
import { UploadValidation } from './uploads.validation';

const r = createModuleRouter(
  '/uploads',
  'Uploads',
  'Image upload to Cloudinary. Upload first, then send the returned `url` in other APIs.',
);

r.post(
  '/image',
  {
    summary: 'Upload one image',
    description: 'multipart/form-data, field `file`. jpeg/png/webp/gif/avif.',
    access: 'auth',
    before: [uploadSingleImage('file')],
    query: UploadValidation.folderQuery,
    multipart: { file: 'file' },
  },
  UploadController.uploadOne,
);

r.post(
  '/images',
  {
    summary: `Upload up to ${MAX_FILES_PER_REQUEST} images`,
    description: 'multipart/form-data, field `files` (repeat the field for each image).',
    access: 'auth',
    before: [uploadMultipleImages('files')],
    query: UploadValidation.folderQuery,
    multipart: { files: 'files' },
  },
  UploadController.uploadMany,
);

r.delete(
  '/',
  {
    summary: 'Delete an image from Cloudinary',
    access: { permissions: [P.UPLOAD.DELETE] },
    body: UploadValidation.remove,
  },
  UploadController.remove,
);

export const uploadRoutes = r;
