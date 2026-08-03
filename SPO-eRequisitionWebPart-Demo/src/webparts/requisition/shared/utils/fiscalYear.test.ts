import { mapFiscalYearOptions } from './fiscalYear';
import { ISharePointItem } from '@/shared/types';

describe('mapFiscalYearOptions', () => {
  it('uses Year for both value and label, removes blanks and duplicates, and sorts numerically', () => {
    const items: ISharePointItem[] = [
      { Year: '2627' },
      { Year: ' 2526 ' },
      { Year: '' },
      { Year: null },
      { Year: '2526' },
      { Year: '1920' },
    ];

    expect(mapFiscalYearOptions(items)).toEqual([
      { value: '1920', label: '1920' },
      { value: '2526', label: '2526' },
      { value: '2627', label: '2627' },
    ]);
  });
});
