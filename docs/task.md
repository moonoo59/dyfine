# Dyfine 프로젝트 — 작업 체크리스트

## Sprint 1 — 기반 보강 (DB + 공통 컴포넌트)
- [x] **[CRITICAL] is_locked RLS**: 마감 전표 UPDATE/DELETE 방지 정책 적용 완료
- [x] **account_groups 테이블**: 계좌 그룹 생성 + accounts.group_id FK 완료
- [x] **notifications 테이블**: 알림 시스템 DB 기반 완료
- [x] **audit_logs 테이블**: 감사 로그 완료
- [x] **권장 View 생성**: v_account_balance_actual, v_monthly_category_actual 완료
- [x] **공통 FilterBar 컴포넌트** 완료
- [x] **공통 MonthPicker 컴포넌트** + BudgetsPage/ClosingPage 적용 완료
- [ ] **색상 팔레트 정리**: 수입/지출/이체/경고 색상 통일 (Sprint 2에서 차트와 함께 처리)

## Sprint 2 — Dashboard 고도화
- [x] 기간 선택 (MonthPicker 적용) + useDashboardData 기간 파라미터 확장
- [x] KPI 보강 (총자산, 현금성 잔액, 수입, 지출, 미확인 이체 건수/금액)
- [x] FlowChart (Sankey 대체) / BalanceChart / WaterfallChart 컴포넌트
- [x] 해야 할 일 위젯 + 최근 거래 내역

## Sprint 3 — Transactions 고도화
- [x] 탭 (전체/인박스/즐겨찾기/Import), FilterBar 연결
- [x] 즐겨찾기 템플릿 DB 구현 (`0012_favorite_templates.sql` + `useFavorites` 훅)
- [x] `useTransactions` 훅 (필터/페이지네이션)
- [x] TransactionsPage 전체 재구성

## Sprint 4 — CSV Import + 분류 룰
- [x] CSV 업로드/파싱/미리보기 (`CsvImportPage` + Papa Parse)
- [x] 컴럼 매핑 UI + 선택적 Import
- [x] 분류 룰 관리 (`ClassificationRulesPage`) - 패턴 CRUD/활성 토글
- [x] App.tsx 라우팅 + AppLayout 네비 연결

## Sprint 5 — Reports + Notifications
- [x] `ReportsPage` (MonthPicker/FilterBar/파이+바차트/CSV Export)
- [x] `NotificationsPage` (읽음/미읽음 처리)
- [x] `useNotifications` 훅 + GNB 알림 뼉지

## Sprint 6 — 보안/인프라/QA (Phase 1 릴리스)
- [x] Vite 코드 분할 (`manualChunks` — recharts/supabase/react 분리, 500KB 경고 해결)
- [x] GitHub Actions CI (`ci.yml` — tsc + vite build)
- [x] `rls_audit.sql` RLS 전수 점검 스크립트
- [x] Cloudflare 보안 헤더 (`public/_headers` — CSP/X-Frame-Options)
- [x] `CHANGELOG.md` v1.0 작성

## Sprint 7 — Phase 2: 대출 코어
- [x] 대출 DB 스키마 확인 + create_loan RPC
- [x] 대출 목록/상세 페이지
- [x] 금리 이력 편집 UI
- [x] 추가상환 시뮬레이터

## Sprint 8 — Phase 2: 투자 코어
- [x] 투자 DB RLS 정책 및 record_trade RPC 구현
- [x] useHoldings, useSecurities, useRecordTrade 훅 생성
- [/] InvestmentsPage UI 개발 (중간 푸시 완료)
- [ ] 가격 업데이트 + 평가/배분 차트 연동 완료 필요

## Sprint 9 — Phase 2 고도화/QA
- [ ] Dashboard Phase 2 반영
- [ ] Changelog v2.0
