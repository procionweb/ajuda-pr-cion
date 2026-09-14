# CRM Global Audit

## Completed In This Pass

- Removed the date-type selector from the Versions filters.
- Standard DialogContent uses a footer close action instead of an X.
- Standard DialogFooter adds Fechar beside existing actions, unless already present.
- Removed the X from DetailModalHeader.
- Option and article detail fields use the existing rich-text editor with upload and drag/drop.
- Editor uploads are persisted to crm_editor_images with staff-only RLS; no new blob URLs are stored.
- Ticket details have an explicit close footer inside the main panel.
- Hadron detail content shrinks and scrolls independently of its close footer.
- Shared footers do not shrink and wrap their actions when space is limited.
- Release and parameter editing now uses the rich-text editor with upload and drag/drop.
- Migrated 2,992 Hadron catalog records and three Kanban templates to crm_catalog_records.
- Options, releases, articles, checklist definitions, parameters, serials, versions and templates save through authenticated database RPCs.
- Multi-item checklist updates are transactional; updates change individual records instead of replacing a whole catalog.
- Success feedback and modal dismissal occur only after the database acknowledges the write.
- Deletion preserves records and records actor/before/after values in crm_catalog_audit.
- Browser-only legacy records are imported once, without overwriting records already edited in the database.
- Catalogs refresh on window focus and periodically; dropdowns and option-linked releases use the shared records.
- Database checks passed for eight catalog types: create, edit, cross-user reads, deletion/restoration, audit, RLS, atomicity, uniqueness and import protection. Test writes were rolled back.

## Remaining Work

- Verify custom modals, sheets and headers outside the shared Dialog components.
- Replace remaining plain-text detail fields in occurrence, calendar and commercial forms, and release creation inside an option.
- Add model-level column sorting before pagination, including server-side paginated lists.
- Complete browser-level create/edit/reload validation for every module; database-level cross-user CRUD has passed for the migrated catalogs.
- Validate editor image inserts under staff and non-staff identities and reopen saved HTML.
- Perform desktop/mobile visual validation of shared dialog footers.

## Persistence Scope

Hadron and Kanban template business writes no longer depend on localStorage or component state.
Checklist processing, occurrences, modules, tickets, customers, leads, Kanban cards and fleet already have dedicated database APIs.
Calendar event creation and editing call save_crm_calendar_event; local storage there is a cache hydrated from the database, with write failures surfaced to the user.
Those existing APIs were inspected, but this pass does not certify every screen's end-to-end behavior.

crm_catalog_records is staff-only. Public knowledge-base article pages still use their existing published-content source; this migration does not change publication or client visibility rules.

Theme, sidebar and column display preferences use localStorage intentionally and are not business records.
