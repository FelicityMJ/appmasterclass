# Update to DataApp Studio V1.17

V1.17 makes pupil entry clearer without changing Firebase data or existing accounts.

## New pupil

Choose **New pupil — Join a class**. Google Authentication runs first, then DataApp Studio immediately opens the class-code box. The pupil enters the code once.

## Returning pupil

Choose **Returning pupil — Sign in**. After choosing the same Google account, the pupil goes directly to their existing classes, apps and assignments. No class code is required again.

If a returning account has no class memberships, the class-code prompt is opened automatically.

## Existing pupils joining another class

The pupil dashboard still includes **+ Join another class**. Existing apps and class memberships are preserved.

## Upgrade from V1.16

Replace `app.js` (and optionally the documentation files) from the V1.17 update package. Keep your existing `firebase-config.js`.

No Firestore, Storage or Authentication settings/rules need changing.
