import { useState, useEffect } from 'react';

/**
 * 금액 입력 컴포넌트 (1,000원 단위 콤마 자동 포맷팅)
 * - 사용자가 입력하면 숫자만 추출하여 콤마 포맷팅 적용
 * - 외부에는 순수 숫자(number)로 값을 전달
 */
interface CurrencyInputProps {
    value: number;
    onChange: (value: number) => void;
    placeholder?: string;
    className?: string;
    required?: boolean;
}

export default function CurrencyInput({
    value,
    onChange,
    placeholder = '예) 100,000',
    className = '',
    required = false,
}: CurrencyInputProps) {
    // 화면에 보여줄 포맷된 문자열 (콤마 포함)
    const [displayValue, setDisplayValue] = useState<string>(
        value > 0 ? value.toLocaleString() : ''
    );

    // 외부에서 value가 바뀌면 display도 동기화
    useEffect(() => {
        setDisplayValue(value > 0 ? value.toLocaleString() : '');
    }, [value]);

    // 입력 핸들러: 숫자 외 문자 제거 → 콤마 포맷 → 상위 전달
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value.replace(/[^0-9]/g, ''); // 숫자만 추출
        const numericValue = parseInt(rawValue, 10) || 0;

        // 콤마 포맷팅된 문자열로 표시
        setDisplayValue(numericValue > 0 ? numericValue.toLocaleString() : '');

        // 상위 컴포넌트에는 순수 숫자 전달
        onChange(numericValue);
    };

    return (
        <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₩</span>
            <input
                type="text"
                inputMode="numeric"
                value={displayValue}
                onChange={handleChange}
                required={required}
                placeholder={placeholder}
                className={`pl-8 ${className}`}
            />
        </div>
    );
}
