import test from "node:test";
import assert from "node:assert/strict";
import { maximumEvidenceSize, validateEvidenceFile } from "./evidenceStorage.js";

test("accepts supported content signatures without trusting the filename or MIME type", async () => {
  const result = await validateEvidenceFile({
    originalname: "../../receipt.exe",
    mimetype: "application/x-msdownload",
    size: 12,
    buffer: Buffer.from("%PDF-1.7\n"),
  });

  assert.deepEqual(result, {
    originalFilename: "receipt.exe",
    mimeType: "application/pdf",
    extension: "pdf",
  });
});

test("rejects unsupported content and oversized files", async () => {
  const unsupported = await validateEvidenceFile({
    originalname: "evidence.png",
    size: 4,
    buffer: Buffer.from("not an image"),
  });
  assert.match(unsupported.message, /Only PDF, JPEG, and PNG/);

  const oversized = await validateEvidenceFile({
    originalname: "evidence.pdf",
    size: maximumEvidenceSize + 1,
    buffer: Buffer.from("%PDF-1.7\n"),
  });
  assert.match(oversized.message, /10 MB or smaller/);
});
