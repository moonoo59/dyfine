import { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase/client';
import LoginPage from '@/pages/auth/LoginPage';
import OnboardingPage from '@/pages/onboarding/OnboardingPage';
import AppLayout from '@/components/layout/AppLayout';
import AccountsPage from '@/pages/accounts/AccountsPage';
import CategoriesPage from '@/pages/settings/CategoriesPage';
import TransactionsPage from '@/pages/transactions/TransactionsPage';
import TransfersPage from '@/pages/transfers/TransfersPage';
import BudgetsPage from '@/pages/budgets/BudgetsPage';
import ClosingPage from '@/pages/closing/ClosingPage';
import DashboardPage from '@/pages/dashboard/DashboardPage';
import CsvImportPage from '@/pages/import/CsvImportPage';
import ClassificationRulesPage from '@/pages/settings/ClassificationRulesPage';
import ReportsPage from '@/pages/reports/ReportsPage';
import NotificationsPage from '@/pages/notifications/NotificationsPage';

const Loading = () => <div className="flex h-screen items-center justify-center text-lg font-medium text-zinc-500">Loading...</div>;

function App() {
    const { user, isLoading } = useAuthStore();
    const [hasHousehold, setHasHousehold] = useState<boolean | null>(null);
    const [checkingHousehold, setCheckingHousehold] = useState(false);

    // 사용자가 로그인되면, 소속된 가구(Household)가 있는지 검사합니다.
    useEffect(() => {
        if (!user) {
            setHasHousehold(null);
            return;
        }

        const checkHousehold = async () => {
            setCheckingHousehold(true);
            try {
                const { data, error } = await supabase
                    .from('household_members')
                    .select('household_id')
                    .eq('user_id', user.id)
                    .limit(1)
                    .maybeSingle();

                if (error) throw error;
                setHasHousehold(!!data); // 값이 있으면 true, 없으면 false
            } catch (err: any) {
                console.error('Household check error:', err.message);
                setHasHousehold(false);
            } finally {
                setCheckingHousehold(false);
            }
        };

        checkHousehold();
    }, [user]);

    if (isLoading || (user && checkingHousehold)) {
        return <Loading />;
    }

    return (
        <div className="min-h-screen bg-white font-sans antialiased dark:bg-zinc-950">
            <Routes>
                {/* 비로그인 유저는 로그인 페이지로 */}
                <Route
                    path="/login"
                    element={!user ? <LoginPage /> : <Navigate to="/" replace />}
                />

                {/* 로그인 유저는 Onboarding 여부에 따라 라우팅 */}
                {!user ? (
                    <Route path="*" element={<Navigate to="/login" replace />} />
                ) : !hasHousehold ? (
                    <Route path="*" element={<OnboardingPage onComplete={() => setHasHousehold(true)} />} />
                ) : (
                    <Route path="/" element={<AppLayout />}>
                        <Route index element={<DashboardPage />} />
                        <Route path="accounts" element={<AccountsPage />} />
                        <Route path="categories" element={<CategoriesPage />} />
                        <Route path="transactions" element={<TransactionsPage />} />
                        <Route path="transfers" element={<TransfersPage />} />
                        <Route path="budgets" element={<BudgetsPage />} />
                        <Route path="closing" element={<ClosingPage />} />
                        <Route path="import" element={<CsvImportPage />} />
                        <Route path="rules" element={<ClassificationRulesPage />} />
                        <Route path="reports" element={<ReportsPage />} />
                        <Route path="notifications" element={<NotificationsPage />} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Route>
                )}
            </Routes>
        </div>
    );
}

export default App;
