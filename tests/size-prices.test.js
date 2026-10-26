const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseSizePrices } = require('../services/sizePrices');
test('size prices accept selected sizes, zero and cent rounding; reject malformed or duplicate entries', () => {
  assert.deepEqual(parseSizePrices('[{"size":"Small","price":10.005},{"size":"Large","price":0}]', ['Small', 'Large']), [{ size: 'Small', price: 10.01 }, { size: 'Large', price: 0 }]);
  for (const rows of [null, {}, [{ size: 'XL', price: 20 }], [{ size: 'Small', price: -1 }], [{ size: 'Small', price: '10' }], [{ size: 'Small', price: 10 }, { size: 'Small', price: 20 }]]) {
    assert.throws(() => parseSizePrices(rows, ['Small', 'Large']), SyntaxError);
  }
});
