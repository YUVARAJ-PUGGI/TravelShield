import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileTypeFromBuffer } from "file-type";

export const maximumEvidenceSize = 10 * 1024 * 1024;

const supportedTypes = new Map([
  ["pdf", { mimeType: "application/pdf", extension: "pdf" }],
  ["jpg", { mimeType: "image/jpeg", extension: "jpg" }],
  ["png", { mimeType: "image/png", extension: "png" }],
]);

function getStorageDirectory() {
  return path.resolve(
    process.env.EVIDENCE_STORAGE_DIR ||
      path.join(process.cwd(), "private-storage", "evidence")
  );
}

function safeOriginalFilename(filename) {
  const basename = path.basename(typeof filename === "string" ? filename : "evidence");
  const cleaned = basename.replace(/[^\w.\- ()]/g, "_").slice(0, 180);
  return cleaned || "evidence";
}

export async function validateEvidenceFile(file) {
  if (!file || !Buffer.isBuffer(file.buffer) || file.size < 1) {
    return { message: "An evidence document is required." };
  }
  if (file.size > maximumEvidenceSize) {
    return { message: "Evidence documents must be 10 MB or smaller." };
  }

  const detectedType = await fileTypeFromBuffer(file.buffer);
  const supportedType = detectedType && supportedTypes.get(detectedType.ext);
  if (!supportedType) {
    return { message: "Only PDF, JPEG, and PNG evidence documents are supported." };
  }

  return {
    originalFilename: safeOriginalFilename(file.originalname),
    mimeType: supportedType.mimeType,
    extension: supportedType.extension,
  };
}

export async function saveEvidenceFile(file, extension) {
  const storageDirectory = getStorageDirectory();
  await fs.mkdir(storageDirectory, { recursive: true });
  const storageName = `${crypto.randomUUID()}.${extension}`;
  const storagePath = path.resolve(storageDirectory, storageName);
  const relativePath = path.relative(storageDirectory, storagePath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error("Generated evidence storage path is invalid.");
  }
  await fs.writeFile(storagePath, file.buffer, { flag: "wx", mode: 0o600 });
  return { storageName, storagePath };
}

export async function readEvidenceFile(storageName) {
  if (
    typeof storageName !== "string" ||
    !/^[0-9a-f-]{36}\.(?:pdf|jpg|png)$/.test(storageName)
  ) {
    throw new Error("Stored evidence name is invalid.");
  }
  const storageDirectory = getStorageDirectory();
  const storagePath = path.resolve(storageDirectory, storageName);
  const relativePath = path.relative(storageDirectory, storagePath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error("Evidence storage path is invalid.");
  }
  return { storagePath, contents: await fs.readFile(storagePath) };
}
