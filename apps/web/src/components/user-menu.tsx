import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LogOut } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { clearSession, useCurrentUser } from '@/lib/auth';
import { formatStoreAssignment, I18N, ROLE_LABELS_TH } from '@/lib/i18n';
import { orpc } from '@/lib/orpc';

export function UserMenu() {
  const user = useCurrentUser();
  const queryClient = useQueryClient();
  const logout = useMutation(
    orpc.auth.logout.mutationOptions({ onSuccess: () => clearSession(queryClient) }),
  );

  if (!user) return null;

  return (
    <div className="flex items-center gap-3 text-sm font-normal">
      <span className="font-medium">{user.name}</span>
      <Badge variant="secondary">{ROLE_LABELS_TH[user.role] ?? user.role}</Badge>
      <span className="text-xs text-muted-foreground" data-testid="user-store">
        {formatStoreAssignment(user.storeId)}
      </span>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => logout.mutate({})}
        disabled={logout.isPending}
      >
        <LogOut className="h-4 w-4 mr-1" />
        {I18N.signOut}
      </Button>
    </div>
  );
}
