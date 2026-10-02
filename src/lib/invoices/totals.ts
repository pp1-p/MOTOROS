type PreviewLine = {
  itemType: string;
  quantity: number | string;
  unitPrice: number | string;
  vatRate: number | string;
};

// The database stores quantity, unit price and VAT rate to two decimal places,
// then rounds net and VAT per line. Keep the preview in integer pennies.
function hundredths(value: number | string) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round((Math.max(number, 0) + Number.EPSILON) * 100) : 0;
}

export function calculateInvoicePreview(lines: PreviewLine[], applyVat: boolean) {
  let subtotal = 0;
  let discount = 0;
  let vat = 0;
  for (const line of lines) {
    if (line.itemType === "note") continue;
    const net = Math.round(hundredths(line.quantity) * hundredths(line.unitPrice) / 100);
    if (line.itemType === "discount") discount += net;
    else {
      subtotal += net;
      if (applyVat) vat += Math.round(net * hundredths(line.vatRate) / 10_000);
    }
  }
  return { subtotal: subtotal / 100, discount: discount / 100, vat: vat / 100, total: Math.max(subtotal - discount + vat, 0) / 100 };
}
