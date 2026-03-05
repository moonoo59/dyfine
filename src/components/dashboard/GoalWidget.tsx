import { useState, useEffect } from 'react';
import { RadialBarChart, RadialBar, ResponsiveContainer, PolarAngleAxis } from 'recharts';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';

interface GoalWidgetProps {
    currentAmount: number;
    title: string;
}

/**
 * 자산 목표 트래커 위젯 (Supabase DB 저장 버전)
 * - 목표 금액을 Supabase household_meta 테이블에 저장 (멀티 디바이스 동기화)
 * - localStorage 폴백 지원 (DB 연동 실패 시 로컬 유지)
 */
export function GoalWidget({ currentAmount, title }: GoalWidgetProps) {
    const { householdId } = useAuthStore();
    const [targetAmount, setTargetAmount] = useState(100000000); // 기본값 1억
    const [isEditing, setIsEditing] = useState(false);
    const [tempTarget, setTempTarget] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // 앱 시작 시 DB에서 목표 금액 로드 (없으면 localStorage 폴백)
    useEffect(() => {
        const loadGoal = async () => {
            // 1. localStorage 폴백 값 먼저 불러오기
            const localSaved = localStorage.getItem('dyfine-goal');
            if (localSaved) setTargetAmount(Number(localSaved));

            // 2. Supabase에서 목표 금액 조회 (household_settings 테이블 활용)
            if (!householdId) return;
            try {
                const { data } = await supabase
                    .from('household_settings')
                    .select('value')
                    .eq('household_id', householdId)
                    .eq('key', 'asset_goal')
                    .maybeSingle();

                if (data?.value) {
                    const dbGoal = Number(data.value);
                    if (dbGoal > 0) {
                        setTargetAmount(dbGoal);
                        localStorage.setItem('dyfine-goal', dbGoal.toString());
                    }
                }
            } catch {
                // DB 오류 시 로컬값 유지 (폴백)
            }
        };
        loadGoal();
    }, [householdId]);

    const handleSaveGoal = async () => {
        const value = Number(tempTarget);
        if (value <= 0) return;

        setIsSaving(true);
        setTargetAmount(value);
        localStorage.setItem('dyfine-goal', value.toString()); // 로컬 즉시 반영

        // Supabase upsert (household_settings 키-값 저장)
        if (householdId) {
            try {
                await supabase
                    .from('household_settings')
                    .upsert({
                        household_id: householdId,
                        key: 'asset_goal',
                        value: value.toString(),
                    }, { onConflict: 'household_id,key' });
            } catch {
                // 저장 실패해도 로컬에는 반영됨
            }
        }
        setIsSaving(false);
        setIsEditing(false);
    };

    const safeTarget = targetAmount > 0 ? targetAmount : 1;
    const rawProgress = (currentAmount / safeTarget) * 100;
    const progress = Math.min(Math.max(rawProgress, 0), 100);

    const data = [
        {
            name: title,
            value: progress,
            fill: progress >= 100 ? '#10b981' : '#6366f1',
        },
    ];

    return (
        <div className="flex h-full flex-col justify-between rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 relative group">
            <button
                onClick={() => {
                    setIsEditing(!isEditing);
                    setTempTarget(targetAmount.toString());
                }}
                className="absolute top-4 right-4 p-1 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity hover:text-gray-600 dark:hover:text-gray-300"
                title="목표 금액 수정"
            >
                ⚙️
            </button>
            <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{title}</p>
                {isEditing ? (
                    <div className="mt-2 flex space-x-2">
                        <input
                            type="text"
                            inputMode="numeric"
                            value={tempTarget}
                            onChange={(e) => setTempTarget(e.target.value.replace(/[^0-9]/g, ''))}
                            className="w-full text-sm rounded-md border-gray-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white px-2 py-1"
                            placeholder="목표 금액 (예: 100000000)"
                            autoFocus
                        />
                        <button
                            onClick={handleSaveGoal}
                            disabled={isSaving}
                            className="text-sm bg-indigo-600 text-white px-3 py-1 rounded whitespace-nowrap disabled:opacity-50"
                        >
                            {isSaving ? '저장 중...' : '저장'}
                        </button>
                    </div>
                ) : (
                    <div className="mt-1 flex items-baseline space-x-2">
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                            ₩{currentAmount.toLocaleString()}
                        </p>
                        <span className="text-sm font-medium text-gray-500">
                            / ₩{targetAmount.toLocaleString()}
                        </span>
                    </div>
                )}
            </div>

            <div className="relative mt-4 h-32 w-full flex-1">
                <ResponsiveContainer width="100%" height="100%">
                    <RadialBarChart
                        cx="50%"
                        cy="100%"
                        innerRadius="70%"
                        outerRadius="100%"
                        barSize={15}
                        data={data}
                        startAngle={180}
                        endAngle={0}
                    >
                        <PolarAngleAxis
                            type="number"
                            domain={[0, 100]}
                            angleAxisId={0}
                            tick={false}
                        />
                        <RadialBar
                            background={{ fill: '#e5e7eb' }}
                            dataKey="value"
                            cornerRadius={10}
                        />
                    </RadialBarChart>
                </ResponsiveContainer>
                <div className="absolute bottom-0 left-0 right-0 flex items-end justify-center pb-2">
                    <span className="text-xl font-bold text-gray-900 dark:text-white">
                        {progress.toFixed(1)}%
                    </span>
                </div>
            </div>
        </div>
    );
}
