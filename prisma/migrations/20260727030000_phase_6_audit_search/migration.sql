CREATE INDEX "documents_file_extension_deleted_at_idx"
  ON "documents"("file_extension", "deleted_at");

CREATE INDEX "audit_logs_action_created_at_idx"
  ON "audit_logs"("action", "created_at" DESC);

CREATE INDEX "audit_logs_entity_type_created_at_idx"
  ON "audit_logs"("entity_type", "created_at" DESC);
