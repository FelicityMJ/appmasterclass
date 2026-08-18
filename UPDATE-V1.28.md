# Update to DataApp Studio V1.28

V1.28 fixes blank API Lists in published/installed Connected Apps.

## What changed

- The most recent successful **Connect** result is explicitly included in the published snapshot.
- The published runtime now seeds its API result and API rows from that saved result.
- API Lists and API-bound detail placeholders therefore show immediately on iPhone, iPad and Android after publication.
- A live API request made by the finished app still replaces the seed data as normal.
- Published-app service-worker cache bumped to V1.28.

## After updating

1. Hard refresh DataApp Studio.
2. In the pupil project, go to **Connect** and run the desired starter search once (for example `all`).
3. Press **Update published app**.
4. Fully close and reopen the installed app once.

No Firebase rule changes are required.
