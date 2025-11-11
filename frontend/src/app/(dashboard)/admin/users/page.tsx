'use client';

import { useEffect, useMemo, useState } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import {
  useAdminUsers,
  useInviteAdminUser,
  useUpdateAdminUserStatus,
  useDeleteAdminUser,
  useUpdateAdminUser, // full update
  type InviteUserPayload,
  type AdminUsersQuery,
} from '@/hooks/use-admin-users';

const statusVariant: Record<string, 'secondary' | 'outline' | 'destructive'> = {
  active: 'secondary',
  invited: 'outline',
  suspended: 'destructive',
};

function generateTempPassword(length = 12) {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@$%&*?';
  const all = upper + lower + digits + symbols;

  const randomChar = (charset: string) =>
    charset[Math.floor(Math.random() * charset.length)];

  const required = [
    randomChar(upper),
    randomChar(lower),
    randomChar(digits),
    randomChar(symbols),
  ];
  const remaining = Array.from(
    { length: Math.max(length - required.length, 0) },
    () => randomChar(all)
  );

  const passwordChars = [...required, ...remaining];
  for (let i = passwordChars.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [passwordChars[i], passwordChars[j]] = [passwordChars[j], passwordChars[i]];
  }

  return passwordChars.join('');
}

function inferNameFromEmail(email: string) {
  const localPart = email.split('@')[0] ?? '';
  const segments = localPart
    .split(/[-_.\s]+/)
    .filter(Boolean)
    .map(
      (segment) =>
        segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase()
    );

  return {
    firstName: segments[0] ?? '',
    lastName: segments.length > 1 ? segments.slice(1).join(' ') : '',
  };
}

const PAGE_SIZE = 10;

const createInviteFormState = (): InviteUserPayload => ({
  email: '',
  role: 'recruiter',
  firstName: '',
  lastName: '',
  password: generateTempPassword(),
});

export default function AdminUsersPage() {
  const [filters, setFilters] = useState<AdminUsersQuery>({
    page: 1,
    limit: PAGE_SIZE,
  });

  const { data, isLoading, isFetching, isError, error } = useAdminUsers(filters);
  const inviteMutation = useInviteAdminUser();
  const suspendMutation = useUpdateAdminUserStatus(); // used by ToggleStatusAction
  const deleteMutation = useDeleteAdminUser();
  const updateMutation = useUpdateAdminUser(); // full edit

  const [inviteForm, setInviteForm] = useState<InviteUserPayload>(() =>
    createInviteFormState()
  );

  const users = data?.items ?? [];
  const pagination = data?.pagination ?? {
    page: filters.page ?? 1,
    limit: filters.limit ?? PAGE_SIZE,
    total: users.length,
    pages: Math.max(1, Math.ceil((users.length || 1) / (filters.limit || PAGE_SIZE))),
  };

  // Display range based on server pagination + current page’s item count
  const rangeStart = users.length
    ? (pagination.page - 1) * pagination.limit + 1
    : 0;
  const rangeEnd = users.length ? rangeStart + users.length - 1 : 0;

  // After successful invite, reset form and go to first page to show the new user
  useEffect(() => {
    if (!inviteMutation.isSuccess) return;
    setInviteForm(createInviteFormState());
    setFilters((prev) => ({ ...prev, page: 1 }));
  }, [inviteMutation.isSuccess]);

  // Autocomplete name from email (first load / when email changes)
  useEffect(() => {
    if (!inviteForm.email) return;
    if (inviteForm.firstName || inviteForm.lastName) return;

    const { firstName, lastName } = inferNameFromEmail(inviteForm.email);
    if (!firstName && !lastName) return;

    setInviteForm((form) =>
      form.firstName || form.lastName
        ? form
        : {
            ...form,
            firstName: firstName || form.firstName,
            lastName: lastName || form.lastName,
          }
    );
  }, [inviteForm.email, inviteForm.firstName, inviteForm.lastName]);

  const inviteDisabled = useMemo(() => {
    if (inviteMutation.isPending) return true;
    return (
      !inviteForm.email ||
      !inviteForm.firstName ||
      !inviteForm.lastName ||
      inviteForm.password.length < 8
    );
  }, [
    inviteForm.email,
    inviteForm.firstName,
    inviteForm.lastName,
    inviteForm.password.length,
    inviteMutation.isPending,
  ]);

  if (isLoading && users.length === 0) {
    return (
      <div className="grid gap-6">
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      {isError ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to load users</AlertTitle>
          <AlertDescription>
            {(error as Error)?.message ?? 'Please verify the admin API.'}
          </AlertDescription>
        </Alert>
      ) : null}

      {suspendMutation.isError ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to update user status</AlertTitle>
          <AlertDescription>
            {(suspendMutation.error as Error)?.message ??
              'Request could not be completed.'}
          </AlertDescription>
        </Alert>
      ) : null}

      {deleteMutation.isError ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to delete user</AlertTitle>
          <AlertDescription>
            {(deleteMutation.error as Error)?.message ?? 'Delete request failed.'}
          </AlertDescription>
        </Alert>
      ) : null}

      {updateMutation.isError ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to update user</AlertTitle>
          <AlertDescription>
            {(updateMutation.error as Error)?.message ?? 'Update failed.'}
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Invite teammates</CardTitle>
          <CardDescription>
            Send platform access to admins or recruiters. Provide a temporary
            password—they can change it after logging in.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="invite-first-name">First name</Label>
              <Input
                id="invite-first-name"
                autoComplete="given-name"
                value={inviteForm.firstName}
                onChange={(event) => {
                  inviteMutation.reset();
                  setInviteForm((form) => ({
                    ...form,
                    firstName: event.target.value,
                  }));
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-last-name">Last name</Label>
              <Input
                id="invite-last-name"
                autoComplete="family-name"
                value={inviteForm.lastName}
                onChange={(event) => {
                  inviteMutation.reset();
                  setInviteForm((form) => ({
                    ...form,
                    lastName: event.target.value,
                  }));
                }}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Work email</Label>
              <Input
                id="invite-email"
                type="email"
                autoComplete="email"
                placeholder="teammate@acme.io"
                value={inviteForm.email}
                onChange={(event) => {
                  inviteMutation.reset();
                  setInviteForm((form) => ({
                    ...form,
                    email: event.target.value,
                  }));
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-role">Role</Label>
              <select
                id="invite-role"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={inviteForm.role}
                onChange={(event) => {
                  inviteMutation.reset();
                  setInviteForm((form) => ({
                    ...form,
                    role: event.target.value as InviteUserPayload['role'],
                  }));
                }}
              >
                <option value="recruiter">Recruiter</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="invite-password">Temporary password</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  setInviteForm((form) => ({
                    ...form,
                    password: generateTempPassword(),
                  }))
                }
              >
                Regenerate
              </Button>
            </div>
            <Input
              id="invite-password"
              type="text"
              autoComplete="new-password"
              value={inviteForm.password}
              onChange={(event) => {
                inviteMutation.reset();
                setInviteForm((form) => ({
                  ...form,
                  password: event.target.value,
                }));
              }}
            />
            <p className="text-xs text-muted-foreground">
              Minimum 8 characters with a mix of uppercase, lowercase, numbers,
              and symbols.
            </p>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <Button
              disabled={inviteDisabled}
              onClick={() => inviteMutation.mutate(inviteForm)}
              type="button"
            >
              {inviteMutation.isPending ? 'Creating account...' : 'Create account'}
            </Button>

            <div className="flex flex-1 flex-col gap-3 md:items-end">
              {inviteMutation.isError ? (
                <Alert variant="destructive" className="max-w-md">
                  <AlertTitle>Invite failed</AlertTitle>
                  <AlertDescription>
                    {(inviteMutation.error as Error)?.message ?? 'Request did not reach the API.'}
                  </AlertDescription>
                </Alert>
              ) : null}

              {inviteMutation.isSuccess && inviteMutation.data ? (
                <Alert className="max-w-md bg-secondary/20">
                  <AlertTitle>User ready</AlertTitle>
                  <AlertDescription>
                    {(inviteMutation.data as any).email} now has{' '}
                    {(inviteMutation.data as any).role} access. Share the password
                    securely and ask them to update it after signing in.
                  </AlertDescription>
                </Alert>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* team directory */}
      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Team directory</CardTitle>
            <CardDescription>
              Review current admins and recruiters. Filter by role, status, or search terms.
            </CardDescription>
          </div>

          <div className="grid gap-2 md:grid-cols-3 md:items-center md:justify-end">
            <Input
              placeholder="Search by name or email"
              value={filters.search ?? ''}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  page: 1,
                  search: event.target.value,
                }))
              }
            />

            <Select
              value={filters.role ?? 'all'}
              onValueChange={(value) =>
                setFilters((prev) => ({
                  ...prev,
                  page: 1,
                  role: value === 'all' ? undefined : (value as 'admin' | 'recruiter'),
                }))
              }
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="recruiter">Recruiter</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.status ?? 'all'}
              onValueChange={(value) =>
                setFilters((prev) => ({
                  ...prev,
                  page: 1,
                  status: value === 'all' ? undefined : (value as 'active' | 'invited' | 'suspended'),
                }))
              }
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="invited">Invited</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/60">
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last login</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                        Loading team members…
                      </div>
                    </TableCell>
                  </TableRow>
                ) : users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <div className="flex flex-col items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                        <p>No users match the selected filters.</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setFilters({ page: 1, limit: PAGE_SIZE })}
                        >
                          Reset filters
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-medium text-foreground">{user.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{user.email}</TableCell>
                      <TableCell>
                        <Badge
                          variant={user.role === 'admin' ? 'secondary' : 'outline'}
                          className="capitalize"
                        >
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={statusVariant[user.status] ?? 'outline'}
                          className="uppercase"
                        >
                          {user.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {user.lastLogin ?? '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex gap-2">
                          <Button size="sm" variant="ghost" disabled>
                            Resend invite
                          </Button>

                          {/* EDIT */}
                          <EditAction
                            user={{
                              id: user.id,
                              name: user.name,
                              email: user.email,
                              role: user.role as 'admin' | 'recruiter',
                              status: (user.status === 'active' || user.status === 'suspended'
                                ? user.status
                                : 'active') as 'active' | 'suspended',
                            }}
                            isPending={updateMutation.isPending}
                            serverError={
                              updateMutation.isError
                                ? (updateMutation.error as Error)?.message
                                : undefined
                            }
                            onSave={async (data) => {
                              await updateMutation.mutateAsync({ userId: user.id, data });
                            }}
                          />

                          {/* TOGGLE STATUS (Active ⇄ Suspended) */}
                          <ToggleStatusAction
                            status={(user.status === 'active' || user.status === 'suspended'
                              ? user.status
                              : 'active') as 'active' | 'suspended'}
                            isPending={suspendMutation.isPending}
                            onConfirm={(next) =>
                              suspendMutation.mutate({
                                userId: user.id,
                                status: next,
                              })
                            }
                          />

                          {/* DELETE */}
                          <DeleteAction
                            disabled={deleteMutation.isPending}
                            isPending={deleteMutation.isPending}
                            onConfirm={() => deleteMutation.mutate(user.id)}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-3 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
            <span>
              Showing {rangeStart}-{rangeEnd} of {pagination.total}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setFilters((prev) => ({
                    ...prev,
                    page: Math.max(1, (prev.page ?? 1) - 1),
                  }))
                }
                disabled={pagination.page <= 1 || isFetching}
              >
                Previous
              </Button>
              <span className="text-xs">Page {pagination.page} of {pagination.pages}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setFilters((prev) => ({
                    ...prev,
                    page: Math.min(pagination.pages, (prev.page ?? 1) + 1),
                  }))
                }
                disabled={pagination.page >= pagination.pages || isFetching}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/** ---------------- EditAction (Full Edit dialog) ---------------- **/
function EditAction({
  user,
  isPending,
  serverError,
  onSave,
}: {
  user: {
    id: string;
    name: string;
    email: string;
    role: 'admin' | 'recruiter';
    status: 'active' | 'suspended';
  };
  isPending: boolean;
  serverError?: string;
  onSave: (data: {
    firstName?: string;
    lastName?: string;
    email?: string;
    password?: string;
    role?: 'admin' | 'recruiter';
    status?: 'active' | 'suspended';
  }) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  const initialFirst = user.name?.trim()?.split(' ')[0] ?? '';
  const initialLast = user.name?.trim()?.split(' ').slice(1).join(' ') ?? '';

  const [firstName, setFirstName] = useState(initialFirst);
  const [lastName, setLastName] = useState(initialLast);
  const [email, setEmail] = useState(user.email);
  const [role, setRole] = useState<'admin' | 'recruiter'>(user.role);
  const [status, setStatus] = useState<'active' | 'suspended'>(user.status);
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | undefined>(undefined);

  const canSave =
    !!firstName.trim() &&
    !!lastName.trim() &&
    !!email.trim() &&
    (password === '' || password.length >= 8);

  // Reset form when opening
  useEffect(() => {
    if (!open) return;
    setFirstName(initialFirst);
    setLastName(initialLast);
    setEmail(user.email);
    setRole(user.role);
    setStatus(user.status);
    setPassword('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function handleSave() {
    setLocalError(undefined);
    if (!canSave) {
      setLocalError('Please fill all fields correctly. Password must be at least 8 characters if provided.');
      return;
    }
    const payload: any = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim().toLowerCase(),
      role,
      status,
    };
    if (password.trim()) payload.password = password.trim();

    try {
      await onSave(payload);
      setOpen(false);
    } catch (e: any) {
      setLocalError(e?.message || 'Failed to save changes.');
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="outline">
          Edit
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Edit user</AlertDialogTitle>
          <AlertDialogDescription>
            Update profile details, role, and status. Leave password blank to keep current.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="grid gap-3 py-2">
          <div className="grid gap-2 md:grid-cols-2">
            <div>
              <Label htmlFor="edit-first">First name</Label>
              <Input id="edit-first" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="edit-last">Last name</Label>
              <Input id="edit-last" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="edit-email">Email</Label>
            <Input id="edit-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="edit-password">New password</Label>
            <Input
              id="edit-password"
              type="text"
              placeholder="Leave blank to keep current password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">At least 8 characters if you change it.</p>
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit-role">Role</Label>
              <select
                id="edit-role"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={role}
                onChange={(e) => setRole(e.target.value as 'admin' | 'recruiter')}
              >
                <option value="recruiter">Recruiter</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-status">Status</Label>
              <select
                id="edit-status"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={status}
                onChange={(e) => setStatus(e.target.value as 'active' | 'suspended')}
              >
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
          </div>

          {(localError || serverError) && (
            <Alert variant="destructive">
              <AlertTitle>Update failed</AlertTitle>
              <AlertDescription>{localError || serverError}</AlertDescription>
            </Alert>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={!canSave || isPending} onClick={handleSave}>
            {isPending ? 'Saving…' : 'Save changes'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** ---------------- ToggleStatusAction (Active ⇄ Suspended) ---------------- **/
function ToggleStatusAction({
  status,
  isPending,
  onConfirm,
}: {
  status: 'active' | 'suspended';
  isPending: boolean;
  onConfirm: (next: 'active' | 'suspended') => void;
}) {
  const next = status === 'active' ? 'suspended' : 'active';
  const label = status === 'active' ? 'Suspend' : 'Activate';

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant={status === 'active' ? 'outline' : 'secondary'} disabled={isPending}>
          {isPending ? 'Updating…' : label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{label} user</AlertDialogTitle>
          <AlertDialogDescription>
            {status === 'active'
              ? 'This immediately revokes access. You can reactivate later.'
              : 'This restores access immediately.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => onConfirm(next)} disabled={isPending}>
            Confirm
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** ---------------- DeleteAction (unchanged) ---------------- **/
function DeleteAction({
  disabled,
  isPending,
  onConfirm,
}: {
  disabled: boolean;
  isPending: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="destructive" disabled={disabled || isPending}>
          {isPending ? 'Deleting...' : 'Delete'}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete user</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes the user from your organization and revokes
            access immediately. This action cannot be undone. Continue?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            Confirm delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
