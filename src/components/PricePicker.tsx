import React from 'react';
import { WheelPicker, WheelPickerWrapper } from '@ncdai/react-wheel-picker';

interface PricePickerProps {
  dollarValue: string;
  centValue: string;
  onDollarChange: (val: string) => void;
  onCentChange: (val: string) => void;
  minDollars?: number;
  maxDollars?: number;
  label?: string;
  visibleCount?: number;
  optionItemHeight?: number;
}

const PricePicker: React.FC<PricePickerProps> = ({
  dollarValue,
  centValue,
  onDollarChange,
  onCentChange,
  minDollars = 0,
  maxDollars = 199,
  label,
  visibleCount = 7,
  optionItemHeight = 128,
}) => {
  const dollarOptions = Array.from({ length: maxDollars - minDollars + 1 }, (_, i) => {
    const val = (i + minDollars).toString();
    return { label: val, value: val };
  });
  const centOptions = Array.from({ length: 100 }, (_, i) => {
    const val = i.toString().padStart(2, '0');
    return { label: val, value: val };
  });

  return (
    <div style={{ width: 400, display: 'flex', flexDirection: 'row', justifyContent: 'center', gap: 32, margin: '0 auto', padding: 0 }}>
      {label && <div style={{ fontWeight: 600, fontSize: 18, marginRight: 16 }}>{label}</div>}
      <WheelPickerWrapper className="w-full flex flex-row gap-8">
        <WheelPicker
          options={dollarOptions}
          value={dollarValue}
          onValueChange={onDollarChange}
          visibleCount={visibleCount}
          optionItemHeight={optionItemHeight}
          classNames={{
            optionItem: 'text-zinc-400 text-2xl',
            highlightWrapper: 'invisible',
            highlightItem: 'invisible',
          }}
        />
        <WheelPicker
          options={centOptions}
          value={centValue}
          onValueChange={onCentChange}
          visibleCount={visibleCount}
          optionItemHeight={optionItemHeight}
          classNames={{
            optionItem: 'text-zinc-400 text-2xl',
            highlightWrapper: 'invisible',
            highlightItem: 'invisible',
          }}
        />
      </WheelPickerWrapper>
    </div>
  );
};

export default PricePicker; 