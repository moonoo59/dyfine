# Dyfine Requirements & API Specifications

이 문서는 Dyfine의 비즈니스 요구사항(PRD), 외부 데이터 설계 및 시스템의 핵심 API(RPC) 명세를 관리합니다.

---

## 📑 1. PRD 정합성 및 요구사항 (2026-03-04)

Dyfine은 "가족 단위의 자산 관리 최적화"를 목표로 하며, 다음 5가지 핵심 요구사항을 준수합니다.

1.  **복식부기 원칙**: 모든 자금 흐름은 자산/부채/수입/지출 계정 간의 대차 평형을 이뤄야 함.
2.  **가족 프라이버시 & 공유**: 공동 자산은 공유하되, 개인 용돈 및 특정 기록은 RLS 정책으로 철저히 분리.
3.  **엑셀 모델 이식**: 고도화된 재무 엑셀의 "상환 계획"과 "투자 목표" 로직을 시스템 내에 구현.
4.  **자동화 엔진**: 반복되는 이체 및 대출 원리금 상환을 스케줄러(`pg_cron`)로 자동화.
5.  **데이터 무결성**: 마감된 월의 거래는 `is_locked` 처리를 통해 수정을 방지하고 스냅샷으로 보존.

---

## 📡 2. API (Supabase RPC) 명세

### 2-1. 거래 및 마감 (Transactions & Closing)
- **`create_transaction_with_tags`**: 복식부기 전표 생성 및 태그 자동 연결.
- **`close_month`**: 해당 월의 전표를 잠금 처리하고 데이터 무결성 보장.
- **`confirm_auto_transfer`**: 생성된 자동이체 초안을 실제 전표로 확정.

### 2-2. 대출 (Loans)
- **`create_loan`**: 대출 및 전용 계좌 생성, 상환 스케줄 기초 데이터 설정.
- **`generate_monthly_loan_entries`**: (Scheduler) 매월 납입일에 맞춰 원리금 상환 전표 자동 생성.

### 2-3. 투자 (Investments)
- **`record_trade`**: 종목 매매 기록 및 보유 수량 자동 업데이트.
- **`update_holding_snapshot`**: 종목별 보유 현황 및 평가가치 스냅샷 저장.
- **`update_security_prices`**: 실시간 또는 수동 입력된 종목 현재가 일괄 업데이트.

---

## 📊 3. 외부 데이터 참조 (Spreadsheet Mapping)

기존 사용 중인 재무 엑셀 시트와의 데이터 매핑 구조입니다.

| 시트명 | 필드 | DB 테이블/컬럼 |
|---|---|---|
| 대출현황 | 은행명, 상환순위 | `loans.bank_name`, `loans.repayment_priority` |
| 전체(자산) | 월별 평가액 | `monthly_asset_snapshots.snapshot_json` |
| 목표PF | 테마별 비중 | `investment_targets.target_weight` |
| 훈트가르텐 | 입퇴실 시간 | `petcare_logs.check_in/out` |

> 상세 스프레드시트 링크 및 참고 자료는 팀 내부 공유 폴더의 `spreadsheet link.md`를 참조하십시오.
