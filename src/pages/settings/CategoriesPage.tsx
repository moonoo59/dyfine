import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { useCategories } from '@/hooks/queries/useCategories';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';

/**
 * 기본 카테고리 세트 (대분류 → 소분류 트리)
 * [PM] 한국 가계부 표준 + 독일 생활 + 반려동물(오구) 특화
 */
const DEFAULT_CATEGORIES: { name: string; type: 'expense' | 'income' | 'both'; children: string[] }[] = [
    { name: '생활비', type: 'expense', children: ['식비', '생필품', '카페/음료', '배달비', '마트/장보기'] },
    { name: '주거비', type: 'expense', children: ['월세', '관리비', '수도/전기/가스', '인터넷/핸드폰', '가구/인테리어'] },
    { name: '교통/차량', type: 'expense', children: ['대중교통', '주유비', '보험료(차)', '수리/정비', '주차비', 'DB 기차'] },
    { name: '오구 (반려)', type: 'expense', children: ['사료/간식', '병원/약', '미용/목욕', '장난감/용품', '훈트가르텐', '보험료(펫)'] },
    { name: '여가/문화', type: 'expense', children: ['외식', '여행', '취미/운동', '구독서비스', '의류/쇼핑'] },
    { name: '의료/건강', type: 'expense', children: ['병원비', '약국', '보험(건강)', '운동/헬스'] },
    { name: '교육', type: 'expense', children: ['학원/강의', '도서', '자격증', '어학'] },
    { name: '보험/세금', type: 'expense', children: ['소득세', '건강보험', '연금', '기타보험'] },
    { name: '기타 지출', type: 'expense', children: ['경조사비', '기부', '수수료', '미분류'] },
    { name: '수입', type: 'income', children: ['급여', '부수입', '이자/배당', '환급', '기타수입'] },
];

export default function CategoriesPage() {
    const { user, householdId } = useAuthStore();
    const queryClient = useQueryClient();

    // React Query
    const { data: categoriesData, isLoading } = useCategories();
    const categories = categoriesData || [];

    // 분류: L1 (대분류)와 L2 (소분류)
    const l1Categories = categories.filter(c => !c.parent_id);
    const l2Categories = categories.filter(c => c.parent_id);

    // 모달 상태 (추가/수정)
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [name, setName] = useState('');
    const [parentId, setParentId] = useState<number | null>(null);
    // E-09: 지출/수입별 카테고리 구분
    const [categoryType, setCategoryType] = useState<'expense' | 'income' | 'both'>('expense');
    // 기본 카테고리 적용 중 상태
    const [isApplying, setIsApplying] = useState(false);

    /**
     * 기본 카테고리 세트 일괄 적용
     * [Backend] 대분류 insert → 반환 ID로 소분류 insert
     */
    const handleApplyDefaults = async () => {
        if (!user || !householdId) return;
        if (!confirm('기본 카테고리 세트를 적용하시겠습니까?\n(기존 카테고리는 유지됩니다)')) return;

        setIsApplying(true);
        try {
            for (const group of DEFAULT_CATEGORIES) {
                // 1. 대분류 생성
                const { data: parentData, error: parentError } = await supabase
                    .from('categories')
                    .insert([{
                        household_id: householdId,
                        name: group.name,
                        parent_id: null,
                        category_type: group.type,
                        is_active: true,
                    }])
                    .select('id')
                    .single();

                if (parentError) {
                    console.error(`대분류 '${group.name}' 생성 실패:`, parentError);
                    continue; // 이미 존재하면 skip
                }

                // 2. 소분류 배치 생성
                if (parentData && group.children.length > 0) {
                    const childRows = group.children.map(childName => ({
                        household_id: householdId,
                        name: childName,
                        parent_id: parentData.id,
                        category_type: group.type,
                        is_active: true,
                    }));
                    const { error: childError } = await supabase
                        .from('categories')
                        .insert(childRows);
                    if (childError) {
                        console.error(`소분류 생성 실패 (${group.name}):`, childError);
                    }
                }
            }

            queryClient.invalidateQueries({ queryKey: ['categories', householdId] });
            toast.success('기본 카테고리 세트가 적용되었습니다! 🎉');
        } catch (err: any) {
            console.error('카테고리 일괄 적용 오류:', err);
            toast.error('카테고리 적용 중 오류가 발생했습니다.');
        } finally {
            setIsApplying(false);
        }
    };

    /**
     * 카테고리 삭제 핸들러
     * [Backend] 하위 소분류도 함께 삭제됨 (CASCADE 설정 확인 필요)
     */
    const handleDelete = async (id: number, catName: string) => {
        if (!confirm(`'${catName}' 카테고리를 삭제하시겠습니까?\n(하위 소분류도 함께 삭제됩니다)`)) return;

        const { error } = await supabase
            .from('categories')
            .delete()
            .eq('id', id);

        if (!error) {
            queryClient.invalidateQueries({ queryKey: ['categories', householdId] });
            toast.success(`'${catName}' 카테고리가 삭제되었습니다.`);
        } else {
            toast.error('삭제 실패: ' + error.message);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !householdId || !name.trim()) return;

        const { error } = await supabase
            .from('categories')
            .insert([{
                household_id: householdId,
                name: name,
                parent_id: parentId,
                category_type: categoryType,
                is_active: true
            }]);

        if (!error) {
            setIsModalOpen(false);
            setName('');
            setParentId(null);
            setCategoryType('expense');

            // 캐시 무효화로 즉시 리로드
            if (householdId) {
                queryClient.invalidateQueries({ queryKey: ['categories', householdId] });
            }
            toast.success('카테고리가 성공적으로 저장되었습니다.');
        } else {
            toast.error('카테고리 저장 실패: ' + error.message);
        }
    };

    if (isLoading) {
        return <div className="text-zinc-500 p-8">데이터를 불러오는 중...</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">카테고리 관리</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">수입과 지출 내역을 분류할 기준(대분류, 소분류)을 설정합니다.</p>
                </div>
                <div className="flex items-center space-x-3">
                    <button
                        onClick={handleApplyDefaults}
                        disabled={isApplying}
                        className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-gray-300 dark:hover:bg-zinc-700 disabled:opacity-50"
                    >
                        {isApplying ? '적용 중...' : '📋 기본 세트 적용'}
                    </button>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
                    >
                        새 카테고리 추가
                    </button>
                </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden dark:border-zinc-800 dark:bg-zinc-950">
                <ul role="list" className="divide-y divide-gray-200 dark:divide-zinc-800">
                    {l1Categories.length === 0 ? (
                        <li className="p-8 text-center text-sm text-gray-500">등록된 카테고리가 없습니다.</li>
                    ) : (
                        l1Categories.map(l1 => (
                            <li key={l1.id} className="p-4 hover:bg-gray-50 dark:hover:bg-zinc-900/50">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center space-x-2">
                                        <span className="font-semibold text-gray-900 dark:text-white">{l1.name}</span>
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${l1.category_type === 'income' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                            : l1.category_type === 'both' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                                                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                            }`}>
                                            {l1.category_type === 'income' ? '수입' : l1.category_type === 'both' ? '공통' : '지출'}
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => handleDelete(l1.id, l1.name)}
                                        className="text-xs text-red-400 hover:text-red-600 dark:hover:text-red-300"
                                    >
                                        삭제
                                    </button>
                                </div>
                                <div className="ml-4 space-y-2 border-l-2 border-gray-100 dark:border-zinc-800 pl-4">
                                    {l2Categories.filter(l2 => l2.parent_id === l1.id).map(l2 => (
                                        <div key={l2.id} className="text-sm text-gray-600 dark:text-gray-400 flex items-center justify-between">
                                            <span>{l2.name}</span>
                                            <button
                                                onClick={() => handleDelete(l2.id, l2.name)}
                                                className="text-xs text-red-400 hover:text-red-600 dark:hover:text-red-300"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    ))}
                                    {l2Categories.filter(l2 => l2.parent_id === l1.id).length === 0 && (
                                        <div className="text-xs text-gray-400 italic">하위 소분류가 없습니다.</div>
                                    )}
                                </div>
                            </li>
                        ))
                    )}
                </ul>
            </div>

            {/* 생성 모달 */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">새 카테고리 추가</h2>
                        <form onSubmit={handleSave} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">카테고리 이름</label>
                                <input
                                    type="text"
                                    required
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                                    placeholder="예) 식비"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">소속 대분류 (선택)</label>
                                <select
                                    value={parentId || ''}
                                    onChange={e => setParentId(e.target.value ? Number(e.target.value) : null)}
                                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                                >
                                    <option value="">(최상위 대분류로 생성)</option>
                                    {l1Categories.map(l1 => (
                                        <option key={l1.id} value={l1.id}>{l1.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* E-09: 지출/수입 구분 */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">유형</label>
                                <div className="mt-1 flex space-x-3">
                                    <button type="button" onClick={() => setCategoryType('expense')}
                                        className={`flex-1 py-2 text-sm rounded-md border ${categoryType === 'expense' ? 'border-red-500 bg-red-50 text-red-700 font-bold dark:bg-red-900/20 dark:text-red-400'
                                            : 'border-gray-300 text-gray-500 dark:border-zinc-700 dark:text-gray-400'
                                            }`}>지출</button>
                                    <button type="button" onClick={() => setCategoryType('income')}
                                        className={`flex-1 py-2 text-sm rounded-md border ${categoryType === 'income' ? 'border-blue-500 bg-blue-50 text-blue-700 font-bold dark:bg-blue-900/20 dark:text-blue-400'
                                            : 'border-gray-300 text-gray-500 dark:border-zinc-700 dark:text-gray-400'
                                            }`}>수입</button>
                                    <button type="button" onClick={() => setCategoryType('both')}
                                        className={`flex-1 py-2 text-sm rounded-md border ${categoryType === 'both' ? 'border-purple-500 bg-purple-50 text-purple-700 font-bold dark:bg-purple-900/20 dark:text-purple-400'
                                            : 'border-gray-300 text-gray-500 dark:border-zinc-700 dark:text-gray-400'
                                            }`}>공통</button>
                                </div>
                            </div>

                            <div className="mt-6 flex justify-end space-x-3">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                                >
                                    취소
                                </button>
                                <button
                                    type="submit"
                                    className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    저장
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
