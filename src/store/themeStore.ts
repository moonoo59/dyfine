import { create } from 'zustand';

interface ThemeState {
    theme: 'light' | 'dark';
    toggleTheme: () => void;
}

const getInitialTheme = (): 'light' | 'dark' => {
    if (typeof window !== 'undefined' && window.localStorage) {
        const storedPrefs = window.localStorage.getItem('dyfine-theme') as 'light' | 'dark';
        if (storedPrefs) {
            return storedPrefs;
        }
        const userMedia = window.matchMedia('(prefers-color-scheme: dark)');
        if (userMedia.matches) {
            return 'dark';
        }
    }
    return 'light'; // 기본은 light
};

export const useThemeStore = create<ThemeState>((set) => ({
    theme: getInitialTheme(),
    toggleTheme: () => set((state) => {
        const newTheme = state.theme === 'light' ? 'dark' : 'light';
        localStorage.setItem('dyfine-theme', newTheme);
        return { theme: newTheme };
    }),
}));
