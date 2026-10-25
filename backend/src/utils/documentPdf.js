import PDFDocument from "pdfkit";

function renderPdf(title, subtitle, fields) {
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({ size: "A4", margin: 52, info: { Title: title, Author: "TravelShield Demo" } });
    const chunks = [];
    pdf.on("data", (chunk) => chunks.push(chunk));
    pdf.on("error", reject);
    pdf.on("end", () => resolve(Buffer.concat(chunks)));

    pdf.rect(0, 0, pdf.page.width, 94).fill("#17382b");
    pdf.fillColor("#ffffff").fontSize(20).font("Helvetica-Bold").text("TravelShield Abroad", 52, 35);
    pdf.fillColor("#17382b").fontSize(18).font("Helvetica-Bold").text(title, 52, 122);
    pdf.fillColor("#68736d").fontSize(10).font("Helvetica").text(subtitle, 52, 151, { width: 490 });

    let y = 198;
    for (const [label, value] of fields) {
      if (value === undefined || value === null || value === "") continue;
      pdf.fillColor("#68736d").fontSize(9).font("Helvetica-Bold").text(label.toUpperCase(), 52, y, { width: 155 });
      pdf.fillColor("#17382b").fontSize(11).font("Helvetica").text(String(value), 210, y, { width: 330 });
      y += 34;
      if (y > 690) {
        pdf.addPage();
        y = 58;
      }
    }

    pdf.moveTo(52, Math.min(y + 6, 735)).lineTo(543, Math.min(y + 6, 735)).strokeColor("#d9d3ca").stroke();
    pdf.fillColor("#8c5a00").fontSize(9).font("Helvetica-Bold").text(
      "EDUCATIONAL SIMULATION ONLY - NOT AN INSURANCE POLICY OR PROOF OF COVERAGE.",
      52,
      Math.min(y + 20, 750),
      { width: 490 }
    );
    pdf.end();
  });
}

export function createInvoicePdf(invoice) {
  return renderPdf("Invoice", "Simulated billing record. No payment is collected.", [
    ["Invoice number", invoice.invoice_number],
    ["Policy reference", invoice.policy_number],
    ["Plan", invoice.plan_name],
    ["Invoice date", invoice.created_at],
    ["Premium", `${invoice.currency_code} ${Number(invoice.premium_amount).toFixed(2)}`],
    ["Tax rate", `${Number(invoice.tax_rate_percent).toFixed(2)}%`],
    ["Tax", `${invoice.currency_code} ${Number(invoice.tax_amount).toFixed(2)}`],
    ["Fees", `${invoice.currency_code} ${Number(invoice.fee_amount).toFixed(2)}`],
    ["Total", `${invoice.currency_code} ${Number(invoice.total_amount).toFixed(2)}`],
    ["Payment status", invoice.payment_status],
  ]);
}

export function createPolicyCertificatePdf(policy) {
  return renderPdf("Simulated Policy Certificate", "Demo certificate generated after simulated payment confirmation.", [
    ["Policy number", policy.policy_number],
    ["Policyholder", policy.full_name],
    ["Plan", policy.plan_name],
    ["Destination", policy.country_name],
    ["Coverage start", policy.coverage_start_date],
    ["Coverage end", policy.coverage_end_date],
    ["Premium", `${policy.currency_code} ${Number(policy.premium_amount).toFixed(2)}`],
    ["Status", "SIMULATED - NOT REAL COVERAGE"],
  ]);
}

export function createInsuranceCardPdf(policy) {
  return renderPdf("Simulated Insurance Card", "Demo identification card. Not proof of real insurance.", [
    ["Policy number", policy.policy_number],
    ["Policyholder", policy.full_name],
    ["Plan", policy.plan_name],
    ["Destination", policy.country_name],
    ["Coverage dates", `${policy.coverage_start_date} to ${policy.coverage_end_date}`],
    ["Emergency contact", "Use the emergency services number for your location"],
    ["Status", "SIMULATED - NOT REAL COVERAGE"],
  ]);
}