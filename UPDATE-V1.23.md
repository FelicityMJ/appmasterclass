# Update to DataApp Studio V1.23

V1.23 makes **Level 5 — Connected App** API-first so pupils are no longer sent to an empty database before choosing an API.

## What changed

- Level 5 projects open on **Connect**.
- The visible Level 5 steps are **Connect → Design → Blocks → Test → Publish**.
- The guided tutorial starts with **Choose and test a live API**.
- Connect explicitly tells pupils that no database is needed for the Live Info Finder.
- A local database remains available through **Advanced: add local database data (optional)**.
- The optional Data workspace explains that it is not part of the normal Level 5 route and includes a **Back to Connect** button.
- The assignment dialog now explains the same distinction to teachers.
- Existing Level 5 projects and data are preserved.

## Update from V1.22

Replace:

- `app.js`

The update ZIP also includes this note and the refreshed README. `firebase-config.js` is not included.

No Firestore or Storage rules need republishing. After uploading, hard refresh DataApp Studio with **Ctrl + Shift + R**.
