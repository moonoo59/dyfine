# CHANGELOG v3.0

> 릴리즈 날짜: 2026-03-04

## 🚀 신규 기능

### Phase 1: DB 마이그레이션 (7건)
- 투자 목표 비중 테이블 (`investment_targets`)
- 월간 자산 스냅샷 테이블 (`monthly_asset_snapshots`)
- 월간 투자 기여 테이블 (`monthly_contributions`)
- 거래 태그 시스템 (`tags`, `entry_tags`)
- 보안 강화 및 유효성 검사 RPC 리팩토링

### Phase 2: 대출 확장
- **LoanPaymentSchedulePanel**: 상환 스케줄표 (원리금균등/원금균등 지원)
- **LoanSimulatorPanel**: 워터폴(가용자금 순위별) 상환 시뮬레이션
- 대출 상세 정보 분석 기능 추가

### Phase 3: 투자 페이지 4-탭 리팩토링
- **전체현황 탭** (`OverviewTab`): 월별 자산 추이 차트 + 순자산 라인 + 스냅샷 저장
- **테마별 탭** (`ThemeTab`): 파이차트(현재 vs 목표) + 테마 클릭 시 종목 펼침
- **계좌별 탭** (`AccountTab`): 환율 입력 + 원화 환산 + 테마 뱃지
- **목표PF 탭** (`TargetTab`): 목표 비중 설정 + 리밸런싱 갭 분석 + 월 정기투자 배분
- `useMonthlySnapshots`, `useMonthlyContributions` 훅 추가

### Phase 4: 태그 & 개인 소비 기록
- Quick Add 모달에 **태그 입력** (콤마 구분) UI
- 거래 목록에 **태그 칩(뱃지)** 표시
- FilterBar에 **태그 필터** 추가
- **오구장장 훈트가르텐** 이용 기록 페이지 신규 (`/petcare`)
  - 입퇴실 일시 기록 + 시간당 요금 자동 계산
  - 수동 입력 모달 지원
- 즐겨찾기 템플릿에 **태그 저장/불러오기** 지원

### Phase 5: 카테고리 구조 & 마무리
- **기본 카테고리 세트 일괄 적용** 버튼 (10개 대분류 + 50개+ 소분류)
  - 한국 가계부 표준 + 독일 생활 + 반려동물(오구) 특화
- 카테고리 **삭제** 기능 추가 (대분류/소분류 모두)
- 월 마감 시 **순자산 스냅샷 자동 생성** (`monthly_asset_snapshots`)
- API 명세서 작성 (`docs/api_spec.md`)

---

## 🗄️ DB 마이그레이션 추가 목록

| 번호 | 파일 | 내용 |
|------|------|------|
| 0024 | `monthly_asset_snapshots.sql` | 월별 순자산 스냅샷 |
| 0025 | `investment_targets.sql` | 투자 목표 비중 |
| 0026 | `monthly_contributions.sql` | 월 정기투자 금액 |
| 0027 | `security_and_validations.sql` | RPC 보안 강화 리팩토링 |
| 0028 | `favorite_record_tags.sql` | 즐겨찾기에 태그 컬럼 추가 |
| 0029 | `petcare_logs.sql` | 훈트가르텐 이용 기록 |

---

## 📊 전체 진행률 (v3.0 기준)

| 구분 | 완료 / 전체 |
|------|-------------|
| F. v3.0 신규 기능 | **21 / 21** (100%) |
| 전체 태스크 | **35 / 52** (67%) |

---

## 📁 수정된 주요 파일

- `src/pages/transactions/TransactionsPage.tsx` — 태그 입력, 칩 표시, 필터 연동
- `src/hooks/queries/useTransactions.ts` — 태그 조인 쿼리 + 태그 필터링
- `src/components/ui/FilterBar.tsx` — 태그 검색 필드 추가
- `src/hooks/queries/useFavorites.ts` — FavoriteTemplate에 tags 필드 추가
- `src/pages/petcare/PetCareLogPage.tsx` — **신규** 훈트가르텐 페이지
- `src/hooks/queries/usePetCare.ts` — **신규** CRUD 훅
- `src/pages/settings/CategoriesPage.tsx` — 기본 세트 적용 + 삭제 기능
- `src/pages/closing/ClosingPage.tsx` — 순자산 스냅샷 자동 생성
- `src/App.tsx` — `/petcare` 라우트 추가
- `src/components/layout/AppLayout.tsx` — '오구장장' 메뉴 추가

---

## ⚠️ 알려진 이슈

- `npx supabase db push`가 Windows PowerShell 실행 정책 문제로 실패 — SQL은 Supabase Dashboard에서 직접 실행 필요
- 카테고리 대분류 삭제 시 CASCADE 동작은 DB 스키마에 따라 다를 수 있음
