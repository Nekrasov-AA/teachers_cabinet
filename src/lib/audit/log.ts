import { createClient } from '@/lib/supabase/server';

export type AuditAction =
  | 'section.create'
  | 'section.delete'
  | 'file.upload'
  | 'table.import_excel'
  | 'table.delete'
  | 'table.row.add'
  | 'table.row.update'
  | 'table.row.delete';

export type AuditLogEntry = {
  action: AuditAction;
  actorId: string;
  sectionId?: string | null;
  tableId?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown> | null;
};

/**
 * Writes an audit log entry. Failures are logged but never throw to avoid breaking primary actions.
 */
export async function logAuditEvent(entry: AuditLogEntry) {
  try {
    const supabase = await createClient();
    const payload = {
      action: entry.action,
      actor_id: entry.actorId,
      section_id: entry.sectionId ?? null,
      table_id: entry.tableId ?? null,
      target_id: entry.targetId ?? null,
      metadata: entry.metadata ?? null,
    };

    const { error } = await supabase.from('audit_log').insert(payload);

    if (error) {
      console.error('Failed to write audit log', error.message);
    }
  } catch (error) {
    console.error('Audit log error', error);
  }
}
