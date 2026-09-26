# 06 常见问题 FAQ

按场景组织的问答。若未覆盖你的问题，可参考 [开放 API 集成指南](04-开放API集成指南.md)、[部署运维手册](05-部署运维手册.md) 或产品相关文档。

# 06 Frequently Asked Questions

Questions and answers grouped by scenario. If your question is not covered here, see the [Open API integration guide](04-开放API集成指南.md), the [Deployment & operations manual](05-部署运维手册.md), or the other product documents.

## 一、账号与登录

**Q1：忘记密码怎么办？**
请管理员在「系统管理 → 用户管理」为你重置密码。系统不提供自助找回。

**Q2：登录提示「账号已被禁用」？**
账号被管理员停用。联系管理员启用后即可登录。

**Q3：初始管理员账号是什么？**
`admin@kanray.local / admin123`（Docker 部署时可用 `deploy/docker/.env` 中 `ADMIN_INITIAL_PASSWORD` 自定义）。生产环境务必第一时间修改。

**Q4：密码有什么要求？**
至少 8 位，且同时包含字母和数字。

**Q5：修改 JWT_SECRET 后大家都掉线了？**
正常现象。`JWT_SECRET` 用于签发令牌，修改后存量登录态全部失效，需要重新登录（业务影响较大，非必要时不轮换）。

## I. Accounts and Sign-In

**Q1: I forgot my password — what now?**
Ask an administrator to reset it for you under 「系统管理 → 用户管理」 (System Management → User Management). The system has no self-service password recovery.

**Q2: Sign-in says "account disabled"?**
An administrator has deactivated the account. Ask them to re-enable it, and you can sign in again.

**Q3: What is the initial admin account?**
`admin@kanray.local / admin123` (for Docker deployments you can set your own via `ADMIN_INITIAL_PASSWORD` in `deploy/docker/.env`). Change it as soon as possible in production.

**Q4: What are the password requirements?**
At least 8 characters, containing both letters and digits.

**Q5: Everybody got signed out after I changed JWT_SECRET — why?**
That is expected. `JWT_SECRET` is used to sign tokens, so changing it invalidates every existing session and users have to sign in again (the business impact is significant, so do not rotate it unless you must).

## 二、数据源与同步

**Q6：为什么数据源列表是空的？**
数据源按所属用户隔离，普通用户只能看到自己创建的；管理员可见全部。

**Q7：文件型数据源为什么不能选「同步」模式？**
Excel/CSV 上传后即作为本地数据集直接使用，无需（也不支持）同步模式。同步模式专门用于外部数据库回落到本机。

**Q8：同步任务为什么没执行？**
检查：源库连通性、任务状态、水印字段是否单调递增、刷新周期是否设置（周期 0 表示仅手动触发「立即同步」）。

**Q9：数据源密码写错/忘了有影响吗？**
连接密码入库前经 `DATASOURCE_SECRET` 加密保存。编辑时密码框显示 `********` 表示保留原密码；只有重新输入明文才会覆盖。

**Q10：修改 DATASOURCE_SECRET 后同步/直连全失败了？**
密钥变更后历史连接密码无法解密，需逐一重新保存各数据源密码，或回滚密钥。

## II. Data Sources and Sync

**Q6: Why is my data source list empty?**
Data sources are isolated per owner: regular users only see the ones they created, while administrators see all of them.

**Q7: Why can't a file-based data source use "sync" mode?**
An uploaded Excel/CSV file is used directly as a local dataset, so sync mode is unnecessary (and unsupported) for it. Sync mode exists specifically to pull external databases down to the local machine.

**Q8: Why didn't my sync job run?**
Check: connectivity to the source database, the job's status, whether the watermark field increases monotonically, and whether a refresh interval is set (an interval of 0 means it only runs when you trigger 「立即同步」 (Sync now) manually).

**Q9: Does it matter if a data source password is wrong or forgotten?**
Connection passwords are encrypted with `DATASOURCE_SECRET` before being stored. When you edit a data source, the password field showing `********` means the existing password is kept; it is only overwritten if you type a new plaintext password.

**Q10: Everything failed after I changed DATASOURCE_SECRET — sync and direct connections alike?**
After the key changes, existing connection passwords can no longer be decrypted. Re-save each data source password one by one, or roll the secret back.

## 三、分享

**Q11：分享链接点开要密码？**
创建分享时默认设置访问密码（4–64 位）保护只读分享页；也可关闭「密码」开关生成无需密码、打开即看的公开分享。分享无需登录。

**Q12：怎么让分享链接失效？**
看板列表 → 操作 → 分享 → 停用/删除该分享。停用后访问链接将无法查看。

**Q13：分享链接能设置有效期吗？**
分享链接支持自定义过期时间：创建分享时可在弹窗中选择具体到期时间，到期后链接失效；不填则长期有效。

**Q14：为什么登录用户看不到某些看板？**
看板按 owner 隔离，且需要看板读取权限。分享页是跨用户只读访问的例外场景。

## III. Sharing

**Q11: A share link asks for a password?**
By default an access password (4–64 characters) is set when you create a share, protecting the read-only share page. You can also turn the "password" option off to get a public share that opens without one. Sharing never requires signing in.

**Q12: How do I invalidate a share link?**
Dashboard list → Actions (操作) → Share → deactivate or delete that share. Once deactivated, the link no longer shows anything.

**Q13: Can share links expire automatically?**
Share links support a custom expiry: when you create a share you can pick a specific expiry in the dialog, and the link stops working once it passes. Leave it empty for a link that never expires.

**Q14: Why can't a signed-in user see some dashboards?**
Dashboards are isolated by owner and also require dashboard read permission. The share page is the one exception: it grants cross-user read-only access.

## 四、图表与看板

**Q15：图表列表显示「已失效」？**
图表的绑定数据集被删除或不可见。需重新绑定数据集或重建图表。

**Q16：某些图表类型配置报「字段不足」？**
部分图表需要特定数量的维度/指标（如热力图需 2 维 1 指标、散点图需 X 维度 + Y 数值、旭日图需要层级维度），按构建器提示补足字段。

**Q17：怎么让多张图表一起联动筛选？**
在看板编辑模式添加「筛选」组件，选择数据源与字段；预览时切换筛选值，所有同数据源图表自动联动刷新。

**Q18：看板全屏怎么退出？**
看板查看页顶部「全屏」进入，Esc 或再次点击退出回到页面。

## IV. Charts and Dashboards

**Q15: A chart in the list shows as "invalid"?**
The dataset the chart is bound to was deleted or is no longer visible to you. Rebind a dataset or rebuild the chart.

**Q16: Some chart types report "not enough fields"?**
Certain charts need a specific number of dimensions/measures (for example a heatmap needs 2 dimensions + 1 measure, a scatter plot needs an X dimension + a Y measure, a sunburst needs a hierarchical dimension). Add the fields the builder asks for.

**Q17: How do I make several charts filter together?**
Add a "filter" (筛选) component in dashboard edit mode and pick the data source and field. While previewing, changing the filter value refreshes every chart on that data source automatically.

**Q18: How do I leave fullscreen on a dashboard?**
Enter fullscreen with "Full screen" (全屏) at the top of the dashboard view page; press Esc or click it again to return to the page.

## 五、开放 API

**Q19：返回 401？**
凭证缺失、无效、已停用或已过期。检查 `Authorization: Bearer kan_*` 或 `X-API-Key: kan_*` 是否正确携带，且 Key 处于启用态、未过期。

**Q20：返回 403 但 Key 明明有效？**
该 Key 缺少所需权限（API Key 未勾选对应 Scope，或 PAT 授权用户无该权限）。系统管理中对 Key 授予相应 Scope 后重试。

**Q21：返回 404「资源不存在或无权访问」？**
凭证无权访问该资源，或资源不存在。开放 API 对越权与不存在统一掩蔽为 404（不泄露资源是否存在）。

**Q22：返回 422「聚合包含未注册字段」？**
请求中的 metrics/dimensions/filters 字段必须是该数据集已注册的字段名。检查字段名与数据集「字段定义」一致（展示名≠内部字段名时以内部字段名为准）。

**Q23：CSV 用 Excel 打开中文乱码？**
本系统 CSV 输出带 BOM，Excel 可正常识别。若用命令行/脚本读取，建议以 UTF-8 解析。

**Q24：开放 API 有调用频率限制吗？**
每 Key 每分钟限流（默认 `OPEN_API_RATE_PER_MIN=120`），超限返回 429。可按需在环境变量调高。

## V. Open API

**Q19: I get a 401.**
The credential is missing, invalid, deactivated, or expired. Check that `Authorization: Bearer kan_*` or `X-API-Key: kan_*` is actually being sent, and that the key is enabled and not expired.

**Q20: I get a 403 even though the key is clearly valid?**
The key lacks the required permission (the API key has no matching scope ticked, or the user a PAT was created for does not hold that permission). Grant the key the relevant scope under System Management and retry.

**Q21: I get a 404 saying "resource does not exist or you have no access to it"?**
Either the credential may not access that resource, or the resource does not exist. The Open API deliberately masks "no access" and "does not exist" as the same 404, so it never reveals whether a resource exists.

**Q22: I get a 422 saying "the aggregation contains unregistered fields"?**
The metrics/dimensions/filters fields in the request must be registered field names of that dataset. Check that the field names match the dataset's "field definitions" (when the display name differs from the internal field name, the internal field name is authoritative).

**Q23: Chinese text is garbled when I open the CSV in Excel?**
Our CSV output includes a BOM, which Excel recognises correctly. If you read it from the command line or a script, parse it as UTF-8.

**Q24: Is there a call rate limit on the Open API?**
Yes — per key, per minute (`OPEN_API_RATE_PER_MIN=120` by default), and exceeding it returns 429. Raise it through the environment variable if you need more.

## 六、部署与运维

**Q25：Docker 部署后 Swagger 打不开？**
确认容器正常（`deploy/docker/deploy.sh ps`）且访问 `/api/open/docs`；该地址由 backend 提供，nginx 已反代 `/api`。

**Q26：修改端口/换域名怎么改？**
改 `deploy/docker/.env` 的 `KANRAY_PORT`，重启 `deploy/docker/deploy.sh restart` 生效；nginx 反代外部端口即可对外暴露。

**Q27：`deploy/docker/deploy.sh down -v` 有什么风险？**
删除全部数据卷（元数据库与同步落库数据不可恢复）。日常停机用 `deploy/docker/deploy.sh down`（保留数据）。

**Q28：怎么看同步/操作日志？**
同步日志在数据源详情页「同步任务 → 日志」查看；平台操作记录在「系统管理 → 操作审计」查看，容器日志用 `deploy/docker/deploy.sh logs`。

## VI. Deployment and Operations

**Q25: Swagger will not open after a Docker deployment?**
Check that the containers are healthy (`deploy/docker/deploy.sh ps`) and that you are opening `/api/open/docs`; that path is served by the backend, and nginx reverse-proxies `/api`.

**Q26: How do I change the port or switch to a different domain?**
Change `KANRAY_PORT` in `deploy/docker/.env` and run `deploy/docker/deploy.sh restart` for it to take effect; the external port is what you expose (or point your reverse proxy at).

**Q27: What are the risks of `deploy/docker/deploy.sh down -v`?**
It deletes every data volume (the metadata database and the synced data cannot be recovered). For a routine shutdown use `deploy/docker/deploy.sh down`, which keeps the data.

**Q28: Where do I see sync logs and the audit log?**
Sync logs live on the data source detail page under 「同步任务 → 日志」 (Sync jobs → Logs); platform activity is under 「系统管理 → 操作审计」 (System Management → Audit Log), and container logs come from `deploy/docker/deploy.sh logs`.

## 七、其他

**Q29：上传文件报「超过 20MB / 20 万行」限制？**
当前版本限制单文件 ≤20MB 且 ≤20 万行，请拆分上传或清洗数据。

**Q30：注册的普通用户能建数据源吗？**
取决于角色权限：新建数据源需要 `datasource:create` 权限点。数据工程师/分析师角色具备，查看者角色只读。可让管理员在角色管理中调整配置。

## VII. Miscellaneous

**Q29: An upload fails with "exceeds the 20MB / 200,000 row limit"?**
The current version limits each file to ≤20MB and ≤200,000 rows. Split the file or clean the data before uploading.

**Q30: Can a regular registered user create a data source?**
It depends on the role's permissions: creating a data source requires the `datasource:create` permission point. The data engineer and analyst roles have it, while the viewer role is read-only. An administrator can adjust this in role management.
