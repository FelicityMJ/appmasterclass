# Update to DataApp Studio V1.18

V1.18 adds administrator-only teacher invitations.

## What changes

- **Invite teacher** appears only for the account whose `teacherAllowlist/{uid}` document has `admin = true`.
- Invite by Google email instead of copying Firebase UIDs.
- Invited teachers activate automatically on first **Teacher — Sign in**.
- Invited teachers always receive `admin = false` and cannot invite teachers.
- Admin can cancel pending invitations and revoke active teacher access.
- The admin panel shows active accounts and pending invitations.

## Required one-time admin step

If your existing teacher allow-list document currently contains only:

```text
enabled = true
```

add:

```text
admin = true
```

Only do this on your own administrator document.

## Required Firebase change

Replace the current **Firestore** rules with the V1.18 `firestore.rules` and click **Publish**.

There is **no Storage rules change**.

## Files to replace from V1.17

- `app.js`
- `firebase-service.js`
- `styles.css`
- `firestore.rules`

Keep your existing `firebase-config.js` unchanged.
