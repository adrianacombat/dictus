import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Usuario, Conta } from '@/types/database';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  usuario: Usuario | null;
  conta: Conta | null;
  loading: boolean;
  profileMissing: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [conta, setConta] = useState<Conta | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileMissing, setProfileMissing] = useState(false);

  async function loadProfile(userId: string): Promise<boolean> {
    const { data: userData, error: userErr } = await supabase
      .from('usuarios')
      .select('*')
      .eq('id_usuario', userId)
      .maybeSingle();

    if (userErr || !userData) {
      setUsuario(null);
      setConta(null);
      return false;
    }

    setUsuario(userData as Usuario);

    const { data: contaData } = await supabase
      .from('contas')
      .select('*')
      .eq('id_conta', (userData as Usuario).id_conta)
      .maybeSingle();

    setConta(contaData as Conta | null);
    setProfileMissing(false);
    return true;
  }

  async function refreshProfile() {
    if (session?.user) {
      const found = await loadProfile(session.user.id);
      setProfileMissing(!found);
    }
  }

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      if (session?.user) {
        // Retry profile loading — the database trigger may need a moment
        // to create the conta/usuario rows after signup
        let attempts = 0;
        const tryLoad = () => {
          attempts++;
          loadProfile(session.user.id).then((found) => {
            if (!mounted) return;
            if (found) {
              setLoading(false);
            } else if (attempts < 5) {
              setTimeout(tryLoad, 500);
            } else {
              setProfileMissing(true);
              setLoading(false);
            }
          });
        };
        tryLoad();
      } else {
        setLoading(false);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (!mounted) return;
        setSession(newSession);
        if (newSession?.user && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
          setLoading(true);
          setProfileMissing(false);
          (async () => {
            let attempts = 0;
            const tryLoad = async () => {
              attempts++;
              const found = await loadProfile(newSession.user.id);
              if (!mounted) return;
              if (found) {
                setLoading(false);
              } else if (attempts < 5) {
                setTimeout(tryLoad, 500);
              } else {
                setProfileMissing(true);
                setLoading(false);
              }
            };
            tryLoad();
          })();
        } else if (event === 'SIGNED_OUT') {
          setUsuario(null);
          setConta(null);
          setProfileMissing(false);
          setLoading(false);
        }
      },
    );

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    setUsuario(null);
    setConta(null);
    setSession(null);
    setProfileMissing(false);
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        usuario,
        conta,
        loading,
        profileMissing,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
