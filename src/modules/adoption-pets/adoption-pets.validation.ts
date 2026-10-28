import { z } from 'zod';
import { listQuerySchema } from '@/shared/utils/queryBuilder';
import {
  booleanQuery,
  moneySchema,
  nonEmpty,
  slugSchema,
  urlSchema,
} from '@/shared/utils/validation';
import { ADOPTION_PET_SORTABLE_FIELDS, MAX_IMAGES_PER_PET } from './adoption-pets.constant';

const status = z.enum(['available', 'pending', 'adopted', 'on_hold']);
const gender = z.enum(['male', 'female']);
const size = z.enum(['small', 'medium', 'large']);

const imageInput = z.object({
  imageUrl: urlSchema,
  isPrimary: z.boolean().optional(),
});

const fields = {
  petTypeId: z.number().int().positive(),
  name: z.string().trim().min(1).max(100),
  slug: slugSchema.max(120).optional(),
  breed: z.string().trim().max(100).nullable().optional(),
  gender,
  ageMonths: z.number().int().min(0).max(400),
  size: size.nullable().optional(),
  color: z.string().trim().max(50).nullable().optional(),
  description: z.string().trim().min(10).max(10_000),
  healthStatus: z.string().trim().max(2000).nullable().optional(),
  isVaccinated: z.boolean().optional(),
  isNeutered: z.boolean().optional(),
  adoptionFee: moneySchema.optional().describe('In BDT. 0 = free adoption'),
  isFeatured: z.boolean().optional(),
};

export const AdoptionPetValidation = {
  listQuery: listQuerySchema(ADOPTION_PET_SORTABLE_FIELDS, {
    petTypeId: z.coerce.number().int().positive().optional(),
    petType: z.string().trim().optional().describe('Pet type slug, e.g. cat'),
    gender: gender.optional(),
    size: size.optional(),
    isVaccinated: booleanQuery,
    isNeutered: booleanQuery,
    isFeatured: booleanQuery,
    minAgeMonths: z.coerce.number().int().min(0).optional(),
    maxAgeMonths: z.coerce.number().int().min(0).optional(),
    maxFee: z.coerce.number().min(0).optional(),
    status: status.optional().describe('Public: available | pending. Admins: any'),
  }),

  create: z.object({
    ...fields,
    images: z.array(imageInput).max(MAX_IMAGES_PER_PET).default([]),
  }),

  update: nonEmpty(z.object(fields).partial().strict()),

  // pending / adopted are driven by the adoption workflow
  updateStatus: z.object({ status: z.enum(['available', 'on_hold']) }),

  addImages: z.object({ images: z.array(imageInput).min(1).max(MAX_IMAGES_PER_PET) }),

  imageParams: z.object({
    id: z.coerce.number().int().positive(),
    imageId: z.coerce.number().int().positive(),
  }),
};

export type ListAdoptionPetsQuery = z.infer<typeof AdoptionPetValidation.listQuery>;
export type CreateAdoptionPetInput = z.infer<typeof AdoptionPetValidation.create>;
export type UpdateAdoptionPetInput = z.infer<typeof AdoptionPetValidation.update>;
export type ImageInput = z.infer<typeof imageInput>;
