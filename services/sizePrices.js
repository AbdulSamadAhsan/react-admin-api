function parseSizePrices(value, sizes) {
  const rows = typeof value === 'string' ? JSON.parse(value) : value;
  if (!Array.isArray(rows) || rows.length > 100 || !Array.isArray(sizes)) throw new SyntaxError('Invalid size prices');
  const seen = new Set();
  return rows.map(row => {
    if (!row || typeof row.size !== 'string' || !sizes.includes(row.size) || seen.has(row.size) || typeof row.price !== 'number' || !Number.isFinite(row.price) || row.price < 0 || !Number.isSafeInteger(Math.round(row.price * 100))) throw new SyntaxError('Invalid size prices');
    seen.add(row.size);
    return { size: row.size, price: Math.round(row.price * 100) / 100 };
  });
}
module.exports = { parseSizePrices };
