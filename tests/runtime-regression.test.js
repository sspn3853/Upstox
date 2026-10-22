const assert = require('assert');

const tokenManager = require('../tokenManager');
assert.strictEqual(typeof tokenManager.isTokenExpired, 'function', 'isTokenExpired should be exported');

const { decodeSymbol } = require('../symbolDecoder');
assert.deepStrictEqual(decodeSymbol('NIFTY26O1920050CE'), {
	symbol: 'NIFTY',
	strike: 20050,
	optionType: 'CE',
	day: '19',
	month: 'OCT',
	year: '26',
	instrumentType: 'OPT',
	exchange: 'NFO',
	tradingSymbol: 'NIFTY 20050 CE 19 OCT 26',
	isDecoded: true
});
const monthlyOption = decodeSymbol('NIFTY26oct23000PE');
assert.strictEqual(monthlyOption.symbol, 'NIFTY');
assert.strictEqual(monthlyOption.year, '26');
assert.strictEqual(monthlyOption.month, 'OCT');
assert.strictEqual(monthlyOption.strike, 23000);
assert.strictEqual(monthlyOption.optionType, 'PE');
assert.strictEqual(monthlyOption.expiryMonthOnly, true);
assert.deepStrictEqual(decodeSymbol('GOLDPETAL26OCTFUT'), {
	symbol: 'GOLDPETAL',
	day: '',
	month: 'OCT',
	year: '26',
	instrumentType: 'FUT',
	exchange: 'MCX_FO',
	tradingSymbol: 'GOLDPETAL FUT OCT 26',
	isDecoded: true
});

const { getLookupCandidates } = require('../instrumentStore');
const lookupCandidates = getLookupCandidates('NIFTY26O1920050CE');
assert.ok(lookupCandidates.includes('NIFTY20050CE19OCT26'), 'weekly compact option lookup should include compact strike-style alias');
assert.ok(lookupCandidates.includes('NIFTY 20050 CE 19 OCT 26'), 'weekly compact option lookup should include spaced trading symbol alias');
const { findInstrument, getFutureIdentity } = require('../instrumentStore');
assert.deepStrictEqual(getFutureIdentity('GOLDPETAL26DECFUT'), {
	symbol: 'GOLDPETAL',
	month: 'DEC',
	year: '26'
});
assert.strictEqual(findInstrument('GOLDPETAL FUT OCT 26').instrument_key, 'MCX_FO|571306');
assert.strictEqual(findInstrument('GOLDPETAL FUT DEC 26'), null, 'future lookup must not match another expiry month');

const orderService = require('../orderService');
assert.ok(orderService && typeof orderService.placeOrder === 'function', 'placeOrder should be available');

console.log('runtime regression checks passed');
