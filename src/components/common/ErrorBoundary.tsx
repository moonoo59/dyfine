import { Component, type ReactNode, ErrorInfo } from 'react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        // 다음 렌더링에서 폴백 UI가 보이도록 상태를 업데이트 합니다.
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        // 에러 리포팅 서비스에 에러를 기록할 수 있습니다.
        console.error('Uncaught error:', error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            // 커스텀 폴백 UI를 렌더링할 수 있습니다.
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="flex h-screen w-full flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4">
                    <div className="max-w-md w-full rounded-2xl bg-white dark:bg-zinc-900 p-8 shadow-xl text-center border border-zinc-100 dark:border-zinc-800">
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20 mb-6">
                            <svg className="h-8 w-8 text-red-600 dark:text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">예상치 못한 오류가 발생했습니다</h2>
                        <p className="text-zinc-500 dark:text-zinc-400 mb-8 text-sm">
                            일시적인 문제일 수 있습니다. 화면을 새로고침하거나 잠시 후 다시 시도해 주세요.
                        </p>
                        <div className="flex justify-center gap-3">
                            <button
                                onClick={() => window.location.reload()}
                                className="rounded-xl bg-zinc-900 dark:bg-white px-6 py-3 font-medium text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors"
                            >
                                새로고침
                            </button>
                            <button
                                onClick={() => {
                                    this.setState({ hasError: false, error: null });
                                    window.location.href = '/';
                                }}
                                className="rounded-xl bg-zinc-100 dark:bg-zinc-800 px-6 py-3 font-medium text-zinc-900 dark:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                            >
                                홈으로 가기
                            </button>
                        </div>

                        {/* 개발 환경에서만 에러 상세 내용 표시 */}
                        {import.meta.env.DEV && this.state.error && (
                            <div className="mt-8 text-left bg-zinc-50 dark:bg-zinc-950 p-4 rounded-lg overflow-auto max-h-48 border border-zinc-200 dark:border-zinc-800">
                                <p className="text-xs font-mono text-red-500 font-bold mb-1">Error Details (Dev Only):</p>
                                <p className="text-xs font-mono text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
                                    {this.state.error.message}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
