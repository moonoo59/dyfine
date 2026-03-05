import { useState } from 'react';
import Modal from '@/components/ui/Modal';

type Marker = {
    top: string;
    left: string;
    width: string;
    height: string;
    label: string;
    description?: string;
};

type Section = {
    id: string;
    title: string;
    image: string;
    imageCrop?: {
        objectPosition: string;
        maxHeight: string;
    };
    markers?: Marker[];
    overview: string;
    features?: { title: string; desc: string }[];
    howToUse?: string[];
    tips?: string[];
    security?: string;
    note?: string;
};

const SECTIONS: Section[] = [
    {
        id: '1',
        title: '대시보드',
        image: '/manual_images/dashboard.png',
        imageCrop: { objectPosition: 'top center', maxHeight: '480px' },
        overview: '로그인 후 가장 먼저 보이는 화면입니다. 가구의 재정 현황을 한눈에 파악할 수 있습니다.',
        features: [
            { title: '자산 요약 카드', desc: '총 자산, 현금성 잔액, 투자 평가 자산을 실시간으로 표시' },
            { title: '현금흐름', desc: '이번 달 수입(근로/비정기), 대출, 고정지출, 변동지출, 가용 자금 집계' },
            { title: '자산 목표', desc: '총 자산 목표 대비 달성 현황을 시각화' },
            { title: '자금 흐름', desc: '최근 자금 이동(이체) 내역을 타임라인으로 표시' }
        ],
        tips: [
            '자산 요약 카드를 클릭하면 해당하는 계좌나 투자 페이지로 즉시 이동합니다.',
            '현금흐름은 거래 내역과 예산이 입력되면 자동으로 집계되어 표시됩니다.'
        ]
    },
    {
        id: '2',
        title: '거래 내역',
        image: '/manual_images/transactions.png',
        imageCrop: { objectPosition: 'top center', maxHeight: '500px' },
        markers: [
            { top: '3%', left: '82%', width: '15%', height: '8%', label: '빠른 추가', description: '클릭하여 새 거래를 등록합니다' },
            { top: '15%', left: '5%', width: '40%', height: '6%', label: '탭 & 필터', description: '탭 이동 및 검색 필터링' }
        ],
        overview: '모든 수입/지출 거래를 등록, 조회, 분류하는 핵심 기능입니다.',
        howToUse: [
            '우측 상단 [빠른 추가] 버튼을 클릭하세요.',
            '필수 항목(유형, 금액, 날짜, 계좌, 카테고리)을 정확히 입력합니다.',
            '선택 항목으로 메모와 태그를 추가하여 나중에 검색하기 쉽게 만듭니다.',
            '[저장]을 클릭하면 내역에 즉시 반영됩니다.'
        ],
        features: [
            { title: '탭 구분', desc: '전체 내역, 인박스(미분류), 즐겨찾기, Import 탭으로 효율적 관리 제공' },
            { title: '강력한 필터링', desc: '기간, 계좌, 카테고리, 키워드/태그명으로 상세 검색 가능' },
            { title: '입력자 표시', desc: '각 거래 목록에 👤 아이콘과 함께 입력한 사용자 이름이 표시됨' }
        ]
    },
    {
        id: '3',
        title: '자동 이체',
        image: '/manual_images/transfers.png',
        imageCrop: { objectPosition: 'top center', maxHeight: '450px' },
        markers: [
            { top: '3%', left: '80%', width: '15%', height: '8%', label: '새 규칙 추가', description: '정기 이체 규칙을 만듭니다' }
        ],
        overview: '정기적으로 발생하는 이체 규칙을 등록하고, 자동 감지된 이체를 간편하게 확인 및 확정합니다.',
        howToUse: [
            '[새 규칙 추가]를 클릭합니다.',
            '이체 이름과 금액, 출금 계좌, 입금 계좌를 설정합니다.',
            '매월/매주 등 주기를 설정하고 저장하면 해당 주기마다 시스템이 이체 내역 초안을 생성합니다.'
        ],
        features: [
            { title: '확인 대기 중인 이체', desc: '시스템에서 감지한 자동 이체 건이 목록 상단에 표시되며, 클릭 한 번으로 확정 가능합니다.' }
        ]
    },
    {
        id: '4',
        title: '예산 관리',
        image: '/manual_images/budgets.png',
        imageCrop: { objectPosition: 'top center', maxHeight: '450px' },
        overview: '카테고리별 월간 지출 한도를 설정하여 계획적인 소비 습관을 돕습니다.',
        howToUse: [
            '화면 최상단의 년-월 선택기로 예산을 설정할 특정 달을 고릅니다.',
            '[새 예산 설정] 버튼을 클릭하여 카테고리를 선택하고 지출 한도를 지정합니다.',
            '저장 후 해당 월의 실제 지출이 예산과 연동되어 실시간 소진율이 차트로 표기됩니다.'
        ],
        tips: [
            '예산을 초과하면 게이지 바가 붉은색으로 강조되어 직관적으로 경고합니다.',
            '이전 달의 예산 내역을 복사하여 다음 달에 그대로 적용하는 기능으로 시간을 단축할 수 있습니다.'
        ]
    },
    {
        id: '5',
        title: '대출 관리',
        image: '/manual_images/loans.png',
        imageCrop: { objectPosition: 'top center', maxHeight: '500px' },
        markers: [
            { top: '3%', left: '80%', width: '15%', height: '8%', label: '새 대출 등록', description: '새로운 대출 정보 입력' },
        ],
        overview: '가구의 모든 대출을 하나의 화면에 등록하고, 변동하는 금리 이력 및 월별 상환 스케줄을 체계적으로 관리합니다.',
        howToUse: [
            '[새 대출 등록]을 클릭하여 새 대출을 시작합니다.',
            '은행명, 원금, 시작일/만기일, 상환 방식(원리금균등 등)과 초기 금리를 정확히 입력합니다.',
            '대출을 이용 중 금리가 변동되면 좌측 목록에서 해당 대출을 선택 후 [금리 변경]을 통해 새 금리를 등록합니다.'
        ],
        features: [
            { title: '자동 상환 스케줄러', desc: '입력된 원금, 상환방식, 만기, 금리를 바탕으로 매월 상환해야 할 원금과 이자를 자동 계산합니다.' },
            { title: '원장(Ledger) 동기화', desc: '등록과 동시에 대출 초기 밸런스 원장이 자동 생성되어 자산 상태표(B/S)에 반영됩니다.' }
        ]
    },
    {
        id: '6',
        title: '투자 관리',
        image: '/manual_images/investments.png',
        imageCrop: { objectPosition: 'top center', maxHeight: '480px' },
        overview: '주식, 펀드, ETF 등 투자 자산을 등록하고 가구 차원의 포트폴리오를 관리합니다.',
        features: [
            { title: '보유 종목 관리', desc: '종목명, 매수단가, 수량을 등록하고 현재가를 입력해 수익률을 실시간 추적합니다.' },
            { title: '월별 스냅샷', desc: '매월 말 투자 자산의 총 가치를 기록하여 자산 변동 추이를 리포트로 확인합니다.' },
            { title: '투자기여금 추적', desc: '월간 투자 목표액 대비 실제 투입 금액을 기록 및 추적합니다.' }
        ]
    },
    {
        id: '7',
        title: '리포트',
        image: '/manual_images/reports.png',
        imageCrop: { objectPosition: 'top center', maxHeight: '480px' },
        overview: '누적된 재정 데이터를 기반으로 다각도 분석 보고서 및 시각화 차트를 제공합니다.',
        features: [
            { title: '월별 수입/지출 비교', desc: '최근 6개월 간의 현금흐름 추이를 막대 차트로 가시화' },
            { title: '카테고리별 지출 비중', desc: '이번 달 지출 내역을 파이 차트로 보여주어 문제 카테고리 식별' },
            { title: '자산 변동 추이', desc: '순자산의 증가/감소 트렌드를 꺾은선 그래프로 확인' },
            { title: '예산 대비 실적', desc: '계획(예산) 대비 실제 결과(지출)의 오차율을 분석 통계로 제공' }
        ]
    },
    {
        id: '8',
        title: '누리무무 (반려견)',
        image: '/manual_images/petcare.png',
        imageCrop: { objectPosition: 'top center', maxHeight: '450px' },
        overview: '반려견(오구)의 미용, 병원, 사료 등 전용 케어 일정과 발생 비용을 독립적으로 기록합니다.',
        howToUse: [
            '[새 기록 추가] 버튼을 클릭합니다.',
            '비용이 발생했거나 이벤트가 있던 날짜를 선택합니다.',
            '서비스 유형(미용, 병원 진료, 사료 구매 등)과 샵(업체명), 비용, 추가 메모를 남기고 저장합니다.'
        ],
        tips: [
            '비용 항목은 가구 전체의 거래 내역(Transactions)과는 별개의 뷰로 관리되어 혼선을 피합니다.',
            '정기적인 스케일링, 접종 또는 미용 주기를 파악하고 다음 일정을 예측하는 데 유용합니다.'
        ]
    },
    {
        id: '9',
        title: '용돈 관리',
        image: '/manual_images/allowance.png',
        imageCrop: { objectPosition: 'top center', maxHeight: '450px' },
        overview: '가구 구성원 각자의 개인 용돈을 관리합니다. 본인 계정으로 세팅된 데이터만 조회 가능한 안전한 분리 영역입니다.',
        note: '핵심 원리: 거래 내역에서 "{이름} 용돈" (예: 덕원 용돈) 카테고리로 기록된 지출 금액이 자동으로 이곳에 소진액으로 반영됩니다.',
        howToUse: [
            '이번 달 할당된 총 용돈(자동 집계)을 확인합니다.',
            '본인만의 [고정지출] (유튜브 프리미엄, 통신비 등) 항목을 [+ 항목 추가]를 눌러 수동 등록합니다.',
            '총 용돈에서 고정지출을 뺀 [자유 사용 잔액]을 기준으로 용돈 지출을 조절합니다.'
        ],
        security: '본인 외 타인 접근 불가: 데이터베이스 레벨(Row Level Security)에서 로그인 계정의 식별 키를 통해 다른 멤버의 용돈 데이터 조회가 완벽히 차단됩니다.'
    },
    {
        id: '10',
        title: '계좌 관리',
        image: '/manual_images/accounts.png',
        imageCrop: { objectPosition: 'top left', maxHeight: '500px' },
        markers: [
            { top: '3%', left: '80%', width: '15%', height: '8%', label: '계좌 추가', description: '새 계좌 생성' }
        ],
        overview: '가구의 모든 실물 금융 자산 계좌(은행 통장, 신용카드, 투자 계좌 등)를 등록하고 관리하는 베이스캠프입니다.',
        howToUse: [
            '[계좌 추가]를 클릭합니다.',
            '계좌명(별칭)과 은행명, 계좌번호(민감정보 마스킹 지원), 예금주 및 유형을 기입합니다.',
            '해당 계좌를 시작할 때의 [초기 잔액]을 입력해야 이후 내역이 정확히 계산됩니다.'
        ],
        features: [
            { title: '실시간 잔액 예측', desc: '초기 잔액에 지금까지 입력된 모든 거래 합계(수입-지출)를 더하여 현재 잔액을 자동 계산해 냅니다.' },
            { title: '유형별 관리', desc: '입출금 통장, 정기 적금, 자동이체 적금, 신용/체크카드, 비과세 투자 계좌 등으로 세분화 가능합니다.' }
        ]
    },
    {
        id: '11',
        title: '카테고리 관리',
        image: '/manual_images/categories.png',
        imageCrop: { objectPosition: 'top center', maxHeight: '480px' },
        markers: [
            { top: '33%', left: '80%', width: '15%', height: '8%', label: '소분류 추가', description: '해당 대분류에 소분류 항목을 즉시 추가(+)' }
        ],
        overview: '수입과 지출을 명확히 분류하기 위한 대분류 및 소분류 체계를 직접 설정합니다.',
        howToUse: [
            '처음 프로젝트를 세팅할 땐 우측 상단의 [📋 기본세트 적용] 버튼을 눌러 한국 표준 가계부 기준 카테고리를 자동 생성하세요.',
            '[새 카테고리 추가]를 눌러 대분류를 우선 작성하고, 상위 카테고리에 매핑시켜 소분류를 만듭니다.',
            '화면 상단의 [지출] / [수입] 탭을 눌러 각기 다른 성격의 카테고리들을 깔끔하게 분리하여 조회 및 편집합니다.'
        ]
    },
    {
        id: '12',
        title: '마이 프로필',
        image: '/manual_images/profile.png',
        imageCrop: { objectPosition: 'top center', maxHeight: '500px' },
        overview: '로그인 계정 정보 확인, 앱 내에서 쓰이는 고유 표시 이름 변경 및 보안을 위한 접속 비밀번호 통합 변경 페이지입니다.',
        features: [
            { title: '표시 이름 변경', desc: '사용할 닉네임(예: 덕원)을 지정하면 거래 내역 입력자 표시나 개인 용돈 관리의 {이름} 연동 키워드로 즉각 적용됩니다.' },
            { title: '안전한 비밀번호 변경', desc: '새 비밀번호를 설정하기 전 현재 비밀번호를 다시 확인하는 2단계 인증 방식으로 보안을 강화했습니다.' }
        ],
        security: '비밀번호가 성공적으로 변경되어도 강제 로그아웃 되지 않으므로 작업 중이던 흐름이 끊기지 않습니다.'
    }
];

export default function ManualPage() {
    const [selectedSection, setSelectedSection] = useState(SECTIONS[0].id);
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    const scrollToSection = (id: string) => {
        setSelectedSection(id);
        const element = document.getElementById(`section-${id}`);
        if (element) {
            // 헤더 고정 영역(스크롤 마진)을 위해 살짝 여유를 줌
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    return (
        <div className="flex flex-col lg:flex-row gap-8">
            {/* 좌측 목차 (고정형 사이드바) */}
            <aside className="lg:w-64 flex-shrink-0">
                <div className="sticky top-24 space-y-1 bg-white/50 backdrop-blur-sm dark:bg-zinc-950/50 p-2 rounded-xl border border-gray-100 dark:border-zinc-800/50 shadow-sm z-10">
                    <h2 className="mb-3 text-xs font-bold text-gray-400 uppercase tracking-widest px-3 flex items-center gap-2">
                        <span className="w-4 border-t border-gray-300 dark:border-zinc-700"></span>
                        목차
                        <span className="w-4 border-t border-gray-300 dark:border-zinc-700"></span>
                    </h2>
                    <ul className="space-y-1">
                        {SECTIONS.map((section) => (
                            <li key={section.id}>
                                <button
                                    onClick={() => scrollToSection(section.id)}
                                    className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-3 ${selectedSection === section.id
                                        ? 'bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300 dark:ring-indigo-800'
                                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200'
                                        }`}
                                >
                                    <span className={`flex items-center justify-center w-6 h-6 rounded-md text-xs ${selectedSection === section.id ? 'bg-indigo-100 dark:bg-indigo-900/60' : 'bg-gray-100 dark:bg-zinc-800'
                                        }`}>
                                        {section.id}
                                    </span>
                                    {section.title}
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            </aside>

            {/* 우측 본문 영역 */}
            <main className="flex-1 max-w-4xl space-y-16 pb-32">
                <header className="border-b border-gray-200 dark:border-zinc-800 pb-8 pt-4">
                    <div className="flex items-center gap-3 mb-4">
                        <span className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 px-3 py-1 rounded-full text-xs font-bold tracking-wide">
                            Dyfine v3.0
                        </span>
                        <span className="bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-400 px-3 py-1 rounded-full text-xs font-medium">
                            최종 업데이트: 2026-03-05
                        </span>
                    </div>
                    <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white mb-4 tracking-tight">
                        가계부 사용자 매뉴얼
                    </h1>
                    <p className="text-lg text-gray-500 dark:text-gray-400 leading-relaxed max-w-2xl">
                        Dyfine은 가구 단위의 재정을 통합 관리하고 가족의 목표를 함께 추적하는 프라이빗한 자산 관리 시스템입니다. 각 메뉴별 사용법과 유용한 팁을 확인해보세요.
                    </p>
                </header>

                <div className="space-y-20">
                    {SECTIONS.map((section) => (
                        <section
                            key={section.id}
                            id={`section-${section.id}`}
                            className={`scroll-mt-28 transition-opacity duration-500 ${selectedSection === section.id ? 'opacity-100' : 'opacity-40 hover:opacity-100'}`}
                            onClick={() => {
                                if (selectedSection !== section.id) setSelectedSection(section.id);
                            }}
                        >
                            {/* 섹션 제목 */}
                            <div className="flex items-center gap-4 mb-6">
                                <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-200 dark:shadow-none text-lg">
                                    {section.id}
                                </span>
                                <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
                                    {section.title}
                                </h2>
                            </div>

                            {/* 커스텀 스크린샷 뷰어 (CSS 크롭 & 오버레이 마킹) */}
                            <div className="mb-8 group relative rounded-2xl bg-gray-100 dark:bg-zinc-900 p-2 border border-gray-200 dark:border-zinc-800 hover:border-indigo-300 dark:hover:border-indigo-700/50 transition-colors shadow-sm overflow-hidden">
                                <div className="absolute top-4 right-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => setPreviewImage(section.image)}
                                        className="bg-gray-900/80 backdrop-blur-md text-white px-3 py-1.5 rounded-lg text-xs font-medium shadow-xl hover:bg-indigo-600 flex items-center gap-2"
                                    >
                                        🔍 전체 이미지 확대보기
                                    </button>
                                </div>
                                <div
                                    className="relative w-full overflow-hidden rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 cursor-zoom-in"
                                    onClick={() => setPreviewImage(section.image)}
                                    style={{ height: section.imageCrop?.maxHeight || '400px' }}
                                >
                                    <img
                                        src={section.image}
                                        alt={`${section.title} 스크린샷`}
                                        className="w-full h-full object-cover"
                                        style={{ objectPosition: section.imageCrop?.objectPosition || 'top center' }}
                                        loading="lazy"
                                    />
                                    {/* 오버레이 마커 랜더링 */}
                                    {section.markers?.map((marker, i) => (
                                        <div
                                            key={i}
                                            className="absolute border-2 border-rose-500 bg-rose-500/10 rounded-md z-10 pointer-events-none"
                                            style={{
                                                top: marker.top,
                                                left: marker.left,
                                                width: marker.width,
                                                height: marker.height
                                            }}
                                        >
                                            <span className="absolute -top-3 -right-3 flex h-6 w-6">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-6 w-6 bg-rose-500 border-2 border-white items-center justify-center text-[10px] font-bold text-white shadow-sm">
                                                    {i + 1}
                                                </span>
                                            </span>
                                            {selectedSection === section.id && marker.description && (
                                                <div className="absolute top-1/2 -translate-y-1/2 right-[calc(100%+12px)] bg-gray-900 text-white text-xs whitespace-nowrap px-3 py-2 rounded-lg shadow-xl translate-x-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                                                    <div className="font-bold text-rose-300 mb-0.5">{marker.label}</div>
                                                    {marker.description}
                                                    <div className="absolute top-1/2 -translate-y-1/2 -right-1 w-2 h-2 bg-gray-900 rotate-45"></div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* 본문 텍스트 컨텐츠 블록 */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white dark:bg-zinc-950 rounded-2xl p-8 border border-gray-100 dark:border-zinc-900 shadow-sm leading-relaxed">
                                {/* 개요 (전체 차지 허용 시 colspan 사용, 여긴 기본 레이아웃) */}
                                <div className="md:col-span-2 space-y-4">
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                        <span className="text-xl">💡</span> 기능 개요
                                    </h3>
                                    <p className="text-gray-700 dark:text-gray-300 text-[15px]">
                                        {section.overview}
                                    </p>
                                </div>

                                {/* 주요 구성 (features가 있을 때) */}
                                {section.features && section.features.length > 0 && (
                                    <div className="md:col-span-2 space-y-4 mt-2">
                                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-zinc-800 pb-2">
                                            화면 주요 구성요소
                                        </h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            {section.features.map((feat, idx) => (
                                                <div key={idx} className="bg-gray-50 dark:bg-zinc-900/50 p-4 rounded-xl border border-gray-100 dark:border-zinc-800">
                                                    <h4 className="font-bold text-gray-900 dark:text-gray-100 mb-1 flex items-center gap-2">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                                                        {feat.title}
                                                    </h4>
                                                    <p className="text-sm text-gray-600 dark:text-gray-400">{feat.desc}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* 사용 방법 (howToUse) */}
                                {section.howToUse && section.howToUse.length > 0 && (
                                    <div className="space-y-4 mt-2">
                                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-zinc-800 pb-2 flex items-center gap-2">
                                            ▶ 사용 지침 (How to)
                                        </h3>
                                        <ol className="space-y-3 pl-2">
                                            {section.howToUse.map((how, idx) => (
                                                <li key={idx} className="flex gap-3 text-sm text-gray-700 dark:text-gray-300">
                                                    <span className="flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-bold text-[10px] mt-0.5">
                                                        {idx + 1}
                                                    </span>
                                                    <span className="leading-snug">{how}</span>
                                                </li>
                                            ))}
                                        </ol>
                                    </div>
                                )}

                                {/* 활용 팁 및 보안/노트 (혼합 레이아웃) */}
                                <div className="space-y-6 mt-2">
                                    {section.tips && section.tips.length > 0 && (
                                        <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 p-5 rounded-xl">
                                            <h4 className="font-bold text-emerald-800 dark:text-emerald-400 mb-3 flex items-center gap-2 text-sm">
                                                <span>✨</span> 활용 꿀팁
                                            </h4>
                                            <ul className="space-y-2 list-none p-0">
                                                {section.tips.map((tip, idx) => (
                                                    <li key={idx} className="text-sm text-emerald-700 dark:text-emerald-300/80 flex items-start gap-2 before:content-['·'] before:font-bold">
                                                        <span className="leading-relaxed">{tip}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {section.note && (
                                        <div className="bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-400 p-4 rounded-r-xl">
                                            <p className="text-sm text-amber-800 dark:text-amber-300 font-medium leading-relaxed">
                                                {section.note}
                                            </p>
                                        </div>
                                    )}

                                    {section.security && (
                                        <div className="bg-rose-50 dark:bg-rose-900/10 border-l-4 border-rose-500 p-4 rounded-r-xl">
                                            <h4 className="font-bold text-rose-800 dark:text-rose-400 mb-1 flex items-center gap-1.5 text-sm">
                                                <span>🛡️</span> 보안/프라이버시
                                            </h4>
                                            <p className="text-sm text-rose-700 dark:text-rose-300 leading-relaxed">
                                                {section.security}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </section>
                    ))}
                </div>

                <footer className="pt-16 pb-8 border-t border-gray-200 dark:border-zinc-800 text-center">
                    <div className="w-16 h-1 bg-indigo-600 rounded-full mx-auto mb-6 opacity-20"></div>
                    <p className="text-base font-semibold text-gray-900 dark:text-white mb-2">
                        Dyfine | 가구 재정의 영리한 기준.
                    </p>
                    <p className="text-sm text-gray-500 dark:text-zinc-500 max-w-sm mx-auto">
                        여러분의 더 나은 자산 관리와 목표 달성을 위해 시스템은 지속적으로 진화하고 있습니다.
                    </p>
                </footer>
            </main>

            {/* 스크린샷 확대 모달 */}
            <Modal
                isOpen={!!previewImage}
                onClose={() => setPreviewImage(null)}
                title="스크린샷 전체 화면"
            >
                {previewImage && (
                    <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-zinc-700 bg-white dark:bg-black p-1">
                        <img
                            src={previewImage}
                            alt="확대된 매뉴얼 스크린샷"
                            className="w-full h-auto max-h-[75vh] object-contain rounded"
                        />
                    </div>
                )}
            </Modal>
        </div>
    );
}
