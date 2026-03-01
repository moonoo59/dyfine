import { useState, useEffect } from 'react';
import { RadialBarChart, RadialBar, ResponsiveContainer, PolarAngleAxis } from 'recharts';

interface GoalWidgetProps {
    currentAmount: number;
    title: string;
}

export function GoalWidget({ currentAmount, title }: GoalWidgetProps) {
    const [targetAmount, setTargetAmount] = useState(100000000); // Default 1억
    const [isEditing, setIsEditing] = useState(false);
    const [tempTarget, setTempTarget] = useState('');

    useEffect(() => {
        const saved = localStorage.getItem('dyfine-goal');
        if (saved) setTargetAmount(Number(saved));
    }, []);

    const handleSaveGoal = () => {
        const value = Number(tempTarget);
        if (value > 0) {
            setTargetAmount(value);
            localStorage.setItem('dyfine-goal', value.toString());
        }
        setIsEditing(false);
    };
    const safeTarget = targetAmount > 0 ? targetAmount : 1;
    const rawProgress = (currentAmount / safeTarget) * 100;
    const progress = Math.min(Math.max(rawProgress, 0), 100);

    const data = [
        {
            name: title,
            value: progress,
            fill: progress >= 100 ? '#10b981' : '#6366f1', // Green if done, Indigo otherwise
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
            >
                ⚙️
            </button>
            <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{title}</p>
                {isEditing ? (
                    <div className="mt-2 flex space-x-2">
                        <input
                            type="number"
                            value={tempTarget}
                            onChange={(e) => setTempTarget(e.target.value)}
                            className="w-full text-sm rounded-md border-gray-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white px-2 py-1"
                            placeholder="목표 금액"
                        />
                        <button onClick={handleSaveGoal} className="text-sm bg-indigo-600 text-white px-3 py-1 rounded">저장</button>
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
                            background={{ fill: '#e5e7eb' }} // Tailwind gray-200
                            dataKey="value"
                            cornerRadius={10}
                        />
                    </RadialBarChart>
                </ResponsiveContainer>
                {/* 텍스트 퍼센티지 중앙 하단 배치 */}
                <div className="absolute bottom-0 left-0 right-0 flex items-end justify-center pb-2">
                    <span className="text-xl font-bold text-gray-900 dark:text-white">
                        {progress.toFixed(1)}%
                    </span>
                </div>
            </div>
        </div>
    );
}
