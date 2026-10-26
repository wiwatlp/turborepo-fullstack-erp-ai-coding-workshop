import { oc } from '@orpc/contract';
import * as z from 'zod';

export const RoleSchema = z.enum(['ADMIN', 'PURCHASING', 'STORE_STAFF', 'MANAGER']);
export type Role = z.infer<typeof RoleSchema>;

/** The signed-in user as the API exposes it (never includes the password hash). */
export const UserSchema = z
  .object({
    id: z.string(),
    email: z.email(),
    name: z.string(),
    role: RoleSchema,
    storeId: z.string().nullable(),
  })
  .superRefine((val, ctx) => {
    if (val.role === 'STORE_STAFF' && !val.storeId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'storeId is mandatory for STORE_STAFF',
        path: ['storeId'],
      });
    }
    if (val.role !== 'STORE_STAFF' && val.storeId !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'storeId must be null for organization-wide roles',
        path: ['storeId'],
      });
    }
  });
export type User = z.infer<typeof UserSchema>;

export const LoginInputSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof LoginInputSchema>;

export const SessionSchema = z.object({
  user: UserSchema.nullable(),
});
export type Session = z.infer<typeof SessionSchema>;

export const authContract = {
  login: oc
    .route({
      method: 'POST',
      path: '/auth/login',
      summary: 'Sign in with email and password',
      tags: ['Auth'],
    })
    .input(LoginInputSchema)
    .output(UserSchema),
  logout: oc.route({ method: 'POST', path: '/auth/logout', summary: 'Sign out', tags: ['Auth'] }),
  me: oc
    .route({
      method: 'GET',
      path: '/auth/me',
      summary: 'The signed-in user, or null',
      tags: ['Auth'],
    })
    .output(SessionSchema),
};
