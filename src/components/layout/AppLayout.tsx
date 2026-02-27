import { useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';

export default function AppLayout() {
    const { user, signOut } = useAuthStore();
    const navigate = useNavigate();
    const location = useLocation();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        signOut();
        navigate('/login');
    };

    // 메인 네비게이션 항목
    const mainNavItems = [
        { name: '대시보드', path: '/' },
        { name: '거래 내역', path: '/transactions' },
        { name: '자동 이체', path: '/transfers' },
        { name: '예산 관리', path: '/budgets' },
    ];

    // 설정 하위 메뉴 항목
    const settingsNavItems = [
        { name: '계좌 관리', path: '/accounts' },
        { name: '분류 관리', path: '/categories' },
    ];

    // 설정 메뉴 활성 여부 확인
    const isSettingsActive = settingsNavItems.some(item => location.pathname === item.path);

    return (
        <div className="flex min-h-screen flex-col bg-gray-50 dark:bg-zinc-900">
            {/* 1. 상단 네비게이션(GNB) */}
            <nav className="sticky top-0 z-50 border-b border-gray-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="flex h-16 justify-between">
                        <div className="flex">
                            <div className="flex flex-shrink-0 items-center">
                                <Link to="/" className="text-xl font-bold tracking-tighter text-indigo-600 dark:text-indigo-400">
                                    Dyfine
                                </Link>
                            </div>
                            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                                {mainNavItems.map((item) => {
                                    const isActive = location.pathname === item.path;
                                    return (
                                        <Link
                                            key={item.name}
                                            to={item.path}
                                            className={`inline-flex items-center border-b-2 px-1 pt-1 text-sm font-medium ${isActive
                                                ? 'border-indigo-500 text-gray-900 dark:text-white'
                                                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                                                }`}
                                        >
                                            {item.name}
                                        </Link>
                                    );
                                })}
                                {/* 설정 드롭다운 메뉴 */}
                                <div className="relative inline-flex items-center">
                                    <button
                                        onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                                        className={`inline-flex items-center border-b-2 px-1 pt-1 text-sm font-medium ${isSettingsActive
                                            ? 'border-indigo-500 text-gray-900 dark:text-white'
                                            : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                                            }`}
                                    >
                                        설정
                                        <svg className="ml-1 h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                                        </svg>
                                    </button>
                                    {isSettingsOpen && (
                                        <>
                                            {/* 클릭 외부 감지용 오버레이 */}
                                            <div className="fixed inset-0 z-10" onClick={() => setIsSettingsOpen(false)} />
                                            <div className="absolute left-0 top-full z-20 mt-1 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                                                {settingsNavItems.map((item) => (
                                                    <Link
                                                        key={item.name}
                                                        to={item.path}
                                                        onClick={() => setIsSettingsOpen(false)}
                                                        className={`block px-4 py-2 text-sm ${location.pathname === item.path
                                                            ? 'bg-indigo-50 text-indigo-700 dark:bg-zinc-800 dark:text-indigo-400'
                                                            : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-zinc-800'
                                                            }`}
                                                    >
                                                        {item.name}
                                                    </Link>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="hidden sm:ml-6 sm:flex sm:items-center sm:space-x-4">
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                                {user?.email}
                            </span>
                            <button
                                onClick={handleLogout}
                                className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-zinc-800 dark:text-white dark:ring-zinc-700 dark:hover:bg-zinc-700"
                            >
                                로그아웃
                            </button>
                        </div>

                        {/* 모바일 메뉴 토글 버튼 */}
                        <div className="flex items-center sm:hidden">
                            <button
                                type="button"
                                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                                className="inline-flex items-center justify-center rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500 dark:hover:bg-zinc-800"
                            >
                                <span className="sr-only">메뉴 열기</span>
                                {/* 햄버거 아이콘 */}
                                {isMobileMenuOpen ? (
                                    <svg className="block h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                ) : (
                                    <svg className="block h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                                    </svg>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* 모바일 메뉴 패널 */}
                {isMobileMenuOpen && (
                    <div className="sm:hidden border-t border-gray-200 dark:border-zinc-800">
                        <div className="space-y-1 pb-3 pt-2">
                            {mainNavItems.map((item) => {
                                const isActive = location.pathname === item.path;
                                return (
                                    <Link
                                        key={item.name}
                                        to={item.path}
                                        onClick={() => setIsMobileMenuOpen(false)}
                                        className={`block border-l-4 py-2 pl-3 pr-4 text-base font-medium ${isActive
                                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-zinc-800 dark:text-white'
                                            : 'border-transparent text-gray-500 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-zinc-800 dark:hover:text-gray-300'
                                            }`}
                                    >
                                        {item.name}
                                    </Link>
                                );
                            })}
                            {/* 모바일 설정 섹션 */}
                            <div className="border-t border-gray-100 dark:border-zinc-800 mt-2 pt-2">
                                <p className="px-3 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">설정</p>
                                {settingsNavItems.map((item) => {
                                    const isActive = location.pathname === item.path;
                                    return (
                                        <Link
                                            key={item.name}
                                            to={item.path}
                                            onClick={() => setIsMobileMenuOpen(false)}
                                            className={`block border-l-4 py-2 pl-6 pr-4 text-base font-medium ${isActive
                                                ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-zinc-800 dark:text-white'
                                                : 'border-transparent text-gray-500 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-zinc-800 dark:hover:text-gray-300'
                                                }`}
                                        >
                                            {item.name}
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="border-t border-gray-200 pb-3 pt-4 dark:border-zinc-800">
                            <div className="flex items-center px-4">
                                <div className="text-sm font-medium text-gray-500 dark:text-gray-400">{user?.email}</div>
                            </div>
                            <div className="mt-3 space-y-1">
                                <button
                                    onClick={handleLogout}
                                    className="block w-full px-4 py-2 text-left text-base font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-zinc-800 dark:hover:text-white"
                                >
                                    로그아웃
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </nav>

            {/* 2. 페이지 콘텐츠 렌더링 영역 (Outlet) */}
            <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
                <Outlet />
            </main>

        </div>
    );
}
