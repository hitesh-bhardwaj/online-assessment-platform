'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { AdminUserRecord } from '@/lib/admin-data';
import type { PaginatedResponse } from '@/app/api/recruiter/helpers';
import { apiRequest } from '@/lib/api-client';
import { adminKeys } from '@/lib/query-keys';

export type InviteUserPayload = {
  email: string;
  role: 'admin' | 'recruiter';
  firstName: string;
  lastName: string;
  password: string;
};

export type UpdateUserStatusPayload = {
  userId: string;
  status: 'active' | 'suspended';
};

export interface AdminUsersQuery {
  page?: number;
  limit?: number;
  role?: 'admin' | 'recruiter';
  status?: 'active' | 'invited' | 'suspended';
  search?: string;
}

/**
 * List admin users with filters + pagination
 */
export function useAdminUsers(filters?: AdminUsersQuery) {
  const params = Object.fromEntries(
    Object.entries(filters ?? {}).filter(
      ([, value]) => value !== undefined && value !== ''
    )
  ) as Record<string, string | number>;

  return useQuery<PaginatedResponse<AdminUserRecord>>({
    queryKey: adminKeys.usersList(params),
    queryFn: () =>
      apiRequest<PaginatedResponse<AdminUserRecord>>({
        url: '/admin/users',
        method: 'GET',
        params: Object.keys(params).length ? params : undefined,
      }),
    // v5 way to keep the previous data visible while the new one is fetching
    placeholderData: keepPreviousData,
  });
}


/**
 * Invite a new admin/recruiter
 */
export function useInviteAdminUser() {
  const queryClient = useQueryClient();

  const defaultPermissions = (role: 'admin' | 'recruiter') => {
    if (role === 'admin') {
      return {
        assessments: { create: true, read: true, update: true, delete: true },
        questions: { create: true, read: true, update: true, delete: true },
        invitations: { create: true, read: true, update: true, delete: true },
        results: { read: true, export: true, delete: true },
        users: { create: true, read: true, update: true, delete: true },
        organization: { read: true, update: true },
      };
    }
    return {
      assessments: { create: true, read: true, update: true, delete: false },
      questions: { create: true, read: true, update: true, delete: false },
      invitations: { create: true, read: true, update: true, delete: false },
      results: { read: true, export: true, delete: false },
      users: { create: false, read: false, update: false, delete: false },
      organization: { read: true, update: false },
    };
  };

  return useMutation({
    mutationFn: (payload: InviteUserPayload) =>
      apiRequest<AdminUserRecord>({
        url: '/admin/users',
        method: 'POST',
        data: {
          ...payload,
          permissions: defaultPermissions(payload.role),
        },
      }),
    onSuccess: () => {
      // Refresh all lists so the new user appears (e.g. page 1)
      queryClient.invalidateQueries({ queryKey: adminKeys.users(), exact: false });
    },
  });
}

/**
 * Update user status (active/suspended)
 */
export function useUpdateAdminUserStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, status }: UpdateUserStatusPayload) =>
      apiRequest<AdminUserRecord>({
        url: `/admin/users/${userId}`,
        method: 'PATCH',
        data: { status },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.users(), exact: false });
    },
  });
}

/**
 * Hard delete an admin user (server DELETE).
 * - Optimistically removes from cache (all matching lists)
 * - Rolls back on error
 * - Invalidates on settle to re-sync
 */
export function useDeleteAdminUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest<void>({
        url: `/admin/users/${userId}`,
        method: 'DELETE',
      });
    },

    onMutate: async (userId: string) => {
      // pause outgoing fetches for these queries
      await queryClient.cancelQueries({ queryKey: adminKeys.users(), exact: false });

      // snapshot previous data for rollback
      const snapshots = new Map<
        string,
        PaginatedResponse<AdminUserRecord> | undefined
      >();

      queryClient
        .getQueryCache()
        .findAll({ queryKey: adminKeys.users(), exact: false })
        .forEach((q) => {
          const key = JSON.stringify(q.queryKey);
          snapshots.set(
            key,
            queryClient.getQueryData<PaginatedResponse<AdminUserRecord>>(q.queryKey)
          );

          // optimistically remove the user from each cached page
         queryClient.setQueryData<PaginatedResponse<AdminUserRecord>>(
  q.queryKey,
  (oldData) => {
    if (!oldData) return oldData;

    const nextItems = oldData.items?.filter((u) => u.id !== userId) ?? [];

    // Build a guaranteed, non-optional pagination base
    const base = oldData.pagination ?? {
      page: 1,
      limit: Math.max(nextItems.length, 1),
      total: oldData.items?.length ?? nextItems.length,
      pages: 1,
    };

    // Recompute numbers from the base
    const total = Math.max(0, (base.total ?? nextItems.length) - 1);
    const limit = base.limit || Math.max(nextItems.length, 1);
    const pages = Math.max(1, Math.ceil(total / limit));
    const page = Math.min(base.page || 1, pages);

    const pagination = {
      ...base,
      total,
      limit,
      pages,
      page,
    };

    return {
      ...oldData,
      items: nextItems,
      pagination, // <-- always present
    };
  }
);
        });

      // return context for onError rollback
      return { snapshots };
    },

    onError: (_err, _userId, ctx) => {
      // rollback to snapshots
      if (!ctx?.snapshots) return;
      ctx.snapshots.forEach((data, key) => {
        try {
          const parsedKey = JSON.parse(key);
          queryClient.setQueryData(parsedKey, data);
        } catch {
          /* noop */
        }
      });
    },

    onSettled: () => {
      // ensure final sync with server
      queryClient.invalidateQueries({ queryKey: adminKeys.users(), exact: false });
    },
  });
}
