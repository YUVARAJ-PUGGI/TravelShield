export function calculatePremium(dailyRate, durationDays, travellerCount) {
  return Number((dailyRate * durationDays * travellerCount).toFixed(2));
}
