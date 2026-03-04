# Dyfine 프로젝트 — 마스터 태스크 목록

> **최종 갱신일**: 2026-03-04  
> **관리 원칙**: 완료(✅), 진행중(🔄), 미착수(⬜), 보류(⏸️), 삭제(~~취소선~~)

---

## 📌 범례

- **[BUG]** 버그 수정 — 기능이 깨지거나 오동작
- **[FIX]** 코드 정정 — 스키마 불일치, 컬럼명 오류 등
- **[OPT]** 최적화 — 성능 또는 코드 품질 개선
- **[FEAT]** 신규 기능 — v3.0 설계서 기반 신규 구현
- **[UX]** UX/UI 개선 — 사용성·디자인 향상
- **[SEC]** 보안 — RLS, CSP 등
- **[DOC]** 문서 — README, API 명세 등

---

## ⚠️ A. 기존 버그 & 수정 사항 (v2.0 검토 보고서 기반)

### A-1. 🔴 치명적 (즉시 수정)

| # | ID | 유형 | 대상 파일 | 설명 | 상태 |
|---|---|---|---|---|---|
| A-1-1 | B-01/B-02 | [BUG] | `0014_investment_core.sql` | ~~`record_trade` RPC 스키마 충돌 (없는 컬럼 참조)~~. 이미 수정 완료됨. | ✅ |
| A-1-2 | B-07 | [FIX] | `useNotifications.ts` | ~~`Notification` 인터페이스 DB 스키마 불일치 (`title/body/is_read` → `type/payload_json/read_at`)~~. 이미 수정 완료됨. | ✅ |
| A-1-3 | B-11 | [FIX] | `OnboardingPage.tsx` | ~~온보딩 계좌 생성 시 `type` → `account_type` 컬럼명 오류~~. 이미 수정 완료됨. | ✅ |

### A-2. 🟡 중요 (다음 스프린트)

| # | ID | 유형 | 대상 파일 | 설명 | 상태 |
|---|---|---|---|---|---|
| A-2-1 | B-03 | [OPT] | `useDashboardData.ts` | ~~대시보드 훅에서 9~10개 순차 API 호출 → View 활용으로 성능 최적화~~. View 조인 1회로 개선 완료. | ✅ |
| A-2-2 | B-04 | [BUG] | `0004_rpc_create_transaction.sql` | `create_transaction` RPC에 **서버측 합계=0 검증 로직**. `0027_security_and_validations.sql`을 통해 완료. | ✅ |
| A-2-3 | B-05 | [OPT] | `CsvImportPage.tsx` | CSV Import 시 **건별 RPC 호출**(50건→50회 호출). 배치 RPC 또는 `Promise.all` 병렬처리 필요. | ⬜ |
| A-2-4 | B-06 | [FIX] | `AccountsPage.tsx` | ~~계좌 목록에 `opening_balance`만 표시 → `v_account_balance_actual` View 기반 실잔액 표시~~. useAccounts에서 View 활용 완료. | ✅ |
| A-2-5 | B-09 | [FEAT] | `TransactionsPage.tsx` | **거래 수정 기능** 미구현 (삭제는 완료됨). 전표 인라인 수정 또는 수정 모달 필요. | ⬜ |
| A-2-6 | B-10 | [FEAT] | `BudgetsPage.tsx` | **예산 항목 삭제 기능** 미구현. | ⬜ |

### A-3. 🟢 경미 (추후)

| # | ID | 유형 | 대상 파일 | 설명 | 상태 |
|---|---|---|---|---|---|
| A-3-1 | B-08 | [UX] | 전체 모달 (6+개 페이지) | 모달 **ESC 키 닫기** 핸들러 미구현. 공통 Modal 컴포넌트로 해결 예정. | ⬜ |
| A-3-2 | B-12 | [DOC] | `README.md` | Vite 기본 README → **프로젝트 소개, 설치 방법, 환경변수** 작성 필요. | ⬜ |

---

## 🔐 B. 보안 & RLS 정책

| # | ID | 유형 | 대상 | 설명 | 상태 |
|---|---|---|---|---|---|
| B-1 | D-02 | [SEC] | `budget_template_lines` | ~~RLS 정책 미적용 → 직접 접근 시 데이터 노출 가능~~ 0018에서 방어 완료. | ✅ |
| B-2 | D-03 | [SEC] | `classification_rules` | ~~RLS 정책 미적용~~ 0018에서 방어 완료. | ✅ |
| B-3 | D-05 | [SEC] | `import_profiles` | RLS 상태 미확인. **확인 후 정책 추가 완료 (`0027`)**. | ✅ |
| B-4 | S-03 | [SEC] | `index.html` | Content Security Policy(CSP) 헤더. Cloudflare `_headers` 문법 오류 수정 완료. | ✅ |
| B-5 | S-05 | [SEC] | `audit_logs` 관련 훅 | 주요 액션(마감, 대출생성)에 `audit_logs` INSERT 완료 (`0027`). | ✅ |

---

## ⚡ C. 성능 & 코드 품질 개선

| # | ID | 유형 | 대상 파일 | 설명 | 상태 |
|---|---|---|---|---|---|
| C-1 | O-03 | [OPT] | `useTransactions.ts` | 계좌 필터를 **클라이언트**에서 수행 중 → 서버 쿼리(`.eq`)로 변경하여 대용량 대응. | ⬜ |
| C-2 | O-04 | [OPT] | `useTradeHistory.ts` | 매매 이력을 `memo.ilike` 검색 → **`source` 컬럼** 활용으로 정확성 향상. | ⬜ |
| C-3 | C-01 | [OPT] | 6개 페이지 모달 | 인라인 모달 반복 → **공통 `Modal` 컴포넌트** 추출 (Portal + ESC + 오버레이 + 애니메이션). | ⬜ |
| C-4 | C-02 | [OPT] | `TransactionsPage.tsx` | 470줄 단일 파일 → `QuickAddModal`, `TransactionList`, `FavoriteList` 분리. | ⬜ |
| C-5 | C-04 | [OPT] | 전체 | `any` 타입 남용 (15곳+) → **Supabase 자동 타입** 또는 명시적 타입 정의. | ⬜ |
| C-6 | C-05 | [FIX] | `OnboardingPage.tsx` | ~~계좌 생성 시 `type: 'cash'` → `account_type`으로 수정~~ 이미 수정 완료됨. | ✅ |
| C-7 | C-07 | [OPT] | `GoalWidget.tsx` | 목표값을 `localStorage` → **DB(Supabase)** 저장으로 변경 (멀티 디바이스 동기화). | ⬜ |

---

## 🎨 D. UX/UI 개선

| # | ID | 유형 | 대상 | 설명 | 상태 |
|---|---|---|---|---|---|
| D-1 | UX-01 | [UX] | 전체 로딩 | "데이터를 불러오는 중..." 텍스트 → **Skeleton UI** (펄스 애니메이션). | ⬜ |
| D-2 | UX-02 | [UX] | 전체 빈 상태 | 단순 텍스트 → **일러스트 + CTA 버튼** 포함 Empty State. | ⬜ |
| D-3 | UX-04 | [UX] | `CurrencyInput` | 음수 금액 입력 불가 (숫자만 추출) → 환불 등 음수 처리 방법 검토. | ⬜ |
| D-4 | — | [UX] | `색상 팔레트` | 수입/지출/이체/경고 색상 통일. | ⬜ |

---

## 🚀 E. 기존 스프린트 미완료 항목

| # | 유형 | 대상 | 설명 | 상태 |
|---|---|---|---|---|
| E-1 | [FEAT] | Sprint 8 | 투자 **가격 업데이트 + 평가/배분 차트 연동** 마무리. | 🔄 |
| E-2 | [FEAT] | Sprint 9 | Dashboard에 **Phase 2 (대출/투자)** 데이터 반영. | ⬜ |
| E-3 | [DOC] | Sprint 9 | CHANGELOG v2.0 작성. | ⬜ |
| E-4 | [SEC] | Infra | 자동이체 인스턴스 **월초 자동 생성** Cron/Edge Functions. | ⬜ |

---

## 🆕 F. v3.0 신규 기능 (엑셀 통합 설계서 기반)

> **설계서**: `docs/v3.0_엑셀통합_설계서.md`

### Phase 1: DB 마이그레이션 (총 7건)

| # | 마이그레이션 | 설명 | 상태 |
|---|---|---|---|
| F-1-1 | `0020_transaction_tags.sql` | 태그 연동 전표 생성 RPC (`create_transaction_with_tags`). | ✅ 작성완료 |
| F-1-2 | `0021_loan_extend.sql` | `loans`에 `bank_name`, `repayment_priority` 컬럼 추가. | ✅ |
| F-1-3 | `0022_security_theme.sql` | `securities`에 `theme`, `is_dividend_stock` 컬럼 추가. | ✅ |
| F-1-4 | `0023_investment_targets.sql` | `investment_targets` 테이블 + RLS (목표 PF 비중 설정). | ✅ |
| F-1-5 | `0024_monthly_asset_snapshots.sql` | `monthly_asset_snapshots` 테이블 + RLS + 스냅샷 RPC. | ✅ |
| F-1-6 | `0025_monthly_contributions.sql` | `monthly_investment_contributions` 테이블 + RLS. | ✅ |
| F-1-7 | `0026_pet_care_logs.sql` | `pet_care_logs` 테이블 + RLS (훈트가르텐 소비 기록). | ✅ |

### Phase 2: 대출 페이지 확장

| # | 대상 파일 | 설명 | 상태 |
|---|---|---|---|
| F-2-1 | `LoansPage.tsx` | 대출 생성/수정 모달에 **은행명, 상환순위** 입력 필드 추가. | ✅ |
| F-2-2 | `LoansPage.tsx` | 대출 목록에 **은행명·순위 뱃지** 표시. | ✅ |
| F-2-3 | `LoanSimulatorPanel.tsx` | **워터폴 상환 시뮬레이션** (가용자금 → 순위별 자동 배분). | ✅ |

### Phase 3: 투자 페이지 4-탭 리팩토링 (핵심 작업)

| # | 대상 파일 | 설명 | 상태 |
|---|---|---|---|
| F-3-1 | `InvestmentsPage.tsx` | 기존 단일 페이지 → **4-탭 구조** 전환 (전체현황/테마별/계좌별/목표PF). | ✅ |
| F-3-2 | `components/investments/AccountTab.tsx` | **계좌별 PF 탭** — 기존 기능 + 환율 입력 + 원화 환산 + 테마 뱃지. | ⬜ |
| F-3-3 | `components/investments/ThemeTab.tsx` | **테마별 PF 탭** — 파이차트(현재 vs 목표) + 테마 클릭 시 종목 펼침. | ⬜ |
| F-3-4 | `components/investments/TargetTab.tsx` | **목표 PF 탭** — 목표 비중 설정 + 리밸런싱 갭 분석 + 월 정기투자 배분. | ⬜ |
| F-3-5 | `components/investments/OverviewTab.tsx` | **전체 현황 탭** — 월별 자산 추이 차트 + 순자산 라인 + 스냅샷 저장 버튼. | ⬜ |
| F-3-6 | `hooks/queries/useInvestments.ts` | `useInvestmentTargets`, `useMonthlySnapshots`, `useMonthlyContributions` 훅 추가. | ⬜ |

### Phase 4: 태그 & 개인 소비 기록

| # | 대상 파일 | 설명 | 상태 |
|---|---|---|---|
| F-4-1 | `TransactionsPage.tsx` | Quick Add 모달에 **태그 입력** (콤마 구분) UI 추가. | ⬜ |
| F-4-2 | `TransactionsPage.tsx` | 거래 목록에 **태그 칩(뱃지)** 표시. | ⬜ |
| F-4-3 | `TransactionsPage.tsx` | FilterBar에 **태그 필터** 추가. | ⬜ |
| F-4-4 | `pages/petcare/PetCareLogPage.tsx` | **훈트가르텐 이용 기록 로그 페이지** 신규. 입퇴실 일시 입력 → 요금 자동 계산. | ⬜ |
| F-4-5 | `App.tsx` + `AppLayout.tsx` | `/petcare` 라우트 추가 + 네비게이션 메뉴 항목 추가. | ⬜ |

### Phase 5: 카테고리 구조 & 마무리

| # | 대상 | 설명 | 상태 |
|---|---|---|---|
| F-5-1 | `CategoriesPage.tsx` | 엑셀 기반 **기본 카테고리 세트 적용** 버튼 (생활비/주거비/차량/오구 등 트리 batch insert). | ⬜ |
| F-5-2 | 월 마감 연동 | `close_month` RPC 호출 시 **`monthly_asset_snapshots` 자동 생성** 또는 독립 스냅샷 버튼. | ⬜ |
| F-5-3 | [DOC] | API 명세서 작성 (기존 RPC 7개 + 신규 RPC). | ⬜ |
| F-5-4 | [DOC] | CHANGELOG v3.0 작성. | ⬜ |

---

## 📊 집계 현황

| 구분 | 전체 | ✅ 완료 | ⬜ 미착수 | 🔄 진행중 |
|------|------|---------|----------|----------|
| A. 기존 버그/수정 | 11 | 8 | 3 | 0 |
| B. 보안/RLS | 5 | 5 | 0 | 0 |
| C. 성능/코드품질 | 7 | 2 | 5 | 0 |
| D. UX/UI | 4 | 0 | 4 | 0 |
| E. 스프린트 미완료 | 4 | 0 | 3 | 1 |
| F. v3.0 신규 | 21 | 11 | 10 | 0 |
| **총계** | **52** | **26** | **25** | **1** |

---

## 🏁 권장 실행 순서

```
[1단계] F-1 (DB 마이그레이션 7건) — 모든 기능의 기반
         ↓
[2단계] A-2-2 (서버 합계=0 검증) + B-3~5 (보안 보강)
         ↓
[3단계] F-2 (대출 확장) → F-3 (투자 4-탭) → F-4 (태그+소비기록)
         ↓
[4단계] A-2-5~6 (거래수정, 예산삭제) + C-3~4 (Modal·컴포넌트 분리)
         ↓
[5단계] D (UX 개선) + F-5 (카테고리·문서화·마무리)
```
