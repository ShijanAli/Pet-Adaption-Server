import { z } from 'zod';

export const UPLOAD_FOLDERS = [
  'users',
  'pets',
  'services',
  'service-categories',
  'adoption-pets',
  'gallery',
  'blog',
  'reviews',
  'promotions',
  'misc',
] as const;

export const UploadValidation = {
  folderQuery: z.object({
    folder: z.enum(UPLOAD_FOLDERS).default('misc'),
  }),

  remove: z.object({
    publicId: z.string().trim().min(1).max(255),
  }),
};

export type UploadFolder = (typeof UPLOAD_FOLDERS)[number];
