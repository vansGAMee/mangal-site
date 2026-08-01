# Backups and migrations

Enable automated PostgreSQL backups and PITR after the operator defines RPO/RTO. Perform and record a restore drill before launch and periodically thereafter. Back up versioned legal templates and their SHA-256 values alongside database backups.

Use expand–migrate–contract: add compatible fields, deploy readers/writers, backfill via interceptable jobs, then remove obsolete fields in a later release. Destructive migration requires an approved recovery plan. Production incidents use forward-fix; rollback is allowed only when schema compatibility is proven.
