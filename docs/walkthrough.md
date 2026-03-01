# Dyfine Phase 1 & 2 WIP Walkthrough

## 커밋 이력

| 커밋 | 내용 | 변경 |
|---|---|---|
| `95226d2` | Sprint 1 기반 보강 | 5 files, +457/-60 |
| `7558e28` | Sprint 2 Dashboard 고도화 | 5 files, +499/-89 |
| `c9ea303` | Sprint 3 Transactions 고도화 | 4 files, +475/-125 |
| `bb45571` | Sprint 4 CSV Import + 분류 룰 | 6 files, +540 |
| `ecfbc11` | Sprint 5 Reports + Notifications | 5 files, +352 |
| `2e2760e` | Sprint 6 보안/인프라/QA | 5 files, +144 |
| `eb773b1` | Sprint 7 Loan Core (Phase 2) | 5 files, +500 |
| `f242570` | Sprint 8 Investment Core (Phase 2 WIP) | 3 files, +580 |
| `c100ab6` | fix: resolve TS build errors | 3 files, +/- |

---

## 작업 내용 (Sprint 7, 8)

### Sprint 7 — 대출 코어 (완료)
- `0013_loan_core.sql`: 대출 RLS 정책 및 `create_loan` RPC
- `useLoans.ts`: 대출 목록/금리/원장 조회 훅
- `LoansPage.tsx`: 대출 현황 조회, 상세 원장, 금리 이력, 추가상환 시뮬레이터

### Sprint 8 — 투자 코어 (완료)
- `0014_investment_core.sql`: 투자 RLS 및 `record_trade` RPC (매매 거래 통합 처리)
- `useInvestments.ts`: `useHoldings`, `useSecurities`, `useRecordTrade`, `useCreateHoldingSnapshot`, `useUpdateSecurityPrices` 훅 및 `useTradeHistory` 훅
- `InvestmentsPage.tsx`: 요약 카드, 보유 종목, 매매/가격 업데이트, 자산 차트 구현
- `0015_investment_snapshot.sql`: `update_holding_snapshot`, `update_security_prices` RPC

### Sprint 9 — Phase 2 고도화/QA (완료)
- `DashboardPage.tsx`: 대출 및 투자 정보(대출 납입 예정, 투자 평가액/수익률)를 위한 위젯 연동. `useDashboardData.ts` 수정
- `ClosingPage.tsx`: 마감 전 대출 납입 여부 확인 경고 메세지 추가, 보유 투자 자산 스냅샷 동시 생성 연동 완료
- `0016_loan_cron.sql`: `generate_monthly_loan_entries` RPC를 통해 매크론 잡에서 대출 원장 갱신(이자 등) 지원 구축

---

## 검증 결과
- `tsc --noEmit` & `vite build`: ✅ 통과
- Git Push: ✅ `main` 브랜치 반영 대기 중
