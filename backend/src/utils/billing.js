function parseNonNegativeAmount(value, name) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error(`${name} must be a non-negative number.`);
  }
  return amount;
}

function roundCurrency(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateInvoiceTotals(
  premiumAmount,
  taxRatePercent = process.env.BILLING_TAX_RATE || "0",
  fixedFee = process.env.BILLING_FIXED_FEE || "0"
) {
  const premium = roundCurrency(parseNonNegativeAmount(premiumAmount, "Premium"));
  const taxRate = parseNonNegativeAmount(taxRatePercent, "Tax rate");
  if (taxRate > 100) throw new Error("Tax rate cannot exceed 100 percent.");
  const fee = roundCurrency(parseNonNegativeAmount(fixedFee, "Fixed fee"));
  const tax = roundCurrency((premium * taxRate) / 100);
  return {
    premiumAmount: premium,
    taxRatePercent: taxRate,
    taxAmount: tax,
    feeAmount: fee,
    totalAmount: roundCurrency(premium + tax + fee),
  };
}