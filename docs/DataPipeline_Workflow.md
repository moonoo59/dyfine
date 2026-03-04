# Dyfine Data Pipeline & Workflow (v1.0)
작성일: 2026-03-04
작성자: [Scribe] 서기 & [PM] 프로젝트 매니저

---

## 🧭 [PM] 프로젝트 매니저의 개요

Dyfine은 일반적인 가계부처럼 "하나의 레코드 = 하나의 수입/지출" 이라는 단순 구조가 아닙니다. 은행처럼 **복식부기(Double-entry bookkeeping)**를 기반으로 모든 자금 흐름을 철저히 추적합니다. 돈은 허공에서 생기거나 사라지지 않고, 반드시 '어디선가 빠져나가서 다른 어딘가로 들어가는 과정'을 기록합니다.

따라서 데이터 파이프라인과 프론트엔드의 워크플로우를 명확히 정의하는 것이 다음 개발 단계(거래 수정, 수동/자동이체 고도화, 투자/대출 연동)의 핵심입니다.

---

## 🌊 1. Data Pipeline (데이터 파이프라인)

어떤 경로로든(수동 입력, 엑셀 Import, 뱅크샐러드 연동 등) 들어온 데이터는 반드시 **결정된 하나의 길(파이프라인)**을 통과해 원장(Ledger)에 기록됩니다.

### 1단: 입력 (Input Layer)
데이터가 생성되는 진입점입니다.
- **수동 입력 (Quick Add / Excel Import)**: 프론트엔드에서 폼을 입력하거나 CSV를 업로드. (현재 구현됨)
- **자동이체 스케줄러**: Supabase `pg_cron`이 매일 새벽(KST 02:00) `process_auto_transfers()` 함수를 실행해 조건에 맞는 내역을 임시 테이블(`auto_transfer_instances`)에 쌓음.
- **(미래연동) 마이데이터 / 외부 API 연동**: Webhook이나 Polling으로 들어온 원시 데이터를 가공.

### 2단: 전표 분개 (RPC Middleware - `create_transaction`)
들어온 모든 데이터 덩어리는 Supabase RPC 함수인 **`create_transaction`**을 통해서만 DB에 들어갈 수 있습니다.
- **검증**: `household_id` 소속, 양수/음수 밸런스 매칭 검증.
- **헤더 생성**: `transaction_entries`에 1줄짜리 헤더(일시, 출처, 전표유형) 생성.
- **라인 생성**: `transaction_lines`에 복수(최소 2개 이상)의 라인 생성.
  - 예시(지출): `계좌 (-50,000)` / `카테고리:식비 (+50,000)`
  - 예시(이체): `내통장_A (-10,000)` / `내통장_B (+10,000)`

### 3단: 집계 (View & Materialization)
복식부기로 쪼개진 라인(`transaction_lines`)을 프론트엔드에서 그대로 쓰기엔 너무 무겁습니다. 집계를 위해 데이터베이스 View를 거쳐 읽습니다. (방금 최적화 완료한 사항)
- **`v_account_balance_actual`**: 각 계좌의 기초 잔액(`opening_balance`)과 모든 `transaction_lines`의 변동액을 더해 **현재 남아있는 정확한 잔액** 산출.
- **`v_monthly_category_actual`**: 월별・카테고리별로 `transaction_entries`와 `lines`를 조인하여 **수입/지출 통계** 산출.

---

## 🔄 2. Core Workflow (핵심 워크플로우)

프론트엔드와 사용자가 상호작용하는 흐름입니다.

### [Workflow A] 일상적인 거래 수기 등록
1. User가 [Transactions] 페이지에서 **Quick Add** 모달 오픈
2. [지출] 탭 → 금액: 10,000원, 출금계좌: 농협카드, 대분류: 식비, 메세지: "스타벅스"
3. React Query가 `supabase.rpc('create_transaction', {...})` 호출
4. RPC 통과 후 성공 응답 받음
5. React Query가 `invalidateQueries`로 캐시 무효화 → [Accounts], [Dashboard] 즉각 재조회
6. View(`v_account_balance_actual`)가 1초 만에 최신 잔액 갱신 반환
7. User 화면에 잔액 10,000원 차감된 결과 즉각 표시

### [Workflow B] 거래 내역 수정/삭제 (다음 로드맵 목표)
삭제는 이미 구현되어 있지만 '수정(Update)'은 복잡합니다.
1. User가 [Transactions] 리스트에서 특정 거래 **'수정'** 버튼 클릭
2. 모달에 기존 데이터 바인딩 (금액 1만원 → 5천원)
3. **[DB Architect 관점]** 
   - 전표(Entry)가 잠금(`is_locked=true`) 상태인지 확인 (잠겼으면 에러 처리)
   - `UPDATE transaction_lines` 직접 수정보다 **`update_transaction`** RPC를 하나 만드는 것이 안전함. 내부적으로 기존 `lines`를 `DELETE`하고 새로 전달받은 `lines`를 `INSERT`하는 것이 부기 무결성이 안 깨짐.
4. 수정 완료 후 캐시 무효화 + 뷰 최신화

### [Workflow C] 월 마감 (Month Closing)
한 달이 지나고 누군가가 마음대로 과거 기록을 고치면 가계부가 망가집니다.
1. User가 [Dashboard/Settings]에서 "2026년 2월 마감하기" 실행
2. Audit Log(감사 로그)가 남고, 이번 달의 잔액 스냅샷이 JSON으로 `month_closings` 테이블에 박제됨.
3. 2월에 발생한 모든 `transaction_entries`의 `is_locked`를 `true`로 바꿈.
4. RLS 규칙(` Members can update unlocked transaction_entries `)에 의해 아무도 2월 전표를 강제로 수정/삭제 불가!
5. 2월에 누락된 거래를 뒤늦게 발견하면? → "3월" 일자로 "조정(adjustment)" 전표를 따로 생성하여 밸런스 복구.

---

## 🚀 3. 다음으로 나아갈 로드맵 (Next Action Items)

위의 워크플로우를 실제 앱으로 현실화하기 위한 우선순위입니다.

### Phase 1: Transactions 디테일 완성 (현재)
- [ ] **거래 내역 수정(Update) 기능 구현**: `update_transaction` RPC 생성 및 프론트 모달 연동. (가장 중요)
- [ ] **Import 기능 (csv)**: 은행사 엑셀 내역을 파싱하여 대량의 `create_transaction`을 쏘는 페이지.
- [ ] **자동이체(지출/수입) 엔진 활성화**: 스케줄러가 잡아낸 `pending` 상태 이체건을 승인(Confirm)하는 프론트 화면.

### Phase 2: 투자(Investment) 특화 모듈
- [ ] **종목 관리(Holdings) 및 차트 연동**: 주식/펀드 매수 매도를 단순 '지출/수입'이 아니라 보유주식 수량 증가(RPC `record_trade` 활용)와 연계.
- [ ] **포트폴리오 대시보드**: 투자 평가가치(Value)와 원금(Invested) 기준 수익률 UI/UX 시각화 구현.

### Phase 3: 대출(Loans) 특화 모듈
- [ ] **대출 원장(Ledger) 스케줄 시각화**: 원금균등/원리금균등 이자 시뮬레이터 차트.
- [ ] **상환/중도상환 프로세스**: 수동 일반 지출 전표 ↔ 대출 상환금(원리금) 전표간의 트리거 시스템 구축.
