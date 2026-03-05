import { useEffect } from 'react';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const { setUser, setSession, setIsLoading, setHouseholdId, setDisplayName } = useAuthStore();

    useEffect(() => {
        /** 가구 ID + 프로필 display_name 동시 조회 */
        const fetchUserContext = async (userId: string) => {
            // 가구 ID 조회
            const { data: memberData } = await supabase
                .from('household_members')
                .select('household_id')
                .eq('user_id', userId)
                .single();
            if (memberData) setHouseholdId(memberData.household_id);

            // 프로필 display_name 조회
            const { data: profileData } = await supabase
                .from('profiles')
                .select('display_name')
                .eq('user_id', userId)
                .single();
            if (profileData) setDisplayName(profileData.display_name);
        };

        // 앱 초기화 시 현재 세션 가져오기
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) fetchUserContext(session.user.id);
            setIsLoading(false);
        });

        // 인증 상태 변경 리스너 등록
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
                fetchUserContext(session.user.id);
            } else {
                setHouseholdId(null);
                setDisplayName(null);
            }
            setIsLoading(false);
        });

        return () => subscription.unsubscribe();
    }, [setSession, setUser, setIsLoading, setHouseholdId, setDisplayName]);

    return <>{children}</>;
}
