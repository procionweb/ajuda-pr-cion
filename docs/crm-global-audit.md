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

## Remaining Work

- Verify custom modals, sheets and headers outside the shared Dialog components.
- Replace remaining plain-text detail fields in occurrence, calendar and commercial forms, and release creation inside an option.
- Add model-level column sorting before pagination, including server-side paginated lists.
- Migrate Hadron options, releases, articles, checklist, parameters, serials and versions from local/session state to shared database CRUD.
- Review Kanban templates and calendar local event storage; separate preferences from business data.
- Verify create/edit/delete and reload with another authenticated user for each migrated module.
- Validate editor image inserts under staff and non-staff identities and reopen saved HTML.
- Perform desktop/mobile visual validation of shared dialog footers.

## Known Persistence Gaps

Business data still uses localStorage in iniciar-hadron.tsx for options, releases, serials and versions.
Checklist, parameter and article editing also uses component state without complete shared CRUD.
The global database persistence requirement is not complete; successful UI updates are not proof of persistence.

Theme, sidebar and column display preferences use localStorage intentionally and are not business records.
