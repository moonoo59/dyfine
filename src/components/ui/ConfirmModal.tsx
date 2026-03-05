import Modal from './Modal';

/**
 * 커스텀 확인 다이얼로그 컴포넌트
 * - 브라우저 기본 confirm() 대체
 * - 다크모드 지원, ESC/오버레이 클릭으로 취소
 */
interface ConfirmModalProps {
    /** 모달 열림 상태 */
    isOpen: boolean;
    /** 확인 버튼 클릭 핸들러 */
    onConfirm: () => void;
    /** 취소 버튼 클릭 핸들러 */
    onCancel: () => void;
    /** 메시지 제목 */
    title?: string;
    /** 상세 메시지 */
    message: string;
    /** 확인 버튼 라벨 (기본: 확인) */
    confirmLabel?: string;
    /** 확인 버튼 색상 (기본: 빨강 = 삭제용) */
    confirmVariant?: 'danger' | 'primary';
}

export default function ConfirmModal({
    isOpen,
    onConfirm,
    onCancel,
    title = '확인',
    message,
    confirmLabel = '확인',
    confirmVariant = 'danger',
}: ConfirmModalProps) {
    return (
        <Modal isOpen={isOpen} onClose={onCancel} maxWidth="max-w-sm">
            <div className="space-y-4">
                {/* 경고 아이콘 */}
                <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${confirmVariant === 'danger' ? 'bg-red-100 dark:bg-red-900/30' : 'bg-indigo-100 dark:bg-indigo-900/30'}`}>
                        {confirmVariant === 'danger' ? (
                            <svg className="h-5 w-5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                            </svg>
                        ) : (
                            <svg className="h-5 w-5 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
                            </svg>
                        )}
                    </div>
                    <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{message}</p>
                    </div>
                </div>

                {/* 버튼 영역 */}
                <div className="flex justify-end gap-3 pt-2">
                    <button
                        onClick={onCancel}
                        className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-zinc-700 dark:text-gray-300 dark:hover:bg-zinc-800"
                    >
                        취소
                    </button>
                    <button
                        onClick={onConfirm}
                        className={`rounded-md px-4 py-2 text-sm font-medium text-white ${confirmVariant === 'danger'
                                ? 'bg-red-600 hover:bg-red-700'
                                : 'bg-indigo-600 hover:bg-indigo-700'
                            }`}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </Modal>
    );
}
