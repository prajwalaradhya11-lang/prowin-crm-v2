import { useCallback, useEffect, useRef, useState } from 'react';
import type { User as AuthUser } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export type CrmRole =
  | 'admin'
  | 'tech'
  | 'manager'
  | 'agent'
  | 'finance'
  | 'hr_manager'
  | 'recruiter'
  | string;

export type CrmUser = {
  id: string;
  email: string;
  name?: string | null;
  full_name?: string;
  role: CrmRole;
};

export function canManageStatusOptions(role?: string | null): boolean {
  return role === 'admin';
}

export function isAdminOrTech(role?: string | null): boolean {
  return role === 'admin' || role === 'tech';
}

export function getUserDisplayName(user: CrmUser | null): string {
  if (!user) return 'Unknown';
  return user.name ?? user.full_name ?? user.email ?? 'Unknown';
}

async function resolveCrmUser(authUser: AuthUser): Promise<CrmUser | null> {
  let crmUser: CrmUser | null = null;

  if (authUser.email) {
    const { data } = await supabase
      .from('crm_users')
      .select('id, email, name, role')
      .eq('email', authUser.email)
      .maybeSingle();
    crmUser = data
      ? { ...data, full_name: data.name ?? undefined }
      : null;
  }

  if (!crmUser) {
    const { data } = await supabase
      .from('crm_users')
      .select('id, email, name, role')
      .eq('id', authUser.id)
      .maybeSingle();
    crmUser = data
      ? { ...data, full_name: data.name ?? undefined }
      : null;
  }

  return crmUser;
}

export function useCrmSession() {
  const [user, setUser] = useState<CrmUser | null>(null);
  const [loading, setLoading] = useState(true);
  const resolveGenerationRef = useRef(0);

  const applyAuthUser = useCallback(async (authUser: AuthUser | null) => {
    const generation = ++resolveGenerationRef.current;

    if (!authUser) {
      if (generation !== resolveGenerationRef.current) return;
      setUser(null);
      setLoading(false);
      return;
    }

    const crmUser = await resolveCrmUser(authUser);

    if (generation !== resolveGenerationRef.current) return;

    setUser(crmUser);
    setLoading(false);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    await applyAuthUser(session?.user ?? null);
  }, [applyAuthUser]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      await applyAuthUser(session?.user ?? null);
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      void applyAuthUser(session?.user ?? null);
    });

    return () => {
      cancelled = true;
      resolveGenerationRef.current += 1;
      subscription.unsubscribe();
    };
  }, [applyAuthUser]);

  const role = user?.role ?? null;
  const canManageStatuses = canManageStatusOptions(role);
  const canManageCallStatuses = isAdminOrTech(role);

  return { user, role, loading, canManageStatuses, canManageCallStatuses, refresh };
}
