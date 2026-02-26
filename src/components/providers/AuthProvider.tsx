import { useEffect } from 'react';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const { setUser, setSession, setIsLoading, setHouseholdId } = useAuthStore();

    useEffect(() => {
        const fetchHouseholdId = async (userId: string) => {
            const { data } = await supabase
                .from('household_members')
                .select('household_id')
                .eq('user_id', userId)
                .single();
            if (data) setHouseholdId(data.household_id);
        };

        // 앱 초기화 시 현재 세션 가져오기
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) fetchHouseholdId(session.user.id);
            setIsLoading(false);
        });

        // 인증 상태 변경 리스너 등록
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
                fetchHouseholdId(session.user.id);
            } else {
                setHouseholdId(null);
            }
            setIsLoading(false);
        });

        return () => subscription.unsubscribe();
    }, [setSession, setUser, setIsLoading, setHouseholdId]);

    return <>{children}</>;
}
