# Dyfine 전체 정합성 감사 보고서
# PRD 기획 의도 vs 현재 구현 — 8 에이전트 합동 점검

> 작성일: 2026-02-27 | 기준: PRD v1.1 vs 코드 v1.5  
> 참여: [PM] [DB Architect] [Frontend] [Backend] [Infra] [Designer] [Reviewer] [Scribe]

---

## 1. [PM] 기획 의도와 실현 상태 비교

### PRD 핵심 원칙 검증

| PRD 원칙 | 현재 상태 | 판정 |
|----------|----------|------|
| **"입력은 최소, 의사결정은 최대"** | 거래 입력 모달은 존재하나, **즐겨찾기/최근복제** 미구현 → 매번 수동 입력 필요 | ⚠️ 부분 |
| **생활비 세부 미기록, 월 1회 합산** | 합산 입력 전용 UI 없음, 일반 거래와 동일한 폼 사용 | ⚠️ 부분 |
| **큰 틀(L2) 중심 운영** | L1→L2 캐스케이드 선택 구현 완료 (E-05) ✅ | ✅ 달성 |
| **수동 통제 원칙** (오픈뱅킹 X) | 수동 입력만 가능, 외부 API 연동 없음 | ✅ 달성 |
| **Actual 기반 집계** (Expected는 오버레이) | Actual만 표시, Expected 오버레이 미구현 | ⚠️ 부분 |

### User Story 달성도 (Phase 1)

| US | 내용 | 상태 | 비고 |
|----|------|------|------|
| U1 | 계좌 등록, 당월 잔액/흐름 한눈에 | ⚠️ | 계좌 등록 ✅ / 잔액=기초잔액만 표시, **거래 반영 실잔액 미산출** |
| U2 | 자동이체 체크리스트 확인 → 실적 반영 | ✅ | 규칙 생성 + 수동 확정 → 전표 생성 작동 |
| U3 | 생활비 월 합산 기록, 예산 초과 확인 | ⚠️ | 예산 vs 실적 비교 ✅ / **월 합산 전용 입력 UI 없음** |
| U4 | 즐겨찾기/복제로 10초 내 입력 | ❌ | **즐겨찾기 템플릿, 최근 복제 기능 미구현** |
| U5 | CSV Import + 룰 기반 자동 분류 | ❌ | DB 스키마만 존재, **프론트/백엔드 미구현** |
| U6 | 월 마감 후 과거 불변 (조정 전표만) | ❌ | DB 스키마(`month_closings`) 존재, **UI/로직 미구현** |

> **[PM 소견]**: Phase 1 MVP의 핵심 6개 US 중 **완전 달성 1건(U2), 부분 달성 2건(U1, U3), 미달성 3건(U4, U5, U6)**. PRD에서 가장 강조한 "10초 입력(U4)"과 "월 마감 불변성(U6)"이 빠져 있는 것은 **기획 의도 대비 최대 GAP**.

---

## 2. [DB Architect] 스키마 정합성 검토

### PRD F1 vs DB: 계좌/그룹

| PRD 요구 | DB 스키마 | 코드 사용 | 판정 |
|----------|----------|----------|------|
| `account_groups` 테이블 | ✅ 존재 | ❌ **프론트에서 미사용** (useAccounts에서 group 관련 코드 제거) | ⚠️ 유실 |
| `account_type` 4종 (bank/brokerage/virtual/external) | ✅ 원본 | 프론트에서 6종으로 확장 (checking/savings/...) | ⚠️ 불일치 |
| `opening_balance` | ✅ | ✅ 사용됨 | ✅ |

### PRD F2 vs DB: 거래(복식부기)

| PRD 요구 | DB 스키마 | 코드 사용 | 판정 |
|----------|----------|----------|------|
| `transaction_entries` + `transaction_lines` | ✅ | ✅ RPC로 원자적 생성 | ✅ |
| `entry_tags` (태그 연결) | ✅ 테이블 존재 | ❌ **프론트에서 미사용** | ❌ 미구현 |
| 전표 라인 합계=0 검증 | ✅ RPC에서 검증 | ✅ | ✅ |
| 즐겨찾기 템플릿 | ❌ **테이블 없음** | ❌ | ❌ 스키마/코드 모두 없음 |
| 인박스(미분류) | ❌ 없음 | ❌ | ❌ |

### PRD F3 vs DB: 자동이체

| PRD 요구 | DB 스키마 | 코드 사용 | 판정 |
|----------|----------|----------|------|
| `auto_transfer_rules` | ✅ | ✅ CRUD 작동 | ✅ |
| `auto_transfer_instances` | ✅ | ⚠️ MVP 데모: 규칙 생성 시 수동으로 1건 생성 (Cron 미연결) | ⚠️ |
| 상태: `pending/confirmed/missed` | DB에는 `pending/confirmed/missed/skipped` | 프론트에서 `pending/completed/skipped` 사용 | ⚠️ 불일치 |
| 허용오차 (±일/금액) | ✅ DB 컬럼 존재 | ❌ 프론트에서 미활용 | ❌ |
| 알림 (Web Push) | ❌ 없음 | ❌ | ❌ |

### PRD F4 vs DB: 예산

| PRD 요구 | DB 스키마 | 코드 사용 | 판정 |
|----------|----------|----------|------|
| `budget_templates` + `budget_template_lines` | ✅ | ✅ CRUD 작동 | ✅ |
| `budget_month_overrides` (월별 오버라이드) | ✅ 테이블 존재 | ❌ **프론트에서 미사용** | ❌ |
| Plan vs Actual 표 | - | ✅ 카드 UI로 비교 | ✅ |

### PRD F5 vs DB: 월 마감

| PRD 요구 | DB 스키마 | 코드 사용 | 판정 |
|----------|----------|----------|------|
| `month_closings` | ✅ 테이블 존재 | ❌ **전혀 미사용** | ❌ |
| `is_locked` (전표 락) | ✅ `transaction_entries.is_locked` 컬럼 존재 | ❌ 미사용 | ❌ |
| 조정 전표 (`adjustment` 타입) | ✅ CHECK 제약에 포함 | ❌ 프론트에서 미노출 | ❌ |

### PRD F6 vs DB: CSV Import

| PRD 요구 | DB 스키마 | 코드 사용 | 판정 |
|----------|----------|----------|------|
| `import_profiles` | ✅ 테이블 존재 | ❌ 미사용 | ❌ |
| `classification_rules` (룰 엔진) | ✅ 테이블 존재 | ❌ 미사용 | ❌ |

> **[DB Architect 소견]**: 스키마 설계는 PRD를 충실히 반영했으나, **프론트/백엔드에서 활용되지 않는 테이블이 6개** (account_groups, entry_tags, budget_month_overrides, month_closings, import_profiles, classification_rules). 또한 `auto_transfer_instances.status` 값이 DB와 프론트에서 불일치 (`confirmed` vs `completed`).

---

## 3. [Frontend] 구현 완성도 평가

| 페이지 | PRD 대응 | 구현도 | 미구현 요소 |
|--------|---------|--------|------------|
| `LoginPage` | §2.2 로그인 | ✅ 100% | - |
| `OnboardingPage` | §2.1 가구 단위 운영 | ✅ 100% | 다중 구성원 초대 미구현 (Phase 2) |
| `DashboardPage` | F7 시각화 | ⚠️ 40% | Sankey ❌ / Balance(Projected) ❌ / Waterfall ❌ / 드릴다운 ❌ |
| `TransactionsPage` | F2 거래 입력 | ⚠️ 60% | 즐겨찾기 ❌ / 최근 복제 ❌ / 인박스 ❌ / 검색/필터 ❌ |
| `AccountsPage` | F1 계좌 관리 | ⚠️ 70% | 계좌그룹 ❌ / 비활성 숨김 ❌ |
| `CategoriesPage` | §5 분류 체계 | ⚠️ 70% | 초기 세트 자동 생성 ❌ / 태그 관리 ❌ |
| `TransfersPage` | F3 자동이체 | ⚠️ 60% | 허용오차 UI ❌ / missed 알림 ❌ / Cron 연동 ❌ |
| `BudgetsPage` | F4 예산 | ⚠️ 60% | 월별 override ❌ / 예정(Expected) 포함 옵션 ❌ |

> **[Frontend 소견]**: 각 페이지의 **기본 CRUD는 모두 동작**하나, PRD에서 요구한 **편의 기능(즐겨찾기, 복제, 인박스, 드릴다운, 필터)**이 전반적으로 빠져 있음. MVP 기능을 좁게 잡았지만, 이로 인해 PRD의 핵심 가치인 **"10초 입력"** 달성이 불가능한 상태.

---

## 4. [Backend] 서버 로직 점검

| 항목 | 상태 | 비고 |
|------|------|------|
| RPC `create_transaction` | ✅ | 복식부기 원자성 보장 |
| RPC `create_household_with_owner` | ✅ | SECURITY DEFINER로 RLS 우회 |
| 자동이체 확정 (`confirmInstance`) | ⚠️ | **RPC 미사용, 3단계 개별 쿼리로 원자성 미보장** |
| 대출 이자 계산 로직 | ❌ | Phase 2 (스키마만 준비) |
| CSV 파싱/룰 엔진 | ❌ | 미구현 |
| Cron (자동이체 인스턴스 생성) | ❌ | Cloudflare Worker 미연결 |

> **[Backend 소견]**: 핵심 거래 입력은 RPC로 안전하게 처리되지만, 자동이체 확정(confirmInstance)은 **Entry → Lines → Update를 개별 API로 호출**하여 중간 실패 시 고아 데이터 발생 위험. RPC로 래핑 필요.

---

## 5. [Infra] 배포/보안 점검

| PRD NFR 요구 | 현재 상태 | 판정 |
|-------------|----------|------|
| Supabase RLS (household_id 격리) | ✅ 전면 적용 | ✅ |
| is_locked DB 정책 (UPDATE/DELETE 차단) | ❌ **정책 미작성** | ❌ |
| audit_logs 기록 | ❌ 테이블 존재하나 **아무 곳에서도 INSERT 없음** | ❌ |
| CSP/XSS 방지 | ❌ Vite 기본 설정만 | ⚠️ |
| Rate limit (로그인) | ❌ Cloudflare 미설정 | ❌ |
| Cloudflare Turnstile | ❌ 미적용 | ❌ |
| Worker CRON (자동이체) | ❌ 미구성 | ❌ |
| Cloudflare Pages 배포 | ⚠️ 이전 대화에서 설정 시도, 현재 로컬 개발 중 | ⚠️ |

> **[Infra 소견]**: RLS는 잘 적용되어 있으나, **PRD에서 필수로 요구한 `is_locked` DB 정책과 `audit_logs` 기록이 완전 부재**. 보안 측면에서 CSP, Turnstile 등 프론트 보안도 미적용 상태.

---

## 6. [Designer] UI/UX 정합성

| PRD/피드백 요구 | 현재 상태 | 판정 |
|---------------|----------|------|
| 미니멀리즘, 색상 최소화 | ✅ 그레이 + 인디고 + 최소 색상 | ✅ |
| 반응형 디자인 | ✅ 데스크탑/모바일 모두 대응 | ✅ |
| 직관적 버튼/동선 | ✅ 설정 드롭다운으로 메뉴 정리 (E-08) | ✅ |
| ₩ 콤마 포맷팅 | ✅ CurrencyInput 적용 | ✅ |
| 에러/알림 UX | ⚠️ `alert()` 사용 → 네이티브 브라우저 다이얼로그, 미려하지 않음 | ⚠️ |
| 대시보드 시각화 (Sankey/Waterfall) | ❌ 파이+막대 차트만 존재 | ❌ |
| 로딩 UX | ⚠️ "데이터를 불러오는 중..." 텍스트만 (스켈레톤 UI 없음, E-02 미대응) | ⚠️ |

> **[Designer 소견]**: 전반적으로 깔끔한 미니멀 디자인이지만, PRD에서 강조한 **Sankey 다이어그램과 Waterfall 차트**가 부재. 또한 `alert()` 기반 알림은 금융 서비스 품질에 부적합.

---

## 7. [Reviewer] Critical GAP 종합

### PRD vs 코드: 최대 괴리 Top 5

| 순위 | PRD 요구 | 현재 상태 | 영향 |
|------|---------|----------|------|
| 🔴 1 | **U4: 즐겨찾기/복제로 10초 입력** | 미구현 (스키마도 없음) | PRD 핵심 가치 위배 |
| 🔴 2 | **F5: 월 마감 + 전표 락** | DB만 존재, 로직/UI 없음 | 감사성 미보장 |
| 🔴 3 | **F6: CSV Import + 룰 엔진** | DB만 존재, 전혀 미구현 | 데이터 입력 편의 부재 |
| 🔴 4 | **F7: Sankey/Waterfall 시각화** | 파이+막대만 구현 | 현금 흐름 가시성 부족 |
| 🟡 5 | **U1: 실잔액 (Actual Balance)** | 기초잔액만 표시, 거래 반영 없음 | 자산 현황 부정확 |

---

## 8. [Scribe] 문서 현황 및 권고

### 현재 문서 현황

| 문서 | 파일 | 상태 |
|------|------|------|
| PRD | `01_PRD.md` | ✅ 완성 (v1.1) |
| Phase 1 테스트 절차서 | `docs/Phase1_테스트_절차서.md` | ✅ 완성 (결과 포함) |
| Phase 1 피드백 정리 | `docs/Phase1_테스트_피드백_정리.md` | ✅ 완성 |
| 전체 검토 보고서 | `docs/프로젝트_전체_검토_보고서.md` | ✅ 완성 (v1.5) |
| API 명세서 | — | ❌ **미작성** |
| 시스템 구조도 (별도) | — | ❌ 검토 보고서 내에만 존재 |
| 데이터 사전/ERD | — | ❌ 검토 보고서 내에만 존재 |
| Changelog | — | ❌ 검토 보고서 내에만 존재 |

> **[Scribe 소견]**: API 명세서와 별도의 ERD/데이터사전이 독립 문서로 필요. 현재 검토 보고서 안에 포함되어 있으나, 개발 시 빠르게 참조할 수 있는 별도 문서가 부재.

---

## 9. 전체 에이전트 합의: 우선 수정 로드맵

### 🔴 Phase 1 완성을 위한 필수 보충 (Critical)

| # | 작업 | 담당 | PRD 참조 |
|---|------|------|---------|
| 1 | `householdId` useEffect 의존성 수정 (3개 페이지) | Frontend | 기존 버그 |
| 2 | 자동이체 확정을 RPC로 원자화 | Backend, DB | F3 |
| 3 | 실잔액 계산 (기초잔액 + 거래 합산) | Frontend, Backend | U1 |
| 4 | 즐겨찾기 템플릿 + 최근 복제 | Frontend, DB | U4 (핵심) |
| 5 | 월 마감 + 전표 락 UI/로직 | Frontend, Backend, DB | F5, U6 |
| 6 | 기존 `bank` 타입 계좌 데이터 마이그레이션 | DB | 기존 버그 |

### 🟡 Phase 1+ 추가 개선 (Recommended)

| # | 작업 | 담당 |
|---|------|------|
| 7 | Toast 알림 교체 (alert → Toast UI) | Frontend, Designer |
| 8 | 태그 관리 UI + entry_tags 연동 | Frontend, Backend |
| 9 | CSV Import + 룰 엔진 프론트 | Frontend, Backend |
| 10 | Sankey/Waterfall 차트 추가 | Frontend, Designer |
| 11 | audit_logs INSERT 로직 추가 | Backend |
| 12 | `is_locked` DB 정책 + 조정 전표 UI | Backend, DB |

---

## 10. 결론

> **PRD 기획 의도 반영률: 약 55%**

현재 시스템은 **CRUD 기반의 골격**은 잘 갖춰져 있으나, PRD가 강조한 **편의성(10초 입력)**, **불변성(월 마감/전표 락)**, **가시성(Sankey/Waterfall)**이라는 세 가지 핵심 가치 중 **편의성과 불변성이 미달성** 상태입니다.

DB 스키마는 PRD를 충실히 반영하여 확장 기반이 이미 마련되어 있으므로, **프론트엔드/백엔드 구현을 PRD에 맞춰 보충**하는 것이 최우선 과제입니다.
