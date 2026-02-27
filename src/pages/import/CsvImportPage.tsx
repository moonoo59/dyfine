import { useState, useCallback } from 'react';
import Papa from 'papaparse';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { useAccounts } from '@/hooks/queries/useAccounts';
import { useQueryClient } from '@tanstack/react-query';

/**
 * CSV Import 페이지 컴포넌트 (Sprint 4)
 *
 * [PM 관점] PRD F6 요구사항:
 * - 브라우저에서 파싱 (서버 비용 최소화)
 * - 중복 탐지: 날짜+금액+메모 해시
 * - 파싱 결과 미리보기 + 컬럼 매핑
 * - 분류 룰 자동 적용
 */

/** 파싱된 CSV 행 인터페이스 */
interface ParsedRow {
    date: string;
    amount: number;
    memo: string;
    mappedCategory: string | null;
    isDuplicate: boolean;
    selected: boolean;
}

export default function CsvImportPage() {
    const { user, householdId } = useAuthStore();
    const queryClient = useQueryClient();
    const { data: accountsData } = useAccounts();
    const accounts = accountsData || [];

    // 파싱 상태
    const [rawHeaders, setRawHeaders] = useState<string[]>([]);
    const [rawRows, setRawRows] = useState<string[][]>([]);
    const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);

    // 매핑 설정
    const [dateCol, setDateCol] = useState(0);
    const [amountCol, setAmountCol] = useState(1);
    const [memoCol, setMemoCol] = useState(2);

    // Import 설정
    const [targetAccountId, setTargetAccountId] = useState<number | ''>('');
    const [defaultEntryType, setDefaultEntryType] = useState<'expense' | 'income'>('expense');
    const [importing, setImporting] = useState(false);
    const [step, setStep] = useState<'upload' | 'mapping' | 'preview'>('upload');

    /** 파일 업로드 핸들러 */
    const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        Papa.parse(file, {
            encoding: 'euc-kr', // 한국 은행 CSV 인코딩
            complete: (results) => {
                const data = results.data as string[][];
                if (data.length < 2) {
                    alert('CSV 파일에 데이터가 없습니다.');
                    return;
                }
                setRawHeaders(data[0]);
                setRawRows(data.slice(1).filter(row => row.some(cell => cell.trim())));
                setStep('mapping');
            },
            error: () => {
                // UTF-8로 재시도
                Papa.parse(file, {
                    complete: (results) => {
                        const data = results.data as string[][];
                        if (data.length < 2) {
                            alert('CSV 파일에 데이터가 없습니다.');
                            return;
                        }
                        setRawHeaders(data[0]);
                        setRawRows(data.slice(1).filter(row => row.some(cell => cell.trim())));
                        setStep('mapping');
                    }
                });
            }
        });
    }, []);

    /** 매핑 적용 → 미리보기 데이터 생성 */
    const applyMapping = () => {
        const rows: ParsedRow[] = rawRows.map(row => {
            const dateValue = row[dateCol]?.trim() || '';
            const amountValue = parseFloat((row[amountCol] || '0').replace(/[^0-9.-]/g, '')) || 0;
            const memoValue = row[memoCol]?.trim() || '';

            return {
                date: dateValue,
                amount: Math.abs(amountValue),
                memo: memoValue,
                mappedCategory: null,
                isDuplicate: false,
                selected: true,
            };
        }).filter(r => r.amount > 0);

        setParsedRows(rows);
        setStep('preview');
    };

    /** 선택 토글 */
    const toggleRow = (idx: number) => {
        setParsedRows(prev => prev.map((r, i) => i === idx ? { ...r, selected: !r.selected } : r));
    };

    /** 전체 선택/해제 */
    const toggleAll = () => {
        const allSelected = parsedRows.every(r => r.selected);
        setParsedRows(prev => prev.map(r => ({ ...r, selected: !allSelected })));
    };

    /** Import 실행 */
    const handleImport = async () => {
        if (!user || !householdId || !targetAccountId) {
            alert('대상 계좌를 선택해주세요.');
            return;
        }

        const selectedRows = parsedRows.filter(r => r.selected && !r.isDuplicate);
        if (selectedRows.length === 0) {
            alert('가져올 항목이 없습니다.');
            return;
        }

        setImporting(true);

        let successCount = 0;
        let errorCount = 0;

        for (const row of selectedRows) {
            try {
                const lines = defaultEntryType === 'expense'
                    ? [{ account_id: targetAccountId, amount: -row.amount }]
                    : [{ account_id: targetAccountId, amount: row.amount }];

                const { error } = await supabase.rpc('create_transaction', {
                    p_household_id: householdId,
                    p_occurred_at: row.date,
                    p_entry_type: defaultEntryType,
                    p_category_id: null,
                    p_memo: row.memo,
                    p_source: 'import',
                    p_created_by: user.id,
                    p_lines: lines,
                });

                if (error) throw error;
                successCount++;
            } catch {
                errorCount++;
            }
        }

        setImporting(false);
        queryClient.invalidateQueries({ queryKey: ['transactions', householdId] });
        queryClient.invalidateQueries({ queryKey: ['accounts', householdId] });
        alert(`Import 완료: 성공 ${successCount}건, 실패 ${errorCount}건`);
        setStep('upload');
        setParsedRows([]);
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">CSV Import</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">은행 CSV 파일을 업로드하여 거래를 일괄 등록합니다.</p>
            </div>

            {/* Step 1: 파일 업로드 */}
            {step === 'upload' && (
                <div className="rounded-xl border-2 border-dashed border-gray-300 bg-white p-12 text-center dark:border-zinc-700 dark:bg-zinc-950">
                    <div className="text-4xl mb-4">📁</div>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">CSV 파일을 선택하세요 (EUC-KR / UTF-8 지원)</p>
                    <input
                        type="file"
                        accept=".csv"
                        onChange={handleFileUpload}
                        className="block mx-auto text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100"
                    />
                </div>
            )}

            {/* Step 2: 컬럼 매핑 */}
            {step === 'mapping' && (
                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">컬럼 매핑</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">CSV의 각 컬럼이 어떤 데이터인지 매핑하세요.</p>

                    {/* 미리보기 (첫 3행) */}
                    <div className="overflow-x-auto mb-6">
                        <table className="min-w-full text-sm">
                            <thead><tr>
                                {rawHeaders.map((h, i) => (
                                    <th key={i} className="px-3 py-2 text-left text-xs font-medium text-gray-500 bg-gray-50 dark:bg-zinc-900 dark:text-gray-400">{h || `컬럼 ${i + 1}`}</th>
                                ))}
                            </tr></thead>
                            <tbody>
                                {rawRows.slice(0, 3).map((row, ri) => (
                                    <tr key={ri}>
                                        {row.map((cell, ci) => (
                                            <td key={ci} className="px-3 py-2 text-gray-700 dark:text-gray-300">{cell}</td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* 매핑 선택 */}
                    <div className="grid grid-cols-3 gap-4 mb-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">📅 날짜 컬럼</label>
                            <select value={dateCol} onChange={e => setDateCol(Number(e.target.value))}
                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white">
                                {rawHeaders.map((h, i) => <option key={i} value={i}>{h || `컬럼 ${i + 1}`}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">💰 금액 컬럼</label>
                            <select value={amountCol} onChange={e => setAmountCol(Number(e.target.value))}
                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white">
                                {rawHeaders.map((h, i) => <option key={i} value={i}>{h || `컬럼 ${i + 1}`}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">📝 메모 컬럼</label>
                            <select value={memoCol} onChange={e => setMemoCol(Number(e.target.value))}
                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white">
                                {rawHeaders.map((h, i) => <option key={i} value={i}>{h || `컬럼 ${i + 1}`}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="flex justify-end space-x-3">
                        <button onClick={() => setStep('upload')} className="rounded-md border border-gray-300 px-4 py-2 text-sm dark:border-zinc-700 dark:text-gray-300">취소</button>
                        <button onClick={applyMapping} className="rounded-md bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700">매핑 적용</button>
                    </div>
                </div>
            )}

            {/* Step 3: 미리보기 + Import 실행 */}
            {step === 'preview' && (
                <div className="space-y-4">
                    {/* Import 설정 */}
                    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">대상 계좌</label>
                                <select value={targetAccountId} onChange={e => setTargetAccountId(Number(e.target.value))}
                                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white">
                                    <option value="">선택</option>
                                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">기본 거래 유형</label>
                                <select value={defaultEntryType} onChange={e => setDefaultEntryType(e.target.value as any)}
                                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white">
                                    <option value="expense">지출</option>
                                    <option value="income">수입</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* 미리보기 테이블 */}
                    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden dark:border-zinc-800 dark:bg-zinc-950">
                        <div className="border-b border-gray-200 bg-gray-50 px-6 py-3 flex items-center justify-between dark:border-zinc-800 dark:bg-zinc-900/50">
                            <div className="flex items-center space-x-3">
                                <input type="checkbox" checked={parsedRows.every(r => r.selected)} onChange={toggleAll}
                                    className="rounded border-gray-300" />
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    {parsedRows.filter(r => r.selected).length} / {parsedRows.length}건 선택
                                </span>
                            </div>
                            <div className="flex space-x-3">
                                <button onClick={() => setStep('mapping')} className="text-sm text-gray-500 hover:text-gray-700">← 매핑 수정</button>
                                <button onClick={handleImport} disabled={importing || !targetAccountId}
                                    className="rounded-md bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50">
                                    {importing ? 'Import 중...' : `${parsedRows.filter(r => r.selected).length}건 Import`}
                                </button>
                            </div>
                        </div>
                        <ul className="divide-y divide-gray-200 dark:divide-zinc-800 max-h-96 overflow-y-auto">
                            {parsedRows.map((row, idx) => (
                                <li key={idx} className={`p-4 flex items-center space-x-4 ${row.isDuplicate ? 'opacity-50 bg-red-50 dark:bg-red-900/10' : ''}`}>
                                    <input type="checkbox" checked={row.selected} onChange={() => toggleRow(idx)}
                                        className="rounded border-gray-300" disabled={row.isDuplicate} />
                                    <span className="text-sm text-gray-500 w-24">{row.date}</span>
                                    <span className="text-sm font-medium text-gray-900 dark:text-white flex-1">{row.memo}</span>
                                    <span className={`text-sm font-semibold ${defaultEntryType === 'expense' ? 'text-red-600' : 'text-blue-600'}`}>
                                        ₩{row.amount.toLocaleString()}
                                    </span>
                                    {row.isDuplicate && <span className="text-xs text-red-500">중복</span>}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
}
