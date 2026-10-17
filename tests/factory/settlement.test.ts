import { describe,expect,it } from 'vitest';
import { ammPayoutNative,bookPayoutNative } from '../../src/factory/factoryTrade/settlement.js';
const unit=10n**12n;
describe('per-venue settlement units',()=>{
 it('floors AMM WAD only after calculating the selected payout',()=>{
  expect(ammPayoutNative(1,unit+1n,10n*unit,6)).toBe(1n);
  expect(ammPayoutNative(0,unit,2n*unit,6)).toBe(2n);
  expect(ammPayoutNative(2,unit,2n*unit,6)).toBe(1n);
  expect(ammPayoutNative(2,1n,2n,18)).toBe(1n);
 });
 it('uses only book free inventory and carries INVALID native half-units',()=>{
  expect(bookPayoutNative(1,3n*unit-unit,0n,unit,0n)).toBe(2n);
  expect(bookPayoutNative(2,unit,2n*unit,unit,0n)).toBe(1n);
  expect(bookPayoutNative(2,unit,2n*unit,unit,1n)).toBe(2n);
 });
 it('fails closed for impossible reservations or carry',()=>{
  expect(()=>bookPayoutNative(1,-1n,0n,unit,0n)).toThrow();
  expect(()=>bookPayoutNative(2,unit,0n,unit,2n)).toThrow();
 });
});
