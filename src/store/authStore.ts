import { create } from 'zustand';
import type { User, Session } from '@supabase/supabase-js';

interface AuthState {
    user: User | null;
    session: Session | null;
    householdId: string | null;
    isLoading: boolean;
    setUser: (user: User | null) => void;
    setSession: (session: Session | null) => void;
    setHouseholdId: (householdId: string | null) => void;
    setIsLoading: (isLoading: boolean) => void;
    signOut: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    session: null,
    householdId: null,
    isLoading: true,
    setUser: (user) => set({ user }),
    setSession: (session) => set({ session }),
    setHouseholdId: (householdId) => set({ householdId }),
    setIsLoading: (isLoading) => set({ isLoading }),
    signOut: () => set({ user: null, session: null, householdId: null }),
}));
