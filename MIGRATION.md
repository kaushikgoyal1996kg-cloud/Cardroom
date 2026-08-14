# Migration and cleanup

## Nothing has been deleted

Your original project is untouched. The new application was built in a
separate folder. Both can exist side by side indefinitely.

## Order of operations

1. Deploy the new app to **staging** (see `DEPLOYMENT.md`)
2. Work through `STAGING-CHECKLIST.md` on real phones
3. Play at least one full Hazari match with real people
4. Only then point the family at the new address
5. Leave the old app running for **two more weeks**
6. Only after that, consider deleting anything

Step 5 matters. Bugs that survive a checklist tend to surface in week one of
real use, usually in reconnection. Keeping the old app running costs nothing
and means you can tell everyone "use the old link tonight" instead of having
no game.

## What can eventually be deleted — DO NOT DO THIS YET

Once the new app has run for two weeks without incident:

| Item | Notes |
|---|---|
| Old Netlify site | Delete the site, or leave it and just stop sharing the link |
| Old backend service | Delete only after confirming nobody has a tab open |
| Old GitHub repository | Archive rather than delete — it costs nothing and it is your rollback |

**Recommendation:** archive the old repository rather than deleting it. If
something turns out to be wrong with the new Hazari implementation months from
now, the original tested code is the reference you will want.

## Rolling back

If something goes wrong after switching:

1. Tell everyone to use the old link — it still works
2. Nothing needs undoing on the new side
3. Fix, redeploy to staging, re-test

This is why the old app stays up.
