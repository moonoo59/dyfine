import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { useCategories } from '@/hooks/queries/useCategories';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';

/** 분류 룰 인터페이스 */
interface ClassificationRule {
    id: number;
    household_id: string;
    pattern: string;
    category_id: number | null;
    tag_ids: number[];
    priority: number;
    is_active: boolean;
    category?: { name: string };
}

/**
 * 분류 룰 관리 페이지 (Sprint 4)
 *
 * [PM 관점] Wireframe 3.12 Rules:
 * - 패턴 → 카테고리/태그 자동 부착 규칙 CRUD
 * - 우선순위 기반 정렬
 * - 활성/비활성 토글
 */
export default function ClassificationRulesPage() {
    const { householdId } = useAuthStore();
    const queryClient = useQueryClient();
    const { data: categoriesData } = useCategories();
    const categories = categoriesData || [];

    // 룰 목록 조회
    const { data: rules, isLoading } = useQuery<ClassificationRule[]>({
        queryKey: ['classification_rules', householdId],
        queryFn: async () => {
            if (!householdId) throw new Error('No household ID');
            const { data, error } = await supabase
                .from('classification_rules')
                .select('*, category:categories(name)')
                .eq('household_id', householdId)
                .order('priority', { ascending: true });
            if (error) throw error;
            return data as ClassificationRule[];
        },
        enabled: !!householdId,
        staleTime: 1000 * 60 * 5,
    });

    // 모달 상태
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [pattern, setPattern] = useState('');
    const [categoryId, setCategoryId] = useState<number | ''>('');
    const [priority, setPriority] = useState(100);

    /** 새 룰 모달 열기 */
    const openNewModal = () => {
        setEditingId(null);
        setPattern('');
        setCategoryId('');
        setPriority(100);
        setIsModalOpen(true);
    };

    /** 수정 모달 열기 */
    const openEditModal = (rule: ClassificationRule) => {
        setEditingId(rule.id);
        setPattern(rule.pattern);
        setCategoryId(rule.category_id || '');
        setPriority(rule.priority);
        setIsModalOpen(true);
    };

    /** 룰 저장 (추가/수정) */
    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!householdId || !pattern.trim()) return;

        if (editingId) {
            // 수정
            const { error } = await supabase
                .from('classification_rules')
                .update({ pattern, category_id: categoryId || null, priority })
                .eq('id', editingId);
            if (error) { toast.error('수정 실패: ' + error.message); return; }
            toast.success('룰이 수정되었습니다.');
        } else {
            // 추가
            const { error } = await supabase
                .from('classification_rules')
                .insert([{ household_id: householdId, pattern, category_id: categoryId || null, priority, is_active: true, tag_ids: [] }]);
            if (error) { toast.error('추가 실패: ' + error.message); return; }
            toast.success('새 룰이 추가되었습니다.');
        }

        setIsModalOpen(false);
        queryClient.invalidateQueries({ queryKey: ['classification_rules', householdId] });
    };

    /** 룰 삭제 */
    const handleDelete = async (id: number) => {
        if (!confirm('이 룰을 삭제하시겠습니까?')) return;
        const { error } = await supabase.from('classification_rules').delete().eq('id', id);
        if (error) { toast.error('삭제 실패: ' + error.message); return; }
        toast.success('룰이 삭제되었습니다.');
        queryClient.invalidateQueries({ queryKey: ['classification_rules', householdId] });
    };

    /** 활성/비활성 토글 */
    const toggleActive = async (id: number, currentState: boolean) => {
        const { error } = await supabase
            .from('classification_rules')
            .update({ is_active: !currentState })
            .eq('id', id);
        if (error) { toast.error('상태 변경 실패: ' + error.message); return; }
        queryClient.invalidateQueries({ queryKey: ['classification_rules', householdId] });
    };

    if (isLoading) return <div className="p-8 text-center text-zinc-500">데이터를 불러오는 중...</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">분류 룰 관리</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">메모 패턴에 따라 자동으로 카테고리를 부착하는 규칙입니다.</p>
                </div>
                <button onClick={openNewModal}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700">
                    새 룰 추가
                </button>
            </div>

            {/* 룰 리스트 */}
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden dark:border-zinc-800 dark:bg-zinc-950">
                {!rules || rules.length === 0 ? (
                    <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
                        등록된 분류 룰이 없습니다.
                    </div>
                ) : (
                    <ul className="divide-y divide-gray-200 dark:divide-zinc-800">
                        {rules.map(rule => (
                            <li key={rule.id} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-zinc-900/50">
                                <div className="flex items-center space-x-4">
                                    {/* 활성 토글 */}
                                    <button onClick={() => toggleActive(rule.id, rule.is_active)}
                                        className={`w-8 h-5 rounded-full transition-colors ${rule.is_active ? 'bg-green-500' : 'bg-gray-300 dark:bg-zinc-700'}`}>
                                        <span className={`block w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-transform ${rule.is_active ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                                    </button>

                                    <div>
                                        <span className="font-medium text-gray-900 dark:text-white">{rule.pattern}</span>
                                        <span className="ml-2 text-sm text-gray-500">→ {rule.category?.name || '(미지정)'}</span>
                                    </div>

                                    <span className="text-xs text-gray-400">우선순위: {rule.priority}</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <button onClick={() => openEditModal(rule)}
                                        className="text-sm text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">수정</button>
                                    <button onClick={() => handleDelete(rule.id)}
                                        className="text-sm text-red-500 hover:text-red-400">삭제</button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {/* 룰 추가/수정 모달 */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">{editingId ? '룰 수정' : '새 룰 추가'}</h3>
                        <form onSubmit={handleSave} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">패턴 (메모에 포함되면 매칭)</label>
                                <input type="text" value={pattern} onChange={e => setPattern(e.target.value)}
                                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                                    placeholder="예: 생활비, 카드할부, 급여..." required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">매핑 카테고리</label>
                                <select value={categoryId} onChange={e => setCategoryId(Number(e.target.value) || '')}
                                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white">
                                    <option value="">미지정</option>
                                    {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">우선순위 (낮을수록 먼저 적용)</label>
                                <input type="number" value={priority} onChange={e => setPriority(Number(e.target.value))}
                                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white" />
                            </div>
                            <div className="flex justify-end space-x-3">
                                <button type="button" onClick={() => setIsModalOpen(false)}
                                    className="rounded-md border border-gray-300 px-4 py-2 text-sm dark:border-zinc-700 dark:text-gray-300">취소</button>
                                <button type="submit"
                                    className="rounded-md bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700">저장</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
