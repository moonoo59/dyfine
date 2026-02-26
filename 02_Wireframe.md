# 화면 흐름도 & Wireframe (Phase1~Phase2) v1.1
작성일: 2026-02-25

> 설계 기준
> - **Actual**(확정 전표)이 모든 집계/차트의 기준
> - **Expected**(예정 자동이체/예정 납입)은 “오버레이”로만 표시(토글)

---

## 1) IA(메뉴 구조)
- Login
- Dashboard
- Transactions
- Auto Transfers
- Budgets
- Reports
- Accounts
- Loans (Phase2)
- Investments (Phase2)
- Notifications
- Settings
  - Categories/Tags
  - Rules(분류 룰)
  - Import Profiles
  - Closing
  - Security/Users

---

## 2) 사용자 흐름(Flow)

### 2.1 Onboarding(최초 1회)
```mermaid
flowchart TD
  A[Login] --> B[Household 생성/선택]
  B --> C[Accounts 등록]
  C --> D[Categories/Tags 확인]
  D --> E[Auto Transfer Rules 등록(선택)]
  E --> F[Budget Template 적용(선택)]
  F --> G[Dashboard]
```

### 2.2 매월 운영(Phase1)
```mermaid
flowchart TD
  S[월초 Cron: 자동이체 Instance 생성] --> T[Auto Transfers 체크리스트]
  T --> U{확인 필요?}
  U -- 예 --> V[Confirm -> 거래 생성(Actual 반영)]
  U -- 아니오 --> W[Quick Add로 필요한 거래 입력]
  V --> X[Budget/Reports 확인]
  W --> X
  X --> Y[Closing(월 마감)]
```

### 2.3 Phase2(대출/투자)
```mermaid
flowchart TD
  L[Loan 생성/금리 이력 입력] --> M[월 전표 생성(locked)]
  M --> N[납입 거래 생성/연결]
  N --> O[Loan 리포트 + 추가상환 시뮬(클라)]
  I[Holdings 입력] --> J[가격 업데이트(수동/CSV)]
  J --> K[배분/드리프트/스냅샷]
```

---

## 3) 화면별 Wireframe(텍스트)

## 3.1 Login
```text
[Login]
- Email
- Password
- (옵션) Turnstile
[Login]

상태
- 에러: "이메일/비밀번호 확인"
- 잠금: 로그인 실패 누적 시 지연(보안)
```

---

## 3.2 Dashboard
```text
상단: 기간 선택(이번달/지난달/커스텀) | Expected 토글

[KPI 카드]
- 총수입(Actual)
- 총지출(Actual)
- 순증감(Actual)
- 가용현금 = 현금성 잔액(Actual) - 미확인 예정 유출(Expected)
- 미확인 자동이체 건수/금액

[좌] Sankey (흐름)
- 노드: 계좌(그룹 가능) / External
- 링크 클릭 -> Transactions로 이동(필터 자동 적용)

[우] Balance Chart
- 탭: Actual / Projected
- 계좌 멀티선택
- 마커: 자동이체 due, 대출 납입일(Phase2)

[하] Waterfall
- 수입 -> 카테고리 지출/배분 -> 순증감
- 막대 클릭 -> Reports/Transactions로 이동

[우하] "해야 할 일"
- 미확인 자동이체 리스트(Confirm 버튼)
- (Phase2) 납입 거래 연결 누락 경고
```

---

## 3.3 Transactions
```text
[Quick Add]
- 날짜(기본 오늘)
- 금액
- From 계좌 / To 계좌
- 카테고리(L2) (필수)
- 태그(선택)
- 메모(선택)
[저장] [즐겨찾기 저장] [최근 복제]

[탭]
- 전체
- 인박스(미분류)
- 즐겨찾기
- Import(CSV)

[필터]
- 기간, 계좌, 카테고리, 태그, 키워드, source(manual/import/auto_transfer/loan)
```

### 즐겨찾기(초기 제공)
- 생활비(변동) 월합산(지출)
- 여선 용돈 지급(이체)
- 덕원 용돈 지급(이체)
- 저축 이체
- 비상금 적립/회수
- (Phase2) 대출 납입(필요 시)

---

## 3.4 Auto Transfers
```text
[이번달 체크리스트]
- 예정 N | 확인 M | 미확인 K
- 표:
  due_date | name | from -> to | expected_amount | status | [Confirm]

[규칙 관리]
- 목록: name | schedule | amount | 활성
- 추가/수정:
  day_of_month, tolerance_days/amount, category, tags
```

상태 UX
- pending: Confirm 버튼 활성
- confirmed: 연결된 전표 링크 표시
- missed: 강조 + 알림 생성(앱내/푸시)

---

## 3.5 Budgets
```text
[월 선택] [템플릿 적용] [override 편집]

표:
- 카테고리(L2)
- 예산
- 실적(Actual)
- (옵션) 예정 포함(Expected)
- 차이
- 진행률

- 초과 항목은 강조 표시
- 클릭 -> 해당 카테고리 거래 리스트
```

---

## 3.6 Reports
```text
[요약]
- 카테고리 지출 Top
- 태그 지출 Top
- 예산 초과 Top

[검색/필터]
- 기간/계좌/카테고리/태그/키워드
- 결과 리스트
- (옵션) CSV Export
```

---

## 3.7 Accounts
```text
그룹별 리스트
- 계좌명 | 타입 | 잔액(Actual) | 이번달 In/Out | 활성

[계좌 추가/수정]
- name, type, group, opening_balance, currency, active
```

---

## 3.8 Closing(월 마감)
```text
[마감 전 체크]
- 미확인 자동이체 목록
- 예산 초과 목록
- (Phase2) 대출 납입 전표/거래 연결 누락

[마감 실행]
- 월 요약 스냅샷 저장
- 해당 월 전표 is_locked=true

[마감 후]
- 수정 버튼 비활성(조정 전표만)
```

---

## 3.9 Loans (Phase2)
```text
[대출 목록]
- 대출명 | 잔액 | 현재금리 | 이번달 이자 | 다음 납입일 | 상태

[대출 상세]
- 기본: 원금/만기/상환방식/출금계좌/일수 기준
- 금리 이력: effective_date별
- 월 전표(locked): period, interest, principal, fee, balance
- 이벤트: 중도상환/조정
- 납입 거래 연결 상태(연결/미연결)
- 추가상환 시뮬(슬라이더) -> 결과 저장(선택)
```

---

## 3.10 Investments (Phase2)
```text
[요약]
- 총평가 | 총손익 | 계좌별 배분

[보유]
- ticker | qty | avg_price | last_price | 평가금액 | 손익
- 가격 업데이트(수동 입력/CSV)

[차트]
- 총평가 추이(스냅샷)
- 배분(TopN)
- 목표 PF vs 현재 PF(드리프트)
- 리밸런싱 제안(권고) + 저장(선택)
```

---

## 3.11 Notifications
```text
- 자동이체 미확인/미실행
- 월 마감 리마인드
- (Phase2) 대출 연결 누락

- 읽음/미읽음
```

---

## 3.12 Settings
```text
- Household/Users(공용 계정이면 최소화)
- Categories/Tags 편집(이름 변경 가능)
- Rules(패턴 분류 룰)
- Import Profiles(CSV 매핑)
- Closing(월 마감 정책)
- Security(세션/로그인 정책)
```
