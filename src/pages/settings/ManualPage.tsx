import { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';

type Callout = {
    label: string;        // 짧은 이름 (예: '빠른 추가')
    description: string;  // 상세 설명
};

type Section = {
    id: string;
    title: string;
    image: string;
    imageCrop?: {
        objectPosition: string;
        maxHeight: string;
    };
    subImages?: { url: string; label: string; crop?: { objectPosition: string; height: string } }[];
    callouts?: Callout[];
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
        imageCrop: { objectPosition: 'top center', maxHeight: '400px' },
        callouts: [
            { label: '① 자산 요약 카드', description: '상단 가로 카드 행. 총 자산(모든 계좌 합산), 현금성 잔액(즉시 사용 가능한 예금·저축), 투자 평가액(현재 시장 가치 기준), 대출 잔액을 한눈에 확인. 각 카드를 클릭하면 해당 세부 페이지로 이동.' },
            { label: '② 현금흐름 테이블', description: '이달의 돈 흐름 전체를 한 표로 요약. 근로수입·비정기수입·대출 상환·고정지출(매달 고정으로 나가는 것)·변동지출(그때그때 다른 것)·가용 자금(= 수입 - 지출 합계)을 자동 집계.' }
        ],
        overview: '로그인 직후 가장 먼저 표시되는 메인 화면입니다. 이달 가구의 재정 상태를 한 페이지에서 빠르게 파악할 수 있도록 설계되어 있습니다.',
        features: [
            { title: '자산 요약 카드', desc: '총 자산 · 현금성 잔액 · 투자 평가액 · 대출 잔액 4가지를 상단에 표시. 데이터가 입력될수록 실시간으로 업데이트됩니다.' },
            { title: '현금흐름 집계표', desc: '이번 달 수입(근로/비정기), 대출 원리금, 고정지출, 변동지출을 카테고리별로 집계하여 최종 가용 자금(+/-)을 자동 계산합니다.' },
            { title: '자산 목표 진행률', desc: '설정한 목표 자산 금액 대비 현재 순자산이 몇 % 달성되었는지 게이지 바로 시각화합니다.' },
            { title: '최근 자금 이동', desc: '계좌 간 이체 내역만 별도로 타임라인 형식으로 표시하여 누가 어디서 어디로 이체했는지 빠르게 확인합니다.' }
        ],
        tips: [
            '자산 요약 카드를 클릭하면 해당 계좌 목록이나 투자 페이지로 즉시 이동합니다.',
            '현금흐름 집계표는 거래 내역에 카테고리가 제대로 입력되어야 정확하게 집계됩니다. 인박스(미분류) 건수가 0이 되도록 분류를 완료해 주세요.',
            '새로운 달이 시작되면 자동으로 해당 달의 데이터로 전환됩니다. 월 변경 후 첫 접속 시 표시되는 달을 확인해 주세요.'
        ]
    },
    {
        id: '2',
        title: '거래 내역',
        image: '/manual_images/transactions.png',
        imageCrop: { objectPosition: 'top left', maxHeight: '200px' },
        subImages: [
            { url: '/manual_images/transactions_modal.png?v=2', label: '거래 등록 팝업 화면' }
        ],
        callouts: [
            { label: '① 빠른 추가', description: '우측 상단 진한 색상 버튼. 클릭하면 팝업이 열리며 지출 / 수입 / 이체(계좌 간 이동) 중 유형을 먼저 선택한 뒤 금액·날짜·카테고리·계좌를 입력합니다.' },
            { label: '② 탭 목록', description: '[전체] 등록된 모든 거래 / [인박스] 카테고리가 "미분류"인 거래만 표시 — 분류되지 않은 건을 빠르게 처리하는 작업함 / [즐겨찾기] 별표 표시한 거래만 모아보기 / [Import] 엑셀·CSV 파일로 거래 일괄 가져오기' }
        ],
        overview: '가구 내 모든 수입과 지출을 등록하고 조회하는 핵심 기능입니다. 카테고리로 분류하면 예산 관리·리포트·현금흐름 집계에 자동으로 반영됩니다.',
        howToUse: [
            '우측 상단 [빠른 추가] 버튼을 클릭합니다.',
            '지출 / 수입 / 이체 중 거래 유형을 선택합니다. 이체는 내 계좌에서 다른 내 계좌로 돈을 옮길 때(예: 통장 → 적금) 사용합니다.',
            '금액, 날짜, 출금 계좌, 카테고리(대분류 → 소분류 순서)를 입력합니다. 카테고리가 없으면 먼저 [카테고리 관리]에서 추가해야 합니다.',
            '메모(optional): 해당 거래의 상세 내용을 자유롭게 기억용으로 남깁니다.',
            '태그(optional): 쉼표로 구분하여 여러 태그를 달 수 있습니다. 나중에 태그로 특정 소비 패턴을 검색할 때 유용합니다.',
            '[즐겨찾기 저장] 체크 시 등록 즉시 즐겨찾기 탭에도 표시됩니다.',
            '[저장]을 클릭하면 내역에 즉시 반영되고, 잔액·현금흐름·예산 소진율이 자동 갱신됩니다.'
        ],
        features: [
            { title: '인박스 (미분류) 탭', desc: '카테고리를 "미분류"로 저장했거나, Import로 가져온 거래 중 카테고리가 지정되지 않은 건들이 모입니다. 이 탭을 정기적으로 비워야 리포트·예산 통계가 정확해집니다.' },
            { title: 'Import (일괄 가져오기) 탭', desc: '은행 앱에서 내보낸 엑셀/CSV 파일을 업로드하면 거래를 한꺼번에 Dyfine에 등록합니다. 업로드 후 가져온 내역이 인박스에 쌓이므로 카테고리를 지정해 정리하면 됩니다.' },
            { title: '강력한 필터링', desc: '기간(~부터 ~까지), 계좌, 카테고리, 키워드(메모·상점명), 태그를 자유롭게 조합하여 원하는 내역만 추릴 수 있습니다.' },
            { title: '입력자 표시', desc: '가족 중 누가 입력한 거래인지 👤 아이콘과 이름으로 표시됩니다. 표시 이름은 [마이 프로필]에서 변경할 수 있습니다.' }
        ]
    },
    {
        id: '3',
        title: '자동 이체',
        image: '/manual_images/transfers.png',
        imageCrop: { objectPosition: 'top center', maxHeight: '280px' },
        subImages: [
            { url: '/manual_images/transfers_modal.png?v=2', label: '자동이체 규칙 등록 팝업' }
        ],
        callouts: [
            { label: '① 확인 대기 중인 이체', description: '시스템이 자동 생성한 이체 초안 목록. 매월 설정한 날짜가 되면 이곳에 "확정 대기" 상태로 항목이 나타납니다. 클릭하여 내용을 확인한 뒤 확정하면 거래 내역에 등록됩니다.' },
            { label: '② 새 규칙 추가', description: '이체 규칙 관리 섹션 우측 버튼. 규칙명 · 출금 계좌 · 입금 계좌 · 이체일(매월 N일) · 금액을 설정하면 해당 날짜마다 자동으로 이체 초안이 생성됩니다.' }
        ],
        overview: '월세, 적금 납입, 용돈 이체 등 매달 반복되는 계좌 간 이동을 규칙으로 등록해 두면, 지정한 날짜마다 시스템이 자동으로 이체 초안을 만들어줍니다.',
        howToUse: [
            '[새 규칙 추가] 버튼을 클릭합니다.',
            '규칙 이름(예: 월세 이체, 덕원 적금)을 입력합니다.',
            '출금 계좌(돈이 나가는 계좌)와 입금 계좌(돈이 들어오는 계좌)를 선택합니다. 두 계좌 모두 Dyfine에 등록된 계좌여야 합니다.',
            '매월 이체가 실행될 날짜(N일)와 이체 금액을 입력합니다.',
            '저장하면 매월 해당 일에 "확인 대기 중인 이체" 섹션에 항목이 자동 생성됩니다.',
            '실제 이체가 완료된 날 Dyfine에 접속하여 대기 중인 항목을 클릭 → [확정]을 눌러 거래 내역에 공식 반영합니다.'
        ],
        features: [
            { title: '확인 대기 중인 이체', desc: '설정한 날짜가 되면 자동 생성되는 이체 초안. 실생활에서 이체를 완료한 후 이 곳에서 확정하는 2단계 방식으로 실수를 방지합니다.' },
            { title: '이체 규칙 관리', desc: '등록한 모든 자동이체 규칙 목록. 월세 금액이 바뀌거나 계좌를 변경할 때 여기서 규칙을 수정·삭제합니다.' }
        ]
    },
    {
        id: '4',
        title: '예산 관리',
        image: '/manual_images/budgets.png',
        imageCrop: { objectPosition: 'top center', maxHeight: '400px' },
        subImages: [
            { url: '/manual_images/budgets_modal.png?v=2', label: '새 예산 설정 팝업' }
        ],
        overview: '카테고리별로 이번 달 사용할 지출 한도를 미리 설정하고, 실제로 얼마나 썼는지 실시간으로 비교합니다. 예산을 세워두면 과소비를 예방하고 저축 목표를 달성하는 데 도움이 됩니다.',
        howToUse: [
            '화면 맨 위 년-월 선택기로 예산을 설정할 달을 선택합니다.',
            '[새 예산 설정] 버튼 → 카테고리와 지출 한도 금액을 입력합니다. 예: 외식비 30만원, 교통비 10만원.',
            '저장 후 해당 달에 해당 카테고리로 거래가 입력될 때마다 소진율(%)이 자동 갱신됩니다.',
            '다음 달 예산을 빠르게 복사하려면 [이전 달 복사] 기능을 사용합니다—지난 달과 동일한 예산이 새 달에 자동 생성됩니다.'
        ],
        features: [
            { title: '소진율 시각화', desc: '각 예산 항목에 진행 게이지 바가 표시됩니다. 80% 이상이면 주황, 100% 초과 시 빨간색으로 경고해 시각적으로 즉시 파악 가능합니다.' },
            { title: '이전 달 복사', desc: '반복적인 예산 항목(통신비, 식비 등)을 매달 처음부터 입력하지 않도록 전월 예산을 그대로 복사합니다.' }
        ],
        tips: [
            '카테고리 관리에서 소분류까지 세분화할수록 예산 추적이 정교해집니다. 예: "외식" 대신 "카페", "배달음식", "식당"으로 나누면 어디서 새는지 파악 가능합니다.',
            '예산 없이 지출된 카테고리는 리포트의 "예산 미설정" 항목으로 별도 표시됩니다.'
        ]
    },
    {
        id: '5',
        title: '대출 관리',
        image: '/manual_images/loans.png',
        imageCrop: { objectPosition: 'top center', maxHeight: '360px' },
        subImages: [
            { url: '/manual_images/loans_modal.png?v=2', label: '새 대출 등록 팝업' }
        ],
        callouts: [
            { label: '새 대출 등록', description: '우측 상단 버튼. 대출명·은행명·원금·시작일·만기일·상환방식·금리를 입력하면 매월 낼 원금과 이자가 자동 계산된 상환 스케줄이 생성됩니다.' }
        ],
        overview: '주택담보대출, 신용대출 등 현재 보유한 모든 대출을 한 화면에서 관리합니다. 금리 변경 이력을 기록하면 실제 이자 비용 추이를 정확하게 추적할 수 있습니다.',
        howToUse: [
            '[새 대출 등록]을 클릭하여 대출 정보를 입력합니다.',
            '은행명과 대출 이름(본인이 알아보기 쉬운 별칭), 최초 대출 원금을 입력합니다.',
            '시작일(최초 대출 실행일), 만기일(최종 상환 예정일)을 설정합니다.',
            '상환 방식을 선택합니다:  ① 원리금균등: 매달 같은 금액 납부.  ② 원금균등: 초기 부담이 크지만 갈수록 줄어듦.  ③ 만기일시: 이자만 내다가 만기 전액 상환.  ④ 체증식: 초기에는 적게 내고 점차 납입액이 커지는 방식 (소득 증가가 예상되는 사회초년생에게 유리).',
            '거치 기간(Grace Period)을 원할 경우 체크 후 개월수를 입력합니다 (예: 거치 12개월 → 처음 1년은 이자만 납부, 13개월차부터 원금 상환 시작).',
            '현재 적용 금리(연 %)를 입력합니다. 이후 금리가 변동되면 대출 선택 후 [금리 변경]에서 새 금리를 추가 등록합니다.',
            '등록 즉시 월별 상환 스케줄 표가 자동 생성되고, 총 대출 잔액이 대시보드 자산 요약에 반영됩니다.'
        ],
        features: [
            { title: '자동 상환 스케줄', desc: '입력된 원금·금리·상환방식·만기를 기반으로 매월 납부해야 할 원금과 이자를 자동 계산합니다. 남은 잔액도 자동 추적합니다.' },
            { title: '금리 변경 이력', desc: '변동금리 대출의 경우 시기별 금리 인상/인하 내역을 기록하면 실제 이자 비용 변화를 정확히 파악할 수 있습니다.' },
            { title: '원장 자동 동기화', desc: '대출 등록 즉시 "대출 부채" 항목이 자산 현황표에 반영되어 순자산(자산 - 부채) 계산이 정확해집니다.' }
        ]
    },
    {
        id: '6',
        title: '투자 관리',
        image: '/manual_images/investments.png',
        imageCrop: { objectPosition: 'top center', maxHeight: '400px' },
        overview: '주식, ETF, 펀드 등 보유 중인 투자 자산을 등록하고 가구 단위의 포트폴리오를 관리합니다. 매월 투자 현황을 스냅샷으로 기록하면 자산 성장 추이를 리포트에서 확인할 수 있습니다.',
        howToUse: [
            '보유 종목을 등록합니다: 종목명(예: 삼성전자), 평균 매수단가, 보유 수량, 계좌(예: 증권 계좌)를 입력합니다.',
            '현재가를 주기적으로 업데이트하면 평가 수익률(+/-)이 자동 계산됩니다.',
            '월말에 [이번 달 스냅샷 저장]을 눌러 현재 포트폴리오 총액을 기록합니다. 이 데이터가 리포트의 자산 변동 추이 차트에 사용됩니다.',
            '투자 목표액(이번 달 얼마를 투자할 계획인지)과 실제 기여금을 입력하면 달성률을 추적할 수 있습니다.'
        ],
        features: [
            { title: '보유 종목 관리', desc: '종목별 매수단가·수량·현재가를 등록하여 평가 손익과 수익률을 실시간 추적합니다.' },
            { title: '월별 스냅샷', desc: '매월 말 포트폴리오 총 평가액을 스냅샷으로 저장합니다. 이 기록이 시간에 따른 투자 자산 증감 추이를 분석하는 기준이 됩니다.' },
            { title: '투자 기여금 추적', desc: '매월 실제로 투자에 추가한 금액을 기록하여 목표 투자 금액 대비 달성률을 확인합니다.' }
        ]
    },
    {
        id: '7',
        title: '리포트',
        image: '/manual_images/reports.png',
        imageCrop: { objectPosition: 'top center', maxHeight: '400px' },
        overview: '지금까지 입력된 모든 거래·예산·자산 데이터를 기반으로 다양한 통계 시각화 리포트를 제공합니다. 단순 가계부를 넘어 가구 재정을 "분석"하는 데 사용하세요.',
        features: [
            { title: '월별 수입/지출 비교', desc: '최근 N개월의 수입과 지출을 나란히 보여주는 막대 차트. 어느 달에 지출이 비정상적으로 많았는지 한눈에 파악합니다.' },
            { title: '카테고리별 지출 비중', desc: '선택한 기간의 지출을 카테고리별 파이 차트로 분석합니다. 식비·교통비 등 어디에 돈을 가장 많이 쓰는지 확인할 수 있습니다.' },
            { title: '자산 변동 추이', desc: '매월 저장된 투자 스냅샷과 계좌 잔액을 기반으로 순자산이 어떻게 변화했는지 꺾은선 그래프로 표시합니다.' },
            { title: '예산 대비 실적', desc: '이달 설정한 카테고리별 예산 대비 실제 지출을 비교합니다. 초과·절약·미사용 항목을 색상으로 구분하여 표시합니다.' }
        ],
        tips: [
            '거래를 인박스(미분류)로 방치하면 리포트가 부정확해집니다. 매주 한 번 인박스 탭을 확인하여 카테고리를 지정하는 습관을 들이세요.',
            '리포트의 정확도는 데이터 입력 충실도에 직결됩니다. 영수증이 있는 당일 or 익일 입력을 권장합니다.'
        ]
    },
    {
        id: '8',
        title: '누리무무 (반려견)',
        image: '/manual_images/petcare.png',
        imageCrop: { objectPosition: 'top center', maxHeight: '400px' },
        overview: '반려견 오구의 미용, 병원, 사료, 간식 구매 등 케어 관련 활동과 비용을 전용으로 기록하는 섹션입니다. 일반 가계부 거래 내역과 완전히 분리되어 있어 뒤섞이지 않습니다.',
        howToUse: [
            '[새 기록 추가] 버튼을 클릭합니다.',
            '기록 날짜를 선택합니다(오늘 날짜가 기본값).',
            '서비스 유형을 선택합니다: 미용 / 병원 진료 / 예방접종 / 사료 구매 / 간식 구매 / 기타.',
            '샵/업체 이름, 발생 비용, 추가 메모(예: "스케일링 2차", "광견병 예방접종 완료")를 입력하고 저장합니다.',
            '목록에서 날짜별 케어 이력을 시간순으로 확인할 수 있습니다.'
        ],
        features: [
            { title: '케어 이력 타임라인', desc: '날짜순으로 기록이 쌓여 언제 마지막으로 미용·접종·병원을 갔는지 이력을 한눈에 파악할 수 있습니다.' },
            { title: '비용 독립 추적', desc: '반려견 관련 지출은 이 화면에서만 집계되어 가구 전체 지출 리포트와 분리됩니다. 연간 반려견 비용이 얼마인지 별도로 파악할 수 있습니다.' }
        ],
        tips: [
            '접종·스케일링 등 정기 이벤트를 기록해두면 마지막 날짜를 기준으로 "다음 예정일"을 본인이 알람처럼 관리할 수 있습니다.',
            '사료·간식 구매는 구체적인 제품명을 메모에 남기면 소비 패턴을 파악하는 데 유용합니다.'
        ]
    },
    {
        id: '9',
        title: '용돈 관리',
        image: '/manual_images/allowance.png',
        imageCrop: { objectPosition: 'top center', maxHeight: '400px' },
        overview: '가구 구성원 각자의 개인 용돈을 독립적으로 관리합니다. 본인이 로그인한 상태에서만 본인의 데이터가 보이며, 다른 가족은 접근할 수 없습니다.',
        note: '핵심 원리: 거래 내역 페이지에서 "{이름} 용돈" 카테고리(예: "덕원 용돈")로 기록된 지출 금액이 자동으로 이 페이지의 "이번 달 총 용돈"으로 집계됩니다. 즉, 가족이 용돈을 이체해줄 때 해당 카테고리로 거래를 기록하면 자동으로 반영됩니다.',
        howToUse: [
            '화면 상단에서 이번 달 총 용돈(자동 집계된 금액)을 확인합니다.',
            '[+ 항목 추가]를 눌러 본인의 고정 지출 항목을 등록합니다. 예: 넷플릭스 구독료 1만7천원, 통신비 추가 납부 5만원.',
            '총 용돈에서 등록된 고정 지출이 자동으로 차감되어 남은 [자유 사용 잔액]이 계산됩니다.',
            '자유 사용 잔액을 기준으로 이번 달 커피·외식·취미 등 개인 소비를 조절합니다.'
        ],
        features: [
            { title: '개인 데이터 완전 분리', desc: '용돈 항목은 본인 계정으로만 조회·수정 가능합니다. 다른 가족 멤버는 절대 볼 수 없습니다(데이터베이스 수준 차단).' },
            { title: '고정지출 등록', desc: '매달 빠져나가는 개인 고정 지출(구독 서비스, 통신비, 교통정기권 등)을 미리 등록해두면 실제 자유 사용 가능 금액을 정확히 파악할 수 있습니다.' }
        ],
        security: '보안 원리: 이 페이지의 데이터는 데이터베이스 내 "행 수준 보안(Row Level Security, RLS)"으로 보호됩니다. 서버에서 로그인 계정 ID를 자동 확인하여, 본인의 레코드만 조회 · 수정 · 삭제가 허용됩니다. 관리자도 앱을 통해 타인의 용돈 데이터를 볼 수 없습니다.'
    },
    {
        id: '10',
        title: '계좌 관리',
        image: '/manual_images/accounts.png',
        imageCrop: { objectPosition: 'top left', maxHeight: '400px' },
        subImages: [
            { url: '/manual_images/accounts_modal.png?v=2', label: '새 계좌 추가 팝업' }
        ],
        callouts: [
            { label: '계좌 추가', description: '우측 상단 버튼. 실제 보유한 은행 계좌, 신용카드, 증권 계좌 등을 등록합니다. 등록된 계좌만 거래 내역 입력 시 선택 가능합니다.' }
        ],
        overview: '가구에서 사용하는 모든 금융 계좌를 Dyfine에 등록하고 관리합니다. 계좌가 먼저 등록되어야 거래 내역 입력 시 "어떤 계좌에서 나간 돈인지"를 지정할 수 있습니다.',
        howToUse: [
            '[계좌 추가] 버튼을 클릭합니다.',
            '계좌 이름(본인이 구분하기 쉬운 별칭, 예: "국민 급여통장", "투자 계좌")을 입력합니다.',
            '은행/카드사 이름, 계좌 유형(예금·적금·신용카드·투자·기타)을 선택합니다.',
            '중요: 이 계좌를 Dyfine 사용 시작 시점의 [초기 잔액]을 입력합니다. 초기 잔액이 정확해야 이후 자동 계산된 잔액이 실제와 일치합니다.',
            '선택: 계좌번호를 입력하면 목록에 마스킹(뒷 4자리만) 표시됩니다.'
        ],
        features: [
            { title: '잔액 자동 계산', desc: '초기 잔액 + 이후 입력된 수입 - 지출 합계로 현재 예상 잔액을 자동 계산합니다. 실제 잔액과 차이가 있다면 누락된 거래가 없는지 확인하세요.' },
            { title: '계좌 유형별 분류', desc: '입출금·적금·신용카드·체크카드·투자·기타로 유형을 나누어 자산 현황 분석이 세분화됩니다.' },
            { title: '예금주 설정', desc: '가족 중 누구의 계좌인지 예금주를 지정하면 계좌별 자산이 구성원별로 파악 가능합니다.' }
        ]
    },
    {
        id: '11',
        title: '카테고리 관리',
        image: '/manual_images/categories.png',
        subImages: [
            { url: '/manual_images/categories_modal.png?v=2', label: '새 카테고리 기입 팝업' }
        ],
        imageCrop: { objectPosition: 'top center', maxHeight: '400px' },
        callouts: [
            { label: '소분류 추가(+)', description: '각 대분류 카드 우측에 있는 + 버튼. 선택한 대분류에 속하는 소분류 항목을 즉시 추가합니다. 예: 대분류 "식비" > 소분류 "카페", "배달음식", "마트".' }
        ],
        overview: '거래를 기록할 때 선택하는 "분류 체계"를 직접 만들고 관리합니다. 대분류와 소분류 2단계로 구성되며, 처음 사용 시 [기본세트 적용]으로 한국 표준 가계부 카테고리를 자동 생성할 수 있습니다.',
        howToUse: [
            '처음 설정 시: 우측 상단 [📋 기본세트 적용] 버튼을 누르면 식비·교통비·의류비 등 일반적인 한국 가계부 카테고리가 자동 생성됩니다.',
            '새 대분류 추가: [+ 새 카테고리 추가]를 클릭 → 대분류명 입력 → 지출/수입 유형 선택 → 저장.',
            '소분류 추가: 원하는 대분류 카드에서 [+] 버튼 클릭 → 소분류명 입력 → 저장.',
            '상단 [지출] / [수입] 탭으로 전환하면 각 유형의 카테고리만 별도로 관리할 수 있습니다.',
            '사용하지 않는 카테고리는 언제든 삭제할 수 있습니다. 단, 이미 거래에 연결된 카테고리를 삭제하면 해당 거래가 미분류로 변경됩니다.'
        ],
        features: [
            { title: '2단계 분류 체계', desc: '대분류(예: 식비) > 소분류(예: 배달음식, 카페, 마트)로 세분화하여 지출 패턴을 정밀하게 분석합니다.' },
            { title: '기본세트 자동 생성', desc: '한국 표준 가계부 기준의 카테고리 세트를 버튼 하나로 자동 생성합니다. 처음 사용하는 경우 반드시 먼저 적용하세요.' }
        ]
    },
    {
        id: '12',
        title: '마이 프로필',
        image: '/manual_images/profile.png',
        imageCrop: { objectPosition: 'top center', maxHeight: '400px' },
        overview: '현재 로그인된 계정 정보를 확인하고, 앱 전체에서 사용되는 내 "표시 이름"과 로그인 비밀번호를 변경하는 페이지입니다.',
        howToUse: [
            '표시 이름 변경: [표시 이름] 입력란에 원하는 닉네임(예: 덕원, 큰이)을 입력하고 저장합니다. 이 이름이 거래 내역의 "입력자" 표시와 용돈 관리의 "{이름} 용돈" 카테고리 자동 연동에 사용됩니다.',
            '비밀번호 변경: 보안을 위해 현재 비밀번호를 먼저 입력한 뒤 새 비밀번호(8자 이상 권장)를 설정합니다. 변경 성공 후에도 자동으로 로그아웃되지 않으므로 작업을 이어서 진행할 수 있습니다.'
        ],
        features: [
            { title: '표시 이름 자동 연동', desc: '마이 프로필에서 설정한 이름이 ① 거래 내역 입력자 표시 ② 용돈 관리 자동 집계 키워드("{이름} 용돈") 두 곳에 자동 반영됩니다.' },
            { title: '안전한 비밀번호 변경', desc: '현재 비밀번호 인증 → 새 비밀번호 입력 → 확인 재입력의 3단계 검증을 거쳐 무단 변경을 방지합니다.' }
        ],
        security: '비밀번호가 변경되어도 현재 세션은 유지됩니다(자동 로그아웃 없음). 다른 기기에서 로그인된 세션까지 즉시 차단하려면 변경 후 직접 로그아웃·재로그인하세요.'
    }
];

export default function ManualPage() {
    const [selectedSection, setSelectedSection] = useState(SECTIONS[0].id);
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    // 스크롤 위치에 따라 현재 화면에 보이는 섹션을 감지해 사이드바 하이라이트 자동 업데이트
    useEffect(() => {
        const observers: IntersectionObserver[] = [];

        SECTIONS.forEach((section) => {
            const el = document.getElementById(`section-${section.id}`);
            if (!el) return;

            // 섹션이 화면 상단 30% 이상 보일 때 해당 쐹션을 활성 아이템으로 지정
            const observer = new IntersectionObserver(
                (entries) => {
                    entries.forEach((entry) => {
                        if (entry.isIntersecting) {
                            setSelectedSection(section.id);
                        }
                    });
                },
                {
                    rootMargin: '-20% 0px -60% 0px', // 화면 상단 20%~40% 구간에 들어왔을 때 활성
                    threshold: 0
                }
            );
            observer.observe(el);
            observers.push(observer);
        });

        // 컴포넌트 언마운트 시 츠서버 정리
        return () => {
            observers.forEach((obs) => obs.disconnect());
        };
    }, []);

    // 사이드바 클릭 시 해당 섹션으로 스크롤
    const scrollToSection = (id: string) => {
        setSelectedSection(id);
        const element = document.getElementById(`section-${id}`);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    return (
        <div className="flex flex-col lg:flex-row gap-4 lg:gap-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto mt-4">
            {/* 좌측 목차 (고정형 사이드바 - Desktop 전용) */}
            <aside className="hidden lg:block lg:w-64 flex-shrink-0">
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
            <main className="flex-1 w-full min-w-0 max-w-4xl space-y-12 lg:space-y-16 pb-32">

                {/* 모바일 전용 가로 스크롤 목차 (Sticky) */}
                <nav className="lg:hidden sticky top-16 z-20 bg-white/90 backdrop-blur-md dark:bg-zinc-950/90 border-b border-gray-200 dark:border-zinc-800 -mx-4 px-4 py-3 sm:-mx-6 sm:px-6 overflow-x-auto hide-scrollbar">
                    <ul className="flex items-center gap-2 whitespace-nowrap w-max">
                        {SECTIONS.map((section) => (
                            <li key={section.id}>
                                <button
                                    onClick={() => scrollToSection(section.id)}
                                    className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors flex items-center gap-2 ${selectedSection === section.id
                                        ? 'bg-indigo-600 text-white shadow-md'
                                        : 'bg-gray-100 text-gray-700 dark:bg-zinc-800 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-zinc-700'
                                        }`}
                                >
                                    {/* 현재 활성화된 화면만 번호를 숨기고 체크 표시나 간결하게 노출할 수도 있지만 여기서는 통일 */}
                                    <span className={`flex items-center justify-center w-5 h-5 rounded-full text-[10px] ${selectedSection === section.id ? 'bg-white/20' : 'bg-gray-200 dark:bg-zinc-700'
                                        }`}>
                                        {section.id}
                                    </span>
                                    {section.title}
                                </button>
                            </li>
                        ))}
                    </ul>
                </nav>

                <header className="border-b border-gray-200 dark:border-zinc-800 pb-6 lg:pb-8 pt-2 lg:pt-4">
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
                            className="scroll-mt-28"
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

                            {/* 스크린샷 영역 (크롭) */}
                            <div className="mb-4">
                                {/* 메인 스크린샷 */}
                                <div className="group relative rounded-2xl bg-gray-100 dark:bg-zinc-900 p-2 border border-gray-200 dark:border-zinc-800 hover:border-indigo-300 dark:hover:border-indigo-700/50 transition-colors shadow-sm overflow-hidden">
                                    <div className="absolute bottom-4 right-4 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => setPreviewImage(section.image)}
                                            className="bg-gray-900/90 backdrop-blur-md text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-2xl hover:bg-indigo-600 hover:scale-105 transition-all flex items-center gap-2 border border-white/10"
                                        >
                                            🔍 확대해서 보기
                                        </button>
                                    </div>
                                    <div
                                        className="relative w-full overflow-hidden rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 cursor-pointer"
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
                                    </div>
                                </div>

                                {/* 번호 콜아웃 범례 (마커 대신) */}
                                {section.callouts && section.callouts.length > 0 && (
                                    <div className="mt-3 bg-gray-50 dark:bg-zinc-900/60 rounded-xl border border-gray-200 dark:border-zinc-800 p-4 space-y-2">
                                        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">화면 주요 구성</p>
                                        {section.callouts.map((callout, i) => (
                                            <div key={i} className="flex items-start gap-3">
                                                <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-indigo-500 text-white text-[11px] font-bold mt-0.5">
                                                    {i + 1}
                                                </span>
                                                <div>
                                                    <span className="text-sm font-bold text-gray-800 dark:text-gray-100">{callout.label}</span>
                                                    <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">{callout.description}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* 서브 이미지(팝업) - 크롭으로 배경 제거 */}
                                {section.subImages && section.subImages.length > 0 && (
                                    <div className="mt-3 space-y-3">
                                        {section.subImages.map((subImg, idx) => (
                                            <div key={idx} className="rounded-xl border border-gray-200 dark:border-zinc-800 overflow-hidden cursor-pointer hover:border-indigo-400 transition-colors" onClick={() => setPreviewImage(subImg.url)}>
                                                <div className="bg-gray-50 dark:bg-zinc-900 px-4 py-2 border-b border-gray-200 dark:border-zinc-800 flex items-center gap-2">
                                                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400">📸 {subImg.label}</span>
                                                    <span className="ml-auto text-xs text-indigo-500">클릭하여 확대</span>
                                                </div>
                                                {/* crop 설정이 있으면 object-cover로 모달 영역만 크롭, 없으면 전체 표시 */}
                                                {subImg.crop ? (
                                                    <div
                                                        className="w-full max-w-sm mx-auto overflow-hidden bg-white dark:bg-zinc-950 rounded-b-xl"
                                                        style={{ height: subImg.crop.height }}
                                                    >
                                                        <img
                                                            src={subImg.url}
                                                            alt={subImg.label}
                                                            className="w-full h-full object-cover"
                                                            style={{ objectPosition: subImg.crop.objectPosition }}
                                                            loading="lazy"
                                                        />
                                                    </div>
                                                ) : (
                                                    <div className="w-full max-w-sm mx-auto bg-gray-50/50 dark:bg-zinc-900/30 p-4 rounded-b-xl flex justify-center">
                                                        <img
                                                            src={subImg.url}
                                                            alt={subImg.label}
                                                            className="w-full h-auto rounded shadow-sm border border-gray-100 dark:border-zinc-800"
                                                            loading="lazy"
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* 본문 텍스트 컨텐츠 블록 */}
                            < div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 bg-white dark:bg-zinc-950 rounded-2xl p-5 md:p-8 border border-gray-100 dark:border-zinc-900 shadow-sm leading-relaxed" >
                                {/* 개요 (전체 차지) */}
                                < div className="md:col-span-2 space-y-3 mb-4" >
                                    <h3 className="text-xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                                        <span className="text-2xl text-indigo-500">💡</span> 기능 개요
                                    </h3>
                                    <p className="text-gray-700 dark:text-gray-300 text-[15px] leading-relaxed bg-indigo-50/50 dark:bg-indigo-900/10 p-5 rounded-2xl border border-indigo-100 dark:border-indigo-800/30">
                                        {section.overview}
                                    </p>
                                </div>

                                {/* 주요 기능 (Grid Cards) */}
                                {section.features && section.features.length > 0 && (
                                    <div className="md:col-span-2 mb-6">
                                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                            <span className="text-indigo-500">✨</span> 주요 기능
                                        </h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            {section.features.map((feature, idx) => (
                                                <div key={idx} className="bg-gray-50 dark:bg-zinc-900/50 p-4 rounded-xl border border-gray-100 dark:border-zinc-800">
                                                    <div className="font-bold text-gray-900 dark:text-white mb-2">{feature.title}</div>
                                                    <div className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{feature.desc}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* 사용 지침 (Accordion/Details) */}
                                {section.howToUse && section.howToUse.length > 0 && (
                                    <div className="md:col-span-2 mb-4">
                                        <details className="group border border-gray-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-950 overflow-hidden [&_summary::-webkit-details-marker]:hidden">
                                            <summary className="flex cursor-pointer items-center justify-between p-4 font-bold text-gray-900 dark:text-white bg-gray-50/50 dark:bg-zinc-900/50 hover:bg-gray-50 dark:hover:bg-zinc-900 transition-colors">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-indigo-500">📝</span>
                                                    <span>자세한 사용법 읽어보기</span>
                                                </div>
                                                <span className="transition duration-300 group-open:-rotate-180">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
                                                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                                    </svg>
                                                </span>
                                            </summary>
                                            <div className="p-5 border-t border-gray-200 dark:border-zinc-800">
                                                <ol className="list-decimal list-outside ml-5 space-y-3 text-[14px] text-gray-700 dark:text-gray-300 marker:text-indigo-400 marker:font-bold">
                                                    {section.howToUse.map((step, idx) => (
                                                        <li key={idx} className="pl-2 leading-relaxed">{step}</li>
                                                    ))}
                                                </ol>
                                            </div>
                                        </details>
                                    </div>
                                )}

                                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* 유용한 팁 */}
                                    {section.tips && section.tips.length > 0 && (
                                        <div className="col-span-1 rounded-xl bg-indigo-50/50 dark:bg-indigo-900/10 p-5 border border-indigo-100 dark:border-indigo-800/30">
                                            <h4 className="font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-2 mb-3">
                                                <span className="text-lg">🎯</span> 유용한 팁
                                            </h4>
                                            <ul className="list-disc list-outside ml-4 space-y-2 text-sm text-indigo-800/80 dark:text-indigo-200/80 marker:text-indigo-300">
                                                {section.tips.map((tip, idx) => (
                                                    <li key={idx} className="pl-1 leading-relaxed">{tip}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {/* 보안 및 주의사항 */}
                                    {((section.security) || (section.note)) && (
                                        <div className="col-span-1 space-y-4">
                                            {section.security && (
                                                <div className="rounded-xl bg-emerald-50/80 dark:bg-emerald-900/10 p-5 border border-emerald-100 dark:border-emerald-800/30">
                                                    <h4 className="font-bold text-emerald-900 dark:text-emerald-400 flex items-center gap-2 mb-2">
                                                        <span className="text-lg">🔒</span> 보안 & 프라이버시
                                                    </h4>
                                                    <p className="text-[13px] text-emerald-800/80 dark:text-emerald-200/80 leading-relaxed">{section.security}</p>
                                                </div>
                                            )}
                                            {section.note && (
                                                <div className="rounded-xl bg-rose-50/80 dark:bg-rose-900/10 p-5 border border-rose-100 dark:border-rose-800/30">
                                                    <h4 className="font-bold text-rose-900 dark:text-rose-400 flex items-center gap-2 mb-2">
                                                        <span className="text-lg">⚠️</span> 참고사항
                                                    </h4>
                                                    <p className="text-[13px] text-rose-800/80 dark:text-rose-200/80 leading-relaxed">{section.note}</p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </section >
                    ))
                    }
                </div >

                <footer className="pt-16 pb-8 border-t border-gray-200 dark:border-zinc-800 text-center">
                    <div className="w-16 h-1 bg-indigo-600 rounded-full mx-auto mb-6 opacity-20"></div>
                    <p className="text-base font-semibold text-gray-900 dark:text-white mb-2">
                        Dyfine | 가구 재정의 영리한 기준.
                    </p>
                    <p className="text-sm text-gray-500 dark:text-zinc-500 max-w-sm mx-auto">
                        여러분의 더 나은 자산 관리와 목표 달성을 위해 시스템은 지속적으로 진화하고 있습니다.
                    </p>
                </footer>
            </main >

            {/* 스크린샷 확대 모달 */}
            < Modal
                isOpen={!!previewImage}
                onClose={() => setPreviewImage(null)}
                title="스크린샷 전체 화면 (원본 크기)"
                maxWidth="max-w-5xl"
            >
                {previewImage && (
                    <div className="rounded-lg overflow-auto border border-gray-200 dark:border-zinc-700 bg-white dark:bg-black p-1 max-h-[80vh] w-full">
                        <img
                            src={previewImage}
                            alt="확대된 매뉴얼 스크린샷"
                            className="block w-full h-auto"
                        />
                    </div>
                )}
            </Modal >
        </div >
    );
}
