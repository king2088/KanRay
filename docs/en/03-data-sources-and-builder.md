# 03 Data Sources & Builder

> 中文: [03-数据源与构建器.md](../03-数据源与构建器.md)

For data engineers. Besides uploading files directly, the system can connect to external databases and build datasets on top of them in three different ways.

## 1. Data sources at a glance

The **Data sources** page manages every external connection and file-based data source.

![Data source list (English UI)](../images/en/15-datasources.png)

### 1.1 Supported drivers

The **New data source** dropdown offers 22 driver types, plus a separate **Upload Excel / CSV file** entry:

`MySQL / PostgreSQL / SQL Server / MariaDB / TiDB / ClickHouse / Elasticsearch / API/Web Service / Oracle / DB2 / 达梦 / GBASE / Hive / Impala / Presto / MaxCompute / Doris / StarRocks / Greenplum / KingbaseES / GaussDB / Redshift`

![New data source dialog (English UI)](../images/en/32-datasource-new.png)

### 1.2 Two connection modes

| Mode | Description | When to use |
|------|------|------|
| **Direct (`direct`)** | Connects to the external database in real time on every query | Moderate data volume, real-time freshness required |
| **Sync (`sync`)** | Copies the source table into local storage first, then queries the local table | Large data volumes, a slow source database, or when an offline snapshot is needed |

> **Note:** File-based data sources (Excel/CSV) **do not support sync mode**. Once uploaded, they are used as datasets directly.

### 1.3 Security and storage

- The **password field** in the connection config is **encrypted with AES before it is stored** (the key comes from the deployment environment variable `DATASOURCE_SECRET`).
- When editing, leaving `********` untouched means "keep the existing password unchanged".
- Data sources are isolated by owner: a regular user sees only what they created, while an administrator sees everything.

### 1.4 List actions

![Data source details (English UI)](../images/en/16-datasource-detail.png)

## 2. Data source details

The details page contains:

- **Info card**: type, mode (sync/direct), and the most recent test result.
- **File data source card**: shows the row/column counts and can be used for chart building right away.
- **Sync task card** (sync mode only): create a sync task that pulls the remote table into local storage.
- **Schema browser**: browse the tree of loaded schemas and tables, and create a **new build** or a **dataset** straight from a table.

> **Note:** **Excel / CSV file data sources** do not support Schema browsing, and the details page shows this tip: "Excel / CSV data sources do not support Schema browsing. Manage and preview the data from the dataset list." In the dataset list, the **Edit build** button on an Excel dataset is greyed out; to change the data, upload a new file from the data source page.

### 2.1 Creating a sync task

Dialog fields:

| Field | Description |
|------|------|
| Source schema / source table | Pick from the remote database |
| Target table name | Name of the local table to store the data in |
| Strategy | Incremental by watermark / full refresh every time |
| Watermark field (incremental) | A monotonically increasing date/number column |
| Primary key (incremental) | Used to deduplicate incremental updates (upsert) and to reconcile deletions |
| Delete reconciliation (incremental) | On by default: compare primary keys on every run and delete locally the rows already removed at the source (this scans the primary key once more on large tables, so it can be turned off) |
| Refresh interval | In seconds; `0` = manual only |

Creating the task triggers the first sync immediately. Synced data lands in local storage, so the local table shows up in the browser tree. **Sync now / Logs / Delete** manage the task; the sync log dialog shows the time, level, and content, and for incremental mode the "Sync now" log also records how many rows the delete reconciliation removed.

![New sync task dialog (English UI)](../images/en/35-sync-task-dialog.png)

> **Note:** The full strategy DROPs and rebuilds the whole local table on every run, so it is naturally consistent with the source. The incremental strategy relies on primary-key reconciliation to remove deleted rows, so delete reconciliation only takes effect on incremental tasks that have a primary key configured.

## 3. The dataset builder

Click **New build** on a table in the data source's Schema tree to open the builder. It supports **three build modes**, switched via the tabs at the top:

![Chart builder (English UI)](../images/en/06-chart-builder.png)

> **Note:** All three modes produce a **SQL dataset**. A dataset from a file upload is equivalent to an already-materialized visual/ETL result and can be used by charts directly.

![Raw SQL builder (English UI)](../images/en/33-builder-sql.png)

### 3.1 Pure SQL

Write the query directly in the code editor (CodeMirror), with syntax highlighting and auto-completion for table and field names. The SQL you write is executed as-is and the returned fields are inferred automatically; give the dataset a name and save, and you have a dataset.

Suits data-fetching scenarios where you know SQL well and need precise control over the query definition.

### 3.2 Visual

Visual building:
- Pick tables from the Schema tree (multiple tables are supported, with configurable join conditions).
- Choose the output fields, and configure aggregation (group by + SUM/AVG/COUNT/MIN/MAX), filters, and sorting.
- The generated query runs immediately against your configuration, and you can preview the result before saving.

Suits users who do not write SQL.

### 3.3 ETL builder

Canvas-based, multi-step data processing: drag operators from the left panel onto the canvas, connect them into a data flow, and save once the flow reaches an **Output** node. **Deleting a node or a connection uses the context menu** (right-click and pick "Delete").

Built-in operators (11 types):

| Node (icon) | What it does |
|------|------|
| Source | Picks the table to process (from that data source's Schema tree) |
| Join | Joins two tables — INNER/LEFT/RIGHT — with support for multiple `on` conditions |
| Filter | Filters rows by condition: `=`, `≠`, `contains`, `≤/≥/</>` (value), `∈`, and so on |
| Select columns | Outputs only the ticked columns |
| Dedup | Removes duplicates by all columns or by specified columns |
| Value replace | Maps a specific value in a column to a new value |
| Null replace | Replaces NULLs in a column with a specified default |
| Trim | Runs TRIM on the specified columns (all of them by default) |
| Aggregate | Group-by fields plus one or more metrics (SUM/AVG/COUNT/distinct count/MAX/MIN); the metric list is numbered and carries one metric per line |
| SQL | Custom SQL node (code editor with syntax highlighting) |
| Output | Terminal node; you can set the output row limit (1000 by default) |

![ETL builder (English UI)](../images/en/34-builder-etl.png)

**How the SQL node (`sqlNode`) works** — an easy-to-confuse point:

- **Connected to an upstream node**: `__etl_prev` in the SQL stands for "the upstream node's data" and can be queried like a table, for example `SELECT * FROM __etl_prev WHERE ...` or `SELECT x, SUM(y) FROM __etl_prev GROUP BY x` — that is, you write one more layer of SQL on top of the upstream result.
- **Not connected to an upstream node**: the SQL queries a **real table** in that data source directly (you must write the real table name), and `__etl_prev` has no effect. So a pure SQL setup can produce a dataset on its own, with no upstream node required.

**Node preview**: click **Preview this node** in a node's configuration drawer to see the real data that node outputs (capped at 200 rows; the table uses virtual scrolling so large results do not stall the UI). After changing a node's configuration, previewing it again refreshes the result.

### 3.4 Saving and validation

- The name and the build definition are both validated as non-empty before saving.
- On success you get the dataset back and can reference it in the chart builder immediately.
- A definition that fails to parse produces an explicit error.

**About row counts**: when a SQL/ETL dataset is saved, its row count is not computed right away (it is recorded as 0). Opening the **Dataset** list triggers a **batched lazy computation, filled in behind a `…` placeholder animation**, and the result is cached in the database — only datasets still at 0 trigger a computation, and after that, paging or reopening the list reads the cache instead of rescanning the table. Editing and saving the definition again invalidates the count, and the next list load recomputes it.

## 4. Registering a dataset from a loaded table

Hovering a table in the Schema tree reveals a **Create dataset** entry, which registers that table as a dataset in one step (column types are mapped automatically: numeric → number, date/time → date, everything else → string). You can then build charts from it right away.

## 5. Quick path reference

| I want to… | Steps |
|-------|------|
| Connect MySQL and chart it | Data sources → New data source (MySQL) → Test → Details → create a dataset from the Schema tree |
| Avoid slow queries on a large table | Data sources → sync mode → New sync task (full) |
| Pull data by joining three tables | Data sources → New build → ETL → source + join |
| Just need a plain `SELECT` | Data sources → New build → pure SQL |
