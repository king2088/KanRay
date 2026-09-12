const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..', '..'); // backend/
const dataDir = process.env.DATA_DIR || path.join(root, 'data');
const uploadDir = process.env.UPLOAD_DIR || path.join(root, 'uploads');

// ensure runtime directories exist
fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(uploadDir, { recursive: true });

module.exports = {
  port: parseInt(process.env.PORT || '3001', 10),
  root,
  dataDir,
  uploadDir,
  dbPath: process.env.DB_PATH || path.join(dataDir, 'kanban.db'),
  auth: {
    jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
    accessTtl: process.env.ACCESS_TTL || '15m',
    refreshTtlDays: parseInt(process.env.REFRESH_TTL_DAYS || '7', 10),
  },
  upload: {
    // 第一阶段限制：仅 Excel/CSV
    allowedExt: ['.xlsx', '.xls', '.csv'],
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || String(20 * 1024 * 1024), 10), // 20MB
    maxRows: parseInt(process.env.MAX_ROWS || '200000', 10), // 最大 20 万行
    previewRows: 50, // 上传预览行数
  },
};
