# 06 Frequently Asked Questions

> 中文: [06-常见问题FAQ.md](../06-常见问题FAQ.md)

Questions and answers grouped by scenario. If your question is not covered here, see the [Open API integration guide](04-open-api-integration.md), the [Deployment & operations manual](05-deployment-and-operations.md), or the other product documents.

## I. Accounts and Sign-In

**Q1: I forgot my password — what now?**

**Q2: Sign-in says "account disabled"?**
An administrator has deactivated the account. Ask them to re-enable it, and you can sign in again.

**Q3: What is the initial admin account?**
`admin@kanray.local / admin123` (for Docker deployments you can set your own via `ADMIN_INITIAL_PASSWORD` in `deploy/docker/.env`). Change it as soon as possible in production.

**Q4: What are the password requirements?**
At least 8 characters, containing both letters and digits.

**Q5: Everybody got signed out after I changed JWT_SECRET — why?**
That is expected. `JWT_SECRET` is used to sign tokens, so changing it invalidates every existing session and users have to sign in again (the business impact is significant, so do not rotate it unless you must).

## II. Data Sources and Sync

**Q6: Why is my data source list empty?**
Data sources are isolated per owner: regular users only see the ones they created, while administrators see all of them.

**Q7: Why can't a file-based data source use "sync" mode?**
An uploaded Excel/CSV file is used directly as a local dataset, so sync mode is unnecessary (and unsupported) for it. Sync mode exists specifically to pull external databases down to the local machine.

**Q8: Why didn't my sync job run?**

**Q9: Does it matter if a data source password is wrong or forgotten?**
Connection passwords are encrypted with `DATASOURCE_SECRET` before being stored. When you edit a data source, the password field showing `********` means the existing password is kept; it is only overwritten if you type a new plaintext password.

**Q10: Everything failed after I changed DATASOURCE_SECRET — sync and direct connections alike?**
After the key changes, existing connection passwords can no longer be decrypted. Re-save each data source password one by one, or roll the secret back.

## III. Sharing

**Q11: A share link asks for a password?**
By default an access password (4–64 characters) is set when you create a share, protecting the read-only share page. You can also turn the "password" option off to get a public share that opens without one. Sharing never requires signing in.

**Q12: How do I invalidate a share link?**

Dashboard list → Actions → Share → deactivate or delete that share. Once deactivated, the link no longer shows anything.

**Q13: Can share links expire automatically?**
Share links support a custom expiry: when you create a share you can pick a specific expiry in the dialog, and the link stops working once it passes. Leave it empty for a link that never expires.

**Q14: Why can't a signed-in user see some dashboards?**
Dashboards are isolated by owner and also require dashboard read permission. The share page is the one exception: it grants cross-user read-only access.

## IV. Charts and Dashboards

**Q15: A chart in the list shows as "invalid"?**
The dataset the chart is bound to was deleted or is no longer visible to you. Rebind a dataset or rebuild the chart.

**Q16: Some chart types report "not enough fields"?**
Certain charts need a specific number of dimensions/measures (for example a heatmap needs 2 dimensions + 1 measure, a scatter plot needs an X dimension + a Y measure, a sunburst needs a hierarchical dimension). Add the fields the builder asks for.

**Q17: How do I make several charts filter together?**

Add a "Filter" component in dashboard edit mode and pick the data source and field. While previewing, changing the filter value refreshes every chart on that data source automatically.

**Q18: How do I leave fullscreen on a dashboard?**

Enter fullscreen with "Full screen" at the top of the dashboard view page; press Esc or click it again to return to the page.

## V. Open API

**Q19: I get a 401.**
The credential is missing, invalid, deactivated, or expired. Check that `Authorization: Bearer kan_*` or `X-API-Key: kan_*` is actually being sent, and that the key is enabled and not expired.

**Q20: I get a 403 even though the key is clearly valid?**
The key lacks the required permission (the API key has no matching scope ticked, or the user a PAT was created for does not hold that permission). Grant the key the relevant scope under Administration and retry.

**Q21: I get a 404 saying "resource does not exist or you have no access to it"?**
Either the credential may not access that resource, or the resource does not exist. The Open API deliberately masks "no access" and "does not exist" as the same 404, so it never reveals whether a resource exists.

**Q22: I get a 422 saying "the aggregation contains unregistered fields"?**
The metrics/dimensions/filters fields in the request must be registered field names of that dataset. Check that the field names match the dataset's "field definitions" (when the display name differs from the internal field name, the internal field name is authoritative).

**Q23: Chinese text is garbled when I open the CSV in Excel?**
Our CSV output includes a BOM, which Excel recognises correctly. If you read it from the command line or a script, parse it as UTF-8.

**Q24: Is there a call rate limit on the Open API?**
Yes — per key, per minute (`OPEN_API_RATE_PER_MIN=120` by default), and exceeding it returns 429. Raise it through the environment variable if you need more.

## VI. Deployment and Operations

**Q25: Swagger will not open after a Docker deployment?**
Check that the containers are healthy (`deploy/docker/deploy.sh ps`) and that you are opening `/api/open/docs`; that path is served by the backend, and nginx reverse-proxies `/api`.

**Q26: How do I change the port or switch to a different domain?**
Change `KANRAY_PORT` in `deploy/docker/.env` and run `deploy/docker/deploy.sh restart` for it to take effect; the external port is what you expose (or point your reverse proxy at).

**Q27: What are the risks of `deploy/docker/deploy.sh down -v`?**
It deletes every data volume (the metadata database and the synced data cannot be recovered). For a routine shutdown use `deploy/docker/deploy.sh down`, which keeps the data.

**Q28: Where do I see sync logs and the audit log?**

## VII. Miscellaneous

**Q29: An upload fails with "exceeds the 20MB / 200,000 row limit"?**
The current version limits each file to ≤20MB and ≤200,000 rows. Split the file or clean the data before uploading.

**Q30: Can a regular registered user create a data source?**
It depends on the role's permissions: creating a data source requires the `datasource:create` permission point. The data engineer and analyst roles have it, while the viewer role is read-only. An administrator can adjust this in role management.
