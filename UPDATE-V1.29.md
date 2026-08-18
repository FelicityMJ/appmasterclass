# Update to DataApp Studio V1.29

V1.29 fixes the teacher-dashboard buttons that can appear more than once on the same page.

## Fixed

- **Invite teacher** now works from both the top dashboard toolbar and the Teacher administration panel.
- **Manage Image Bank / Add images** now works from every copy of that action on the dashboard.
- The issue was caused by only the first matching button being wired after render; V1.29 binds every matching button.

## Updating from V1.28

Replace `app.js` and hard-refresh the site. No Firebase rules changes are required.
