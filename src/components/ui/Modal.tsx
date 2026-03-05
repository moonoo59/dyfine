import { useEffect } from 'react';
import { createPortal } from 'react-dom';

/**
 * 공통 Modal 컴포넌트
 * - Portal을 통해 DOM 최상단에 렌더링 (z-index 충돌 방지)
 * - ESC 키로 닫기 지원
 * - 오버레이 클릭으로 닫기 지원
 * - 다크모드 완벽 지원
 */
interface ModalProps {
    /** 모달 열림/닫힘 상태 */
    isOpen: boolean;
    /** 모달 닫기 핸들러 */
    onClose: () => void;
    /** 모달 제목 */
    title?: string;
    /** 모달 내용 */
    children: React.ReactNode;
    /** 최대 너비 클래스 (기본값: max-w-md) */
    maxWidth?: string;
}

export default function Modal({
    isOpen,
    onClose,
    title,
    children,
    maxWidth = 'max-w-md',
}: ModalProps) {
    // ESC 키로 모달 닫기
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleKeyDown);
        // body 스크롤 고정
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = '';
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    // Portal로 body에 직접 렌더링
    return createPortal(
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
        >
            {/* 오버레이 - 클릭 시 닫기 */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />
            {/* 모달 본체 */}
            <div className={`relative w-full ${maxWidth} rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900 max-h-[90vh] overflow-y-auto`}>
                {/* 헤더 */}
                {title && (
                    <div className="mb-4 flex items-center justify-between">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h2>
                        <button
                            onClick={onClose}
                            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-zinc-800 dark:hover:text-gray-300 transition-colors"
                        >
                            {/* X 아이콘 */}
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                )}
                {children}
            </div>
        </div>,
        document.body
    );
}
