import { unlink } from "node:fs/promises";
import { saveEvidenceFile } from "./evidenceStorage.js";

export async function storeUserDocument(connection, {
  userId,
  file,
  validation,
  policyId = null,
  claimId = null,
  invoiceId = null,
  category,
  documentType,
  uploadedByUser = false,
}) {
  const savedFile = await saveEvidenceFile(file, validation.extension);
  try {
    const [result] = await connection.query(
      `INSERT INTO user_documents
       (user_id, policy_id, claim_id, invoice_id, original_filename,
        storage_name, mime_type, file_size, document_category,
        document_type, document_status, uploaded_by_user)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'available', ?)`,
      [
        userId,
        policyId,
        claimId,
        invoiceId,
        validation.originalFilename,
        savedFile.storageName,
        validation.mimeType,
        file.size,
        category,
        documentType,
        uploadedByUser ? 1 : 0,
      ]
    );
    return { documentId: result.insertId, ...savedFile };
  } catch (error) {
    await unlink(savedFile.storagePath).catch(() => {});
    throw error;
  }
}

export async function createUserNotification(connection, {
  userId,
  type,
  title,
  message,
  relatedType = null,
  relatedId = null,
}) {
  await connection.query(
    `INSERT INTO user_notifications
     (user_id, notification_type, title, message, related_type, related_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, type, title, message, relatedType, relatedId]
  );
}