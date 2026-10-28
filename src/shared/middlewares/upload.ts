import multer from 'multer';
import { env } from '@/config/env';
import { AppError } from '@/shared/errors/AppError';

const IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
]);

/** Files stay in memory and are streamed straight to Cloudinary. */
const imageUploader = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.UPLOAD_MAX_FILE_SIZE_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (IMAGE_MIME_TYPES.has(file.mimetype)) return cb(null, true);
    cb(
      AppError.badRequest(
        `Unsupported file type: ${file.mimetype}. Allowed: jpeg, png, webp, gif, avif`,
      ),
    );
  },
});

export const MAX_FILES_PER_REQUEST = 10;

export const uploadSingleImage = (field = 'file') => imageUploader.single(field);
export const uploadMultipleImages = (field = 'files', max = MAX_FILES_PER_REQUEST) =>
  imageUploader.array(field, max);
