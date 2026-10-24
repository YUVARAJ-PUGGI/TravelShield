import { getInclusiveCalendarDays, normalizeDateOnly } from "./dateOnly.js";

export function validateEligibleQuote(quote) {
  if (!quote || quote.quote_status !== "generated") {
    return "Only generated quotes can be issued as an educational simulation.";
  }

  if (
    !Number.isInteger(Number(quote.plan_id)) ||
    !Number.isInteger(Number(quote.destination_country_id)) ||
    !Number.isInteger(Number(quote.traveller_count)) ||
    Number(quote.traveller_count) < 1 ||
    !Number.isFinite(Number(quote.premium_amount)) ||
    Number(quote.premium_amount) < 0 ||
    typeof quote.currency_code !== "string" ||
    !/^[A-Z]{3}$/.test(quote.currency_code)
  ) {
    return "The quote is missing required policy fields.";
  }

  const startDate = normalizeDateOnly(quote.start_date);
  const endDate = normalizeDateOnly(quote.end_date);
  const durationDays = getInclusiveCalendarDays(startDate, endDate);
  if (!startDate || !endDate || !durationDays || durationDays > 365) {
    return "The quote has invalid coverage dates.";
  }

  return null;
}
