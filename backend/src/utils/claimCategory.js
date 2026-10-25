const disruptionFamily = {
  flight_cancellation_interruption: "travel",
  travel_delay: "travel",
  missed_connection: "travel",
  lost_damaged_baggage: "baggage",
  delayed_baggage_essentials: "baggage",
  emergency_accommodation: "travel",
  emergency_return_travel: "travel",
  emergency_medical_treatment: "medical",
  medical_evacuation_repatriation: "medical",
  lost_travel_document_replacement: "travel",
};

const benefitFamily = {
  travel: "travel",
  flight_cancellation_interruption: "travel",
  travel_delay: "travel",
  missed_connection: "travel",
  emergency_accommodation: "travel",
  emergency_return_travel: "travel",
  lost_travel_document_replacement: "travel",
  baggage: "baggage",
  lost_damaged_baggage: "baggage",
  delayed_baggage_essentials: "baggage",
  medical: "medical",
  emergency_medical_treatment: "medical",
  medical_evacuation_repatriation: "medical",
};

export function matchesBenefitForDisruption(disruptionCategory, benefitCategory) {
  if (!disruptionCategory || !benefitCategory) return false;
  const disruption = String(disruptionCategory).trim().toLowerCase();
  const benefit = String(benefitCategory).trim().toLowerCase();
  const expectedFamily = disruptionFamily[disruption];
  const actualFamily = benefitFamily[benefit];
  return expectedFamily && actualFamily
    ? expectedFamily === actualFamily
    : disruption === benefit;
}