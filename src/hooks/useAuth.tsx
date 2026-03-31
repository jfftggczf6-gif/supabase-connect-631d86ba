import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

interface AuthContextType {
  session: Session | null;
  user: User | null;
  role: AppRole | null;
  profile: { full_name: string | null; email: string | null; avatar_url: string | null } | null;
  loading: boolean;
  roleLoading: boolean;
  signUp: (email: string, password: string, fullName: string, selectedRole?: AppRole) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  setRole: (role: AppRole) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRoleState] = useState<AppRole | null>(null);
  const [profile, setProfile] = useState<AuthContextType['profile']>(null);
  const [loading, setLoading] = useState(true);
  const [roleLoading, setRoleLoading] = useState(false);
  

  const ROLE_PRIORITY: AppRole[] = ['super_admin', 'chef_programme', 'coach', 'entrepreneur'];

  const fetchUserData = async (userId: string) => {
    const [profileRes, rolesRes] = await Promise.all([
      supabase.from('profiles').select('full_name, email, avatar_url').eq('user_id', userId).single(),
      supabase.from('user_roles').select('role').eq('user_id', userId),
    ]);
    if (profileRes.data) setProfile(profileRes.data);
    if (rolesRes.data && rolesRes.data.length > 0) {
      const roles = rolesRes.data.map(r => r.role);
      const effective = ROLE_PRIORITY.find(r => roles.includes(r)) || roles[0];
      setRoleState(effective);
    } else {
      setRoleState(null);
    }
  };

  useEffect(() => {
    // First restore session from storage
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserData(session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    // Then listen for auth changes (don't await inside callback)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        // Only set roleLoading=true if role is not yet known (first load).
        // On token refresh the role is already set — skip spinner to avoid unmounting dashboard.
        setRoleState(currentRole => {
          if (!currentRole) setRoleLoading(true);
          return currentRole;
        });
        // Fetch user data (role is created explicitly by Register page, not by trigger)
        const doFetch = async () => {
          await fetchUserData(session!.user.id);
          setRoleLoading(false);
        };
        // Small delay on SIGNED_IN to let the insert propagate
        const delay = event === 'SIGNED_IN' ? 300 : 0;
        setTimeout(doFetch, delay);
      } else {
        setProfile(null);
        setRoleState(null);
        setRoleLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, fullName: string, selectedRole?: AppRole) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, role: selectedRole || 'entrepreneur' },
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) throw error;
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const setRole = async (newRole: AppRole) => {
    // Use state user first, fall back to supabase.auth.getUser() (needed right after signup)
    let userId = user?.id;
    let userEmail = user?.email;
    let fullName = user?.user_metadata?.full_name;
    if (!userId) {
      const { data } = await supabase.auth.getUser();
      userId = data?.user?.id;
      userEmail = data?.user?.email;
      fullName = data?.user?.user_metadata?.full_name;
    }
    if (!userId) throw new Error('Not authenticated');
    // Ensure profile exists with full_name
    await supabase.from('profiles').upsert({
      user_id: userId,
      full_name: fullName || null,
      email: userEmail || null,
    }, { onConflict: 'user_id' });
    // Remove existing coach/entrepreneur roles before inserting the new one
    await supabase.from('user_roles')
      .delete()
      .eq('user_id', userId)
      .in('role', ['coach', 'entrepreneur']);
    const { error } = await supabase.from('user_roles').insert(
      { user_id: userId, role: newRole }
    );
    if (error) throw error;
    setRoleState(newRole);
  };

  return (
    <AuthContext.Provider value={{ session, user, role, profile, loading, roleLoading, signUp, signIn, signOut, setRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
