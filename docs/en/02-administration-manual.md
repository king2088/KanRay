# 02 Admin Manual

> 中文: [02-管理员手册.md](../02-管理员手册.md)

For system administrators. It covers accounts, roles and permissions, the audit log, and Open API credentials. Every entry point sits under **Administration** in the sidebar, and its sub-menus appear according to your permissions.

## 1. Administration at a glance

| Sub-menu | Required permission | Purpose |
|--------|---------|------|
| Users | `user:read` | Create users, assign roles, reset passwords, enable or disable accounts |
| Roles | `role:read` | Maintain roles and their permission points |
| Audit log | `audit:read` | View records of key actions |
| Open API | `apikey:manage` | Create and manage API keys and access tokens |
| Access tokens | Just sign in | Manage your own PATs |

## 2. Users

![User management (English UI)](../images/en/11-admin-users.png)

### 2.1 Creating a user

Fields in the dialog:

- **Email**: required, and the format is validated
- **Display name**: required, up to 50 characters
- **Password**: at least 8 characters, including both letters and digits
- **Roles**: multi-select (tick the roles that already exist in the system)

![New user dialog (English UI)](../images/en/36-admin-user-dialog.png)

### 2.2 Assigning roles

Each user can hold one or more roles, and their permissions are the union of those roles. Both built-in and custom roles can be assigned.

### 2.3 Resetting a password

An administrator can set a new password for a user (the same rule applies: at least 8 characters with letters and digits). There is no self-service recovery, so a user who forgets their password has to ask an administrator to reset it.

### 2.4 Enabling, disabling and deleting

- The Status column has a switch that enables and disables the account; **a disabled account reports "Account has been disabled" at sign-in**, but none of its data is deleted
- **The account you are signed in with cannot be disabled or deleted**: its Status switch is disabled and its Delete button is not shown
- Deleting a user removes the account and its sessions, and asks you to confirm first

## 3. Roles and permissions

![Role management (English UI)](../images/en/12-admin-roles.png)

### 3.1 Built-in roles

| Role | Code | Description |
|------|------|------|
| Administrator | `admin` | Full permissions across the platform (built in, cannot be edited or deleted) |
| Data engineer / analyst | `analyst` | Data-side permissions for data sources, datasets, charts, dashboards, and so on |
| Dashboard editor | `editor` | Dashboard-related permissions |
| Viewer | `viewer` | Read-only permissions |

Built-in roles carry a "Built-in" tag, and their **Edit and Delete buttons are disabled**.

### 3.2 Custom roles

Creating or editing a role:

- **Code**: 2–32 lowercase letters, digits or underscores; locked once you are editing an existing role
- **Name**: up to 50 characters
- **Description**: up to 200 characters
- **Permission configuration**: tick by permission group

![Role permission dialog (English UI)](../images/en/37-admin-role-dialog.png)

### 3.3 Permission group structure

| Group | Prefix | Permission points included |
|----|------|-----------|
| Datasets | `dataset` | read / create / edit / delete |
| Charts | `chart` | read / create / edit / delete |
| Dashboards | `dashboard` | read / create / edit / delete / share |
| Data sources | `datasource` | read / create / edit / delete / sync (as available) |
| SQL lab | `sqllab` | read / execute |
| Users | `user` | read / create / edit / delete |
| Roles | `role` | read / create / edit / delete |
| Audit log | `audit` | read |
| System | `system` | system-level settings |

> Permission points are named `resource:action`, for example `dashboard:share`. The front end shows and hides menu items based on your permissions: without `user:read` you do not see "Users", and without `audit:read` you do not see "Audit log".

## 4. Audit log

![Audit log (English UI)](../images/en/14-admin-audit.png)

It records key user actions on the platform so that you can track them for security:

- Columns: time, action, user (email), resource (type + ID), IP, detail
- **Detail**: a dialog shows the request or the change as formatted JSON

![Audit detail dialog (English UI)](../images/en/38-admin-audit-detail.png)

Users without permission see a "No permission to access this page" empty state.

## 5. Open API credentials

### 5.1 Credential types

| Type | Description | Best for |
|------|------|------|
| **API Key** (static) | A fixed secret, optionally restricted to certain scopes (`chart:read / dataset:read / dashboard:read`) | Long-term data exchange between systems |
| **Access token PAT** | Not static: it **inherits the owning user's** permissions | External calls tied to an individual account |

![Open API management (English UI)](../images/en/13-admin-openapi.png)

### 5.2 Creation and security rules

- When you create one, pick the owning user (a PAT inherits that user's permissions) and an expiry time (leave it empty for no expiry)
- **The credential is shown in plain text only once**, right after it is created or rolled, and it cannot be viewed again once you close the dialog → copy and store it straight away
- A disabled credential blocks external calls immediately (after you disable it, requests return 401/403)

### 5.3 Rolling and deleting

- Rolling (rotate) generates a new key **and immediately invalidates the old one**
- Deletion cannot be undone and asks you to confirm a destructive action

> For the full authentication options, request headers, rate limits and error codes, see the [Open API integration guide](04-open-api-integration.md).

## 6. Day-to-day operations notes

- **Default administrator**: the seed data creates `admin@kanray.local / admin123` automatically. Change that password first thing in production (Users → Reset password)
- **Secrets**: the deployment-level environment variables `JWT_SECRET` (signs user tokens) and `DATASOURCE_SECRET` (encrypts data source secrets at rest). See the [Deployment & operations manual](05-deployment-and-operations.md) for how to rotate them
- Everything an administrator does lands in the audit log, which is what you use as the record of a change
