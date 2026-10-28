import { z } from 'zod';
import { createModuleRouter } from '@/shared/http/createModuleRouter';
import { listQuerySchema } from '@/shared/utils/queryBuilder';
import { FavoriteController } from './favorites.controller';

const petParam = z.object({ adoptionPetId: z.coerce.number().int().positive() });

const r = createModuleRouter(
  '/me/favorites',
  'My Favorites',
  'Adoption pets saved by the logged-in user',
);

r.get(
  '/',
  {
    summary: 'List my favorite adoption pets',
    access: 'auth',
    query: listQuerySchema(['createdAt'] as const),
  },
  FavoriteController.getMine,
);

r.put(
  '/:adoptionPetId',
  { summary: 'Add to favorites (idempotent)', access: 'auth', params: petParam },
  FavoriteController.add,
);

r.delete(
  '/:adoptionPetId',
  { summary: 'Remove from favorites', access: 'auth', params: petParam },
  FavoriteController.remove,
);

export const favoriteRoutes = r;
