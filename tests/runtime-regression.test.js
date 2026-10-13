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
	tradingSymbol: 'NIFTY 19 OCT 26 20050 CE',
	isDecoded: true
});

const orderService = require('../orderService');
assert.ok(orderService && typeof orderService.placeOrder === 'function', 'placeOrder should be available');

console.log('runtime regression checks passed');
