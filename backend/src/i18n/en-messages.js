// 中文错误/成功原文 → 英文文案。
//
// errorHandler 与 ok() 查表得到 messageEn；查不到时**省略**该字段，由前端回退中文，
// 因此漏译只影响英文界面的可读性，不会丢信息、也不会抛错。
//
// 三张表：
//   MESSAGES          静态字面量错误消息，键为完整中文原文
//   SUCCESS_MESSAGES  ok() 的自定义成功文案
//   MESSAGE_TEMPLATES 带插值的模板消息，键保留源码里的 ${...} 表达式原文；
//                     运行期编译成正则捕获实际值，再回填到英文模板的对应位置
//
// 术语与前端 en-US 词典保持一致：数据集=Dataset、数据源=Data source、表单=Form、
// 图表=Chart、看板=Dashboard、大屏=Big screen、指标=Metric、令牌=Token。
// 不翻译技术标识：表名、字段名、节点类型、权限码、文件名、DSL 关键字等原样保留。

const MESSAGES = {
  // ---- 通用参数与状态 ----
  '参数不完整': 'Missing parameters',
  '参数不正确': 'Invalid parameters',
  '请求参数不正确': 'Invalid request parameters',
  '查询参数不正确': 'Invalid query parameters',
  '提交参数不正确': 'Invalid submission parameters',
  '指标参数不正确': 'Invalid metric parameters',
  '非法状态': 'Invalid state',
  '提交冲突，请重试': 'Submission conflict, please retry',
  '没有可更新的字段': 'No fields to update',

  // ---- 鉴权与账号 ----
  '未登录': 'Not signed in',
  '未认证': 'Unauthenticated',
  '无权访问该资源': 'You do not have access to this resource',
  '资源不存在': 'Resource not found',
  '资源不存在或无权访问': 'Resource not found or you do not have access to it',
  '用户不存在': 'User not found',
  '用户信息无效': 'Invalid user information',
  '账号不存在': 'Account not found',
  '账号不可用': 'Account is unavailable',
  '账号已被禁用': 'Account has been disabled',
  '账号已禁用': 'Account is disabled',
  '不能删除当前登录账号': 'You cannot delete the account you are signed in with',
  '密码错误': 'Incorrect password',
  '原密码不正确': 'Incorrect current password',
  '密码至少 8 位且需同时包含字母和数字': 'Password must be at least 8 characters and contain both letters and digits',
  '新密码至少 8 位且包含字母和数字': 'New password must be at least 8 characters and contain both letters and digits',
  '请输入邮箱和密码': 'Please enter your email and password',
  '邮箱或密码不正确': 'Incorrect email or password',
  '邮箱格式不正确': 'Invalid email format',
  '该邮箱已存在': 'This email is already in use',
  '该邮箱已注册': 'This email is already registered',
  '昵称不合法': 'Invalid nickname',
  '注册信息不完整': 'Incomplete registration information',
  '缺少 API Key': 'Missing API Key',
  'API Key 不存在': 'API Key not found',
  'API Key 无效': 'Invalid API Key',
  'API Key 已被吊销': 'API Key has been revoked',
  'API Key 已过期': 'API Key has expired',
  '令牌不存在': 'Token not found',
  '令牌无效': 'Invalid token',
  '令牌已过期': 'Token has expired',
  '刷新令牌无效': 'Invalid refresh token',
  '缺少 refreshToken': 'Missing refreshToken',
  '只能操作自己的令牌': 'You can only manage your own tokens',
  'Key 名称需为 1-100 字符': 'Key name must be 1-100 characters',

  // ---- 角色与权限 ----
  '角色不存在': 'Role not found',
  '角色名称不能为空': 'Role name is required',
  '角色标识不合法（小写字母/数字/下划线）': 'Invalid role key (lowercase letters, digits, underscore)',
  '角色标识已存在': 'Role key already exists',
  '该角色已分配给用户，请先解除': 'This role is assigned to users, revoke the assignment first',
  '内置角色不允许删除': 'Built-in roles cannot be deleted',
  '内置角色权限由系统管理，如需自定义请新建角色': 'Built-in role permissions are managed by the system, create a new role for custom permissions',

  // ---- 分享与访问凭证 ----
  '分享不存在': 'Share not found',
  '分享不存在或已被删除': 'Share not found or already deleted',
  '分享参数不正确': 'Invalid share parameters',
  '分享链接已过期': 'Share link has expired',
  '分享已被关闭': 'Share has been disabled',
  '分享密码需为 4-64 位': 'Share password must be 4-64 characters',
  '分享凭证无效': 'Invalid share credential',
  '分享凭证已过期': 'Share credential has expired',
  '请输入分享密码': 'Please enter the share password',
  '访问凭证已失效': 'Access credential is no longer valid',
  '访问凭证与链接不匹配': 'Access credential does not match this link',
  '缺少访问凭证': 'Access credential is required',
  '过期时间必须晚于当前时间': 'Expiry time must be later than the current time',
  '过期时间格式不正确': 'Invalid expiry time format',

  // ---- 数据源 ----
  '数据源不存在': 'Data source not found',
  '数据源名称不能为空': 'Data source name is required',
  '数据源已停用': 'Data source has been disabled',
  '缺少数据源类型': 'Data source type is required',
  '该数据源不支持查询': 'This data source does not support queries',
  '暂不支持直接修改数据源类型，请删除后重建': 'Changing the data source type directly is not supported, please delete and recreate it',
  '文件型数据源不支持同步': 'File-based data sources do not support sync',
  '文件型数据源不支持同步模式': 'File-based data sources do not support sync mode',
  '同步配置不存在': 'Sync configuration not found',
  '该数据源下同一张源表已存在同步配置': 'A sync configuration for the same source table already exists under this data source',
  '增量同步需要水印字段 watermarkField': 'Incremental sync requires a watermark field (watermarkField)',
  '增量同步需要主键字段(primary_key)': 'Incremental sync requires a primary key field (primary_key)',
  '缺少源表名 sourceTable': 'sourceTable is required',
  '源节点未选择表': 'Source node has no table selected',
  '缺少表名': 'Table name is required',
  '至少需要一张表': 'At least one table is required',
  '请上传文件': 'Please upload a file',
  '不支持含宏的 Excel 文件(.xlsm)': 'Macro-enabled Excel files (.xlsm) are not supported',
  '文件没有工作表': 'The file has no worksheets',
  '上传的文件没有数据行': 'The uploaded file has no data rows',
  '上传的文件除了表头没有数据行': 'The uploaded file has no data rows besides the header',

  // ---- 数据集 ----
  '数据集 ID 无效': 'Invalid dataset ID',
  '数据集名称不能为空': 'Dataset name is required',
  '数据集名称不能为空且不超过 100 字符': 'Dataset name is required and must not exceed 100 characters',
  '数据集字段为空': 'Dataset fields are empty',
  '数据集不属于该数据源': 'The dataset does not belong to this data source',
  '无权限修改该数据集': 'You do not have permission to modify this dataset',
  '非 SQL 数据集': 'Not a SQL dataset',
  '仅 SQL 数据集可编辑': 'Only SQL datasets can be edited',
  '字段不存在': 'Field not found',
  '字段别名不能为空': 'Field alias is required',
  '字段别名不能为空且不超过 100 字符': 'Field alias is required and must not exceed 100 characters',
  '字段引用缺失': 'Field reference is missing',
  '字段引用缺失 field': 'Field reference is missing (field)',
  '选择列至少选一列': 'Select at least one column',
  '请先添加至少一个数据字段（说明文字不计入）': 'Please add at least one data field (description text does not count)',

  // ---- 图表 ----
  '图表不存在': 'Chart not found',
  '图表名称不能为空': 'Chart name is required',
  '图表至少需要一个指标': 'A chart requires at least one metric',
  '至少需要一个指标': 'At least one metric is required',

  // ---- 指标库 ----
  '指标名称不能为空': 'Metric name is required',
  '指标字段不能为空': 'Metric field is required',
  '衍生指标缺少 refId': 'Derived metric is missing refId',
  '衍生指标需引用其前的原子/复合指标': 'A derived metric must reference an earlier atomic or composite metric',
  '已存指标缺少有效 metricId': 'Saved metric is missing a valid metricId',
  '原子指标缺少 field': 'Atomic metric is missing field',
  '复合指标公式不能为空': 'Composite metric formula is required',
  '复合指标公式仅支持引用原子指标($key)以及数字、+ - * / ( ) %': 'Composite metric formula may only reference atomic metrics ($key) and the operators + - * / ( ) %',
  '复合指标公式仅支持引用指标库原子指标($数字ID)以及数字、+ - * / ( ) %': 'Composite metric formula may only reference atomic metrics from the metric library ($ID) and the operators + - * / ( ) %',
  '公式括号不匹配': 'Unbalanced parentheses in formula',

  // ---- 看板 ----
  '看板参数不正确': 'Invalid dashboard parameters',
  '看板名称不能为空': 'Dashboard name is required',
  '看板名称不能为空且不超过 100 字符': 'Dashboard name is required and must not exceed 100 characters',
  '看板布局格式不正确': 'Invalid dashboard layout format',
  '看板组件格式不正确': 'Invalid dashboard widget format',
  '图表组件缺少 chartId': 'Dashboard widget is missing chartId',

  // ---- 大屏 ----
  '大屏参数不正确': 'Invalid big screen parameters',
  '大屏名称不能为空': 'Big screen name is required',
  '大屏名称不能为空且不超过 100 字符': 'Big screen name is required and must not exceed 100 characters',
  '模板名称不能为空': 'Template name is required',
  '模板名称不能为空且不超过 100 字符': 'Template name is required and must not exceed 100 characters',

  // ---- 表单 ----
  '表单不存在': 'Form not found',
  '表单不存在或已被删除': 'Form not found or already deleted',
  '表单参数不正确': 'Invalid form parameters',
  '表单当前不可填写': 'This form is not currently accepting submissions',
  '表单结构不合法': 'Invalid form structure',
  '表单名称不能为空': 'Form name is required',
  '表单名称不能为空且不超过 100 字符': 'Form name is required and must not exceed 100 characters',
  '表单未发布': 'Form is not published',
  '表单未发布，无法提交': 'Form is not published, cannot submit',
  '表单未发布，暂无提交记录': 'Form is not published, no submissions yet',
  '表单已关闭，无法提交': 'Form is closed, cannot submit',
  '该表单每人仅可提交一次': 'Each person may submit this form only once',

  // ---- ETL 构建器 ----
  '构建定义不合法': 'Invalid build definition',
  '构建定义过大': 'Build definition is too large',
  '缺少构建定义': 'Missing build definition',
  '缺少定义或节点': 'Missing definition or node',
  '缺少映射用户': 'Mapping user is required',
  'SQL 仅允许 SELECT/WITH 只读语句': 'SQL only allows read-only SELECT/WITH statements',
  'ETL 定义缺少 output 节点': 'ETL definition is missing the output node',
  'ETL 链不完整，缺少 sourceNode': 'ETL chain is incomplete, sourceNode is missing',
  'ETL节点执行失败': 'ETL node execution failed',
  'aggregate 节点必须指定 sourceNode': 'aggregate node must specify sourceNode',
  'columnSelect 节点必须指定 sourceNode': 'columnSelect node must specify sourceNode',
  'dedup 节点必须指定 sourceNode': 'dedup node must specify sourceNode',
  'filter 节点必须指定 sourceNode': 'filter node must specify sourceNode',
  'join 节点必须指定 sourceNode': 'join node must specify sourceNode',
  'join 节点必须指定 rightNodeId 或 to.schema/to.table': 'join node must specify rightNodeId or to.schema/to.table',
  'nullReplace 节点必须指定 sourceNode': 'nullReplace node must specify sourceNode',
  'output 节点必须指定 sourceNode': 'output node must specify sourceNode',
  'trim 节点必须指定 sourceNode': 'trim node must specify sourceNode',
  'valueReplace 节点必须指定 sourceNode': 'valueReplace node must specify sourceNode',
  'sqlNode SQL 不能为空': 'sqlNode SQL must not be empty',
  'sqlNode SQL 仅允许 SELECT/WITH 只读语句': 'sqlNode SQL only allows read-only SELECT/WITH statements',

  // ---- 兜底 ----
  '服务器内部错误': 'Internal server error',
  '上传内容过大': 'Uploaded content is too large',
  '请求体不是合法 JSON': 'Request body is not valid JSON',

  // ---- 限流 ----
  '请求过于频繁，请稍后再试': 'Too many requests, please try again later',
  '密码尝试次数过多，请稍后再试': 'Too many password attempts, please try again later',
};

const SUCCESS_MESSAGES = {
  '登录成功': 'Signed in successfully',
  '已退出登录': 'Signed out',
  '注册成功': 'Registered successfully',
  '密码已修改': 'Password changed',
  '资料已更新': 'Profile updated',

  '更新成功': 'Updated successfully',
  '删除成功': 'Deleted successfully',
  '重命名成功': 'Renamed successfully',
  '刷新成功': 'Refreshed successfully',
  '提交成功': 'Submitted successfully',

  '用户创建成功': 'User created',
  '用户列表': 'User list',
  '用户已更新': 'User updated',
  '用户已删除': 'User deleted',
  '角色创建成功': 'Role created',
  '角色列表': 'Role list',
  '角色已更新': 'Role updated',
  '角色已删除': 'Role deleted',
  '权限列表': 'Permission list',
  '审计日志': 'Audit log',

  '数据源创建成功': 'Data source created',
  '数据集创建成功': 'Dataset created',
  '字段更新成功': 'Fields updated',
  '图表创建成功': 'Chart created',
  '图表更新成功': 'Chart updated',
  '看板创建成功': 'Dashboard created',
  '看板更新成功': 'Dashboard updated',
  '大屏创建成功': 'Big screen created',
  '大屏更新成功': 'Big screen updated',
  '模板保存成功': 'Template saved',

  '指标创建成功': 'Metric created',
  '指标更新成功': 'Metric updated',
  '指标删除成功': 'Metric deleted',

  '表单创建成功': 'Form created',
  '表单更新成功': 'Form updated',
  '表单发布成功': 'Form published',
  '表单已关闭': 'Form closed',

  '分享创建成功': 'Share created',
  '分享更新成功': 'Share updated',
  '分享删除成功': 'Share deleted',
  '访问令牌已创建': 'Access token created',
  '令牌已更新': 'Token updated',
  '令牌已删除': 'Token deleted',
  '令牌已滚动，请立即保存新令牌': 'Token rotated, please save the new token immediately',

  'API Key 创建成功': 'API Key created',
  'API Key 已更新': 'API Key updated',
  'API Key 已删除': 'API Key deleted',
  'API Key 已滚动，请立即保存新的 Key': 'API Key rotated, please save the new key immediately',

  '同步配置已创建，首同步已触发': 'Sync configuration created, the first sync has been triggered',
  '同步配置已删除': 'Sync configuration deleted',

  // 数据源 provider 的 testConnection 结果文案（在 data.message 里，由前端挑选）
  '连接成功': 'Connection successful',
  '文件数据源已导入': 'File data source imported',


  // new Error('中文') 抛出的一类：provider 把连接失败原因原样带进 data.message
  '缺少 URL': 'URL is required',
  '连接超时': 'Connection timed out',
  'API 返回为空，无法枚举表': 'The API returned an empty response; cannot enumerate tables',
  'API 返回为空数组，无法推断列': 'The API returned an empty array; cannot infer columns',
  '缺少可选依赖 odbc，请先安装：npm i odbc（需本机 unixODBC 与达梦 DM ODBC 驱动；macOS 官方驱动暂无）': 'Missing optional dependency odbc; install it first: npm i odbc (requires local unixODBC and the DM ODBC driver; there is no official macOS driver)',
  '缺少可选依赖 ibm_db，请先安装并编译：npm i ibm_db（DB2 数据源需要，需本机 C++ 工具链）': 'Missing optional dependency ibm_db; install and build it first: npm i ibm_db (required for DB2 data sources, needs a local C++ toolchain)',
  'ES 直查暂不支持聚合查询，请改用「同步数据源」物化后再查询': 'Direct ES queries do not support aggregation yet; materialize the data with a sync data source first',
  'ES 查询缺少 FROM 索引': 'The ES query is missing its FROM index',
  'ES 直查暂支持简单列投影，复杂表达式请改用同步物化': 'Direct ES queries only support simple column projection; use synced materialization for complex expressions',
  '文件数据源仅允许访问数据集本地表（ds_*）': 'File data sources may only read the dataset local table (ds_*)',
  '文件数据源仅允许单条查询': 'File data sources only allow a single query',
  '缺少可选依赖 hive-driver，请先安装：npm i hive-driver（Hive/Impala 数据源需要）': 'Missing optional dependency hive-driver; install it first: npm i hive-driver (required for Hive/Impala data sources)',
  'Kerberos 认证需要可选原生依赖 kerberos，请先安装并编译：npm i kerberos（hive-driver 使用 mongodb/kerberos）': 'Kerberos auth needs the optional native dependency kerberos; install and build it first: npm i kerberos (used by hive-driver for mongodb/kerberos)',
  'MaxCompute 未返回实例 ID': 'MaxCompute did not return an instance ID',
  'ETL 定义缺少节点': 'The ETL definition is missing nodes',
};

// 带插值的模板消息。键保留源码里的 ${...} 表达式原文（表达式内容不参与匹配，
// 编译成正则时统一替换为捕获组），值是同样保留 ${...} 的英文模板。
const MESSAGE_TEMPLATES = {
  '「${f.label}」为必填项': '"${f.label}" is required',
  '「${f.label}」必须是数字': '"${f.label}" must be a number',
  '「${f.label}」选项不合法': '"${f.label}" has an invalid option',
  '「${f.label}」日期格式须为 YYYY-MM-DD': '"${f.label}" date must use the YYYY-MM-DD format',
  '「${f.label}」长度不能超过 5000 字符': '"${f.label}" must not exceed 5000 characters',
  '已有提交数据，禁止删除字段: ${removed.join(\'、\')}': 'Submissions already exist, these fields cannot be deleted: ${removed.join(\', \')}',
  '已有提交数据，禁止修改字段类型: ${typeChanged.join(\'、\')}': 'Submissions already exist, these field types cannot be changed: ${typeChanged.join(\', \')}',

  '数据集不存在: id=${id}': 'Dataset not found: id=${id}',
  '数据集不存在: id=${datasetId}': 'Dataset not found: id=${datasetId}',
  '看板不存在: id=${id}': 'Dashboard not found: id=${id}',
  '图表不存在: id=${id}': 'Chart not found: id=${id}',
  '大屏不存在: id=${id}': 'Big screen not found: id=${id}',
  '大屏模板不存在: id=${id}': 'Big screen template not found: id=${id}',
  '表单不存在: id=${id}': 'Form not found: id=${id}',
  '提交记录不存在: id=${submissionId}': 'Submission not found: id=${submissionId}',
  '指标不存在: id=${id}': 'Metric not found: id=${id}',

  '不支持的操作: ${f.op}': 'Unsupported operation: ${f.op}',
  '不支持的聚合: ${agg}': 'Unsupported aggregation: ${agg}',
  '不支持的聚合: ${d.agg}': 'Unsupported aggregation: ${d.agg}',
  '不支持的筛选操作: ${c.op}': 'Unsupported filter operation: ${c.op}',
  '不支持的筛选操作: ${f.op}': 'Unsupported filter operation: ${f.op}',
  '不支持的排序字段: ${entry}': 'Unsupported sort field: ${entry}',
  '不支持的构建形态: ${definition.type}': 'Unsupported build type: ${definition.type}',
  '不支持的图表类型: ${chartType}': 'Unsupported chart type: ${chartType}',
  '不支持的数据源类型: ${type}': 'Unsupported data source type: ${type}',
  '不支持的 scope: ${unknown.join(\', \')}': 'Unsupported scope: ${unknown.join(\', \')}',
  '不支持的文件类型: ${ext || \'未知\'}': 'Unsupported file type: ${ext || \'unknown\'}',
  '不支持的衍生类型: ${d.derivative}（支持 ${DERIVED_KINDS.join(\'/\')}）': 'Unsupported derived type: ${d.derivative} (supported: ${DERIVED_KINDS.join(\'/\')})',
  '不支持的衍生类型: ${derivedKind}（支持 share/mom/yoy/cumsum/rank）': 'Unsupported derived type: ${derivedKind} (supported: share/mom/yoy/cumsum/rank)',
  '未知数据源类型: ${type}': 'Unknown data source type: ${type}',
  '未知方言: ${driverMeta.family}': 'Unknown dialect: ${driverMeta.family}',
  '方言不支持 upsert: ${dialect.upsertSyntax}': 'Dialect does not support upsert: ${dialect.upsertSyntax}',
  '未知资源: ${resource}': 'Unknown resource: ${resource}',

  '${driverMeta.name} 不支持 Schema 浏览': '${driverMeta.name} does not support schema browsing',
  '${driverMeta.name} 暂不支持接入': '${driverMeta.name} is not supported yet',
  '${driverMeta.name} 暂不支持查询': '${driverMeta.name} does not support queries yet',
  '${meta.name} 暂不支持同步': '${meta.name} does not support sync yet',
  '${meta.name || ds.type} 不支持数据同步': '${meta.name || ds.type} does not support data sync',

  '该数据源不支持测试连接': 'This data source does not support connection testing',
  '该数据源已被 ${used} 个数据集引用，请先删除关联数据集': 'This data source is referenced by ${used} dataset(s), please delete the related datasets first',
  '该 API Key 无权执行操作: ${permission}': 'This API Key is not allowed to perform: ${permission}',
  '无权限执行该操作: ${resource}:${action}': 'You do not have permission for this operation: ${resource}:${action}',

  '表 ${table} 不存在或无可用列': 'Table ${table} does not exist or has no usable columns',
  '源表 ${sc.source_table} 无可用列或不存在': 'Source table ${sc.source_table} does not exist or has no usable columns',
  '源表 ${sourceTable} 无可用列或不存在': 'Source table ${sourceTable} does not exist or has no usable columns',
  '本地表 ${t} 不存在': 'Local table ${t} does not exist',
  '本地表名必须以 ${expect} 开头': 'Local table name must start with ${expect}',
  '数据行数 ${dataRows.length} 超过上限 ${config.upload.maxRows}': 'Row count ${dataRows.length} exceeds the limit of ${config.upload.maxRows}',
  '同步行数超过上限 ${config.upload.maxRows}': 'Synced row count exceeds the limit of ${config.upload.maxRows}',
  '工作表不存在: ${opts.sheet}': 'Worksheet not found: ${opts.sheet}',
  '工作表不存在: ${sheet}（可选: ${names.join(\', \')}）': 'Worksheet not found: ${sheet} (available: ${names.join(\', \')})',
  '工作表序号不存在: ${sheet}（共 ${names.length} 张表）': 'Worksheet index not found: ${sheet} (${names.length} sheet(s) in total)',

  '字段别名不存在: ${r.alias}': 'Field alias not found: ${r.alias}',
  '筛选字段别名不存在: ${r.alias}': 'Filter field alias not found: ${r.alias}',
  '筛选字段不存在: ${f.field}': 'Filter field not found: ${f.field}',
  '关联目标别名不存在: ${to.alias}': 'Join target alias not found: ${to.alias}',
  '维度字段不存在: ${dim.field}': 'Dimension field not found: ${dim.field}',
  '指标字段不存在: ${d.field}': 'Metric field not found: ${d.field}',
  '指标字段不存在: ${raw.field}': 'Metric field not found: ${raw.field}',
  '指标类型仅支持 base/expr/derived，收到: ${kind}': 'Metric type only supports base/expr/derived, received: ${kind}',
  '指标小数位必须是 0-${LIB_MAX_DECIMALS} 的整数，收到: ${v}': 'Metric decimals must be an integer from 0 to ${LIB_MAX_DECIMALS}, received: ${v}',
  '指标库存在未知类型: ${rec.kind}': 'Unknown type in metric library: ${rec.kind}',
  '指标库存在循环引用（id=${rid}）': 'Circular reference in metric library (id=${rid})',
  '指标库仅支持 base/expr/derived 三种类型，收到: ${kind}': 'The metric library only supports base/expr/derived, received: ${kind}',
  '复合指标公式引用了不可用的原子指标 "${key}"（只可引用其前的原子指标）': 'Composite metric formula references unavailable atomic metric "${key}" (only earlier atomic metrics can be referenced)',
  '复合指标公式只能引用指标库原子指标（id=${id} 为 ${rec.kind}）': 'Composite metric formula can only reference atomic metrics from the metric library (id=${id} is ${rec.kind})',
  '衍生指标(${derivedKind})需要至少一个维度': 'Derived metric (${derivedKind}) requires at least one dimension',
  '衍生指标不能引用另一个衍生指标（id=${refId}）': 'A derived metric cannot reference another derived metric (id=${refId})',
  '衍生指标引用了不可用的指标 "${refKey}"（只可引用其前的原子/复合指标）': 'Derived metric references unavailable metric "${refKey}" (only earlier atomic/composite metrics can be referenced)',

  '聚合包含未注册字段: ${[...bad].join(\', \')}': 'Aggregation contains unregistered fields: ${[...bad].join(\', \')}',
  '聚合参数不正确: ${why}': 'Invalid aggregation parameters: ${why}',
  '节点不存在: ${nodeId}': 'Node not found: ${nodeId}',
  '未知节点类型: ${node.nodeType}': 'Unknown node type: ${node.nodeType}',
  'ETL 环依赖: ${node.nodeId}': 'Circular dependency in ETL: ${node.nodeId}',
  '无法删除："${rec.name}" 被图表 "${ch.name}" 引用': 'Cannot delete: "${rec.name}" is referenced by chart "${ch.name}"',
  '无法删除："${rec.name}" 被指标库其他指标 "${r.name}" 引用': 'Cannot delete: "${rec.name}" is referenced by another metric "${r.name}" in the metric library',
  '水印字段不存在: ${wf}': 'Watermark field not found: ${wf}',
  '水印字段需为数值或时间类型: ${wf}(${lower})': 'Watermark field must be numeric or a date/time: ${wf}(${lower})',

  // provider testConnection 结果
  '集群状态: ${health.status}': 'Cluster status: ${health.status}',

  // 与 response.js 里显式写死的 messageEn 保持一致（那两处不经查表，直接透传）
  '文件上传错误: ${err.message}': 'File upload error: ${err.message}',
  '请求路径不存在: ${req.originalUrl}': 'Route not found: ${req.originalUrl}',


  // new Error(`中文模板`) 抛出的一类
  'config.json 解析失败: ${e.message}': 'Failed to parse config.json: ${e.message}',
  '禁止访问数据源目标：${reason} 地址 ${u.hostname}': 'Access to the data source target is blocked: ${reason}, address ${u.hostname}',
  '期望状态码 ${expected}，实际 ${res.statusCode}': 'Expected status code ${expected}, got ${res.statusCode}',
  '禁止访问数据源目标：${reason} 地址 ${address}': 'Access to the data source target is blocked: ${reason}, address ${address}',
  '不支持的 DB_TYPE: ${t}': 'Unsupported DB_TYPE: ${t}',
  'MaxCompute 查询失败: ${st.message || st.errorMsg || status}': 'MaxCompute query failed: ${st.message || st.errorMsg || status}',

  '不支持的 DB_TYPE="${dbType}"，可选: ${STORE_TYPES.join(\' / \')}': 'Unsupported DB_TYPE="${dbType}", options: ${STORE_TYPES.join(\' / \')}',
  '不支持的类型 "${type}"，可选: ${STORE_TYPES.join(\'/\')}': 'Unsupported type "${type}", options: ${STORE_TYPES.join(\'/\')}',
  '连接串需为 TYPE@URL，例如 sqlite@data/kanban.db': 'The connection string must be TYPE@URL, for example sqlite@data/kanban.db',
};

module.exports = { MESSAGES, SUCCESS_MESSAGES, MESSAGE_TEMPLATES };
