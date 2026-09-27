# 08 Forms Manual

> 中文: [08-表单中心使用手册.md](../08-表单中心使用手册.md)

Forms is KanRay's **data-capture loop**: design an online form by drag and drop, and **publishing it automatically creates the table, stores the data and registers it as a dataset**, so submissions flow straight into the analysis chain of charts, dashboards and big screens — a complete "capture → model → visualize → act on it" loop. No code required.

> **Prerequisite**: you need the `form` permissions. Among the built-in roles, "Dashboard Editor" (`看板编辑者`) has full form permissions (design / publish / share / submissions), while "Viewer" (`查看者`) can view forms, fill them in and view submissions (see the permissions section at the end). Published forms adapt to mobile, so you can share them straight into a WeChat group or an internal company system.

![Forms list (English UI)](../images/en/23-form-list.png)

## 1. Entry and interface overview

After signing in, the **Forms** entry in the left sidebar sits between "Dashboards" and "Big screens". Click it to open the form list.

| UI area | Purpose |
|------|------|
| Top buttons | New form / search by name |
| Form list | Name, description, status (Draft / Published / Closed) and update time; the Actions column offers Share / Design / Fill / Records / Delete |
| Status meanings | `Draft`: not published yet, no table created; `Published`: can be filled in and shared; `Closed`: the submission entry is unavailable, and publishing again restores it |

## 2. Creating a form

On the list page, click "**New form**", enter a form name in the dialog (e.g. "Employee satisfaction survey"), and you go straight into the designer:

- A new form starts in the **Draft** state: no data table is created yet and the fill-in entry is not available;
- While designing, click "Save draft" at any time to persist the field configuration so you can come back to it later.

![Form designer (English UI)](../images/en/24-form-designer.png)

## 3. Form designer

Open a form at `/forms/:id/design` and the interface is split into the following areas:

- **Top toolbar**: Back / form name (rename it in place) / status tag; on the right, Share, Fill and Records, plus Save draft, **Publish** (while it is a draft), Close (once published) and Delete.
- **Left component palette**: Single-line text, Multi-line text, Number, Date, Dropdown, Single choice, Multiple choice and Static text — drag one onto the centre canvas to add it; while the canvas is empty, clicking the empty area adds the first field directly.
- **Centre canvas**: the form description (a text area, optional) plus all fields, each carrying a required marker and reorderable by drag, and deletable.
- **Right property column**: with a field selected, edit its Label, field key (the column name used in storage, not freely changeable after publishing), placeholder and whether it is required; Dropdown / Single choice / Multiple choice fields can also have options added, removed and edited (display label + submitted value).
- **Submission settings**: the success message (defaults to "Submitted successfully") and whether repeat submissions are allowed ("Allowed" lets the same person submit many times / "Once per person" blocks duplicates per submitter).

> **Note**: the field key becomes the column name written into the data table, so decide it before publishing; after publishing you can still add new fields and columns, but deleting an existing field or changing its type is limited by data protection.

## 4. Publishing and closing

- **Publish**: turn a draft form into a live form. The system automatically creates a data table (with a name of the form `ds_<timestamp>_<random>`) **and registers it as a dataset**, the status becomes "Published", and from then on you can share it and take online submissions.
- **Close**: a published form can be closed at any time; once closed, the submission entry is unavailable (neither the "Fill" action for signed-in users nor the public link accepts submissions). Publishing again restores it, and historical data is kept.
- **Delete**: deleting a form **deletes its data table and every submission record along with it**, and this cannot be undone.

![Share dialog (English UI)](../images/en/25-form-share-dialog.png)

## 5. Sharing a form

Click "**Share**" in the list or the designer to open the share dialog, where you can create multiple shares for one form:

| Option | Description |
|------|------|
| Password share | Opening the public link requires entering a 4–64 character password first |
| Public share | No password; anyone with the link can fill the form in |
| Expiry time | Optional; the link stops working once it passes |
| Enabled switch | Enable or disable an individual share at any time — a disabled link stops working immediately |

The share link looks like `http://<your-domain>/f/<token>`. You can copy it and send it to anyone, who can fill in the form without signing in. The password, expiry time and enabled state can all be changed or removed at any time.

![Form filling view (English UI)](../images/en/26-form-fill-view.png)

## 6. Filling in online

There are two fill-in entry points, and both render the same set of fields:

- **Internal fill**: a signed-in user clicks "Fill" in the list or the designer (`/forms/:id/fill`), and the submitter is recorded automatically as the current user;
- **Public fill**: anyone opens the share link (`/f/:token`); a password-protected share must clear the password gate first, and the submitter is recorded as "Anonymous".

The response after submitting follows the "Submission settings": the configured success message is shown, and if repeat submissions are disabled, a second submission from the same submitter is blocked.

![Submissions (English UI)](../images/en/27-form-submissions.png)

## 7. Submissions

Click "Records" in the list to open `/forms/:id/submissions`:

| Capability | Description |
|------|------|
| View | A table showing No., each form field, the submitter (`anonymous` or the user name) and the submission time, with sorting by submission time and pagination |
| Filter | One-click switching between "All" and "Only mine" |
| Edit / delete | A single submission can be edited — refilled through the form renderer — or deleted, straight from the row |
| Data table | The top bar shows the data table name behind the form directly, and each row is written to that table in real time |

## 8. How the data pipeline connects up

The dataset that the system registers automatically after you publish a form is structurally identical to one registered by uploading an Excel file, so submissions become immediately available to:

- **Charts**: create a new chart against that dataset (bar / line / pie / table, and so on);
- **Dashboards / big screens**: drag those charts into a dashboard or big screen to analyse them together with your uploaded data;
- **Open API**: pull aggregated results through the data-consumption endpoints (`GET /datasets/:id/aggregate`, etc.) for external systems to use.

So "**launch a survey → collect → store automatically → analyse in real time**" happens end to end inside KanRay, with no data shuttling at all.

## 9. Form field types at a glance

| Control | Stored type | Description |
|------|------|------|
| Single-line text | String | Short text (name, department, etc.) |
| Multi-line text | String | Long text (suggestions, remarks, etc.) |
| Number | Number | Can take part in aggregations (scores, etc.) |
| Date | Date | Picks a date |
| Dropdown / Single choice | String | Pick one of the preset options |
| Multiple choice | String | Pick several of the preset options |
| Static text | — | Display only, not stored |

## 10. Permissions (form / form:submission)

| Permission | Description | Dashboard Editor | Viewer |
|------|------|:---:|:---:|
| form:read | View the form list and form details | ✓ | ✓ |
| form:create / update / delete | Create / edit / delete forms | ✓ | — |
| form:publish | Publish and close forms | ✓ | — |
| form:share | Create and manage shares | ✓ | — |
| form:submit | Submit a form online | ✓ | ✓ |
| form:submission:read | View submissions | ✓ | ✓ |
| form:submission:update | Edit submissions | ✓ | — |
| form:submission:delete | Delete submissions | ✓ | — |
