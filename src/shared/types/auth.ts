export type AuthUser = {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  roleId: number;
  roleSlug: string;
  isSuperAdmin: boolean;
};
