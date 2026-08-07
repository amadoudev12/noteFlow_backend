const fs = require('fs');
const path = require('path');
const logger = require('../lib/logger');

const logDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const settingsPath = path.join(logDir, 'super-admin-settings.json');
const activityPath = path.join(logDir, 'super-admin-activity.jsonl');

const defaultSettings = {
  nomPlateforme: 'EduSuite Guinée',
  fuseau: 'GMT (Conakry)',
  langue: 'Français',
  couleur: '#2563eb'
};

const normalizeRole = (payload) => {
  const role = payload?.role || payload?.user?.role || payload?.user?.user?.role || payload?.user?.user?.user?.role || '';
  return String(role || '').toUpperCase();
};

const isSuperAdmin = (payload) => {
  const role = normalizeRole(payload);
  return role === 'SUPER_ADMIN' || role === 'SUPERADMIN';
};

const getDisplayName = (payload) => {
  if (!payload) return 'Super Admin';
  const firstName = payload?.prenom || payload?.user?.prenom || payload?.user?.user?.prenom || '';
  const lastName = payload?.nom || payload?.user?.nom || payload?.user?.user?.nom || '';
  if (firstName || lastName) return `${firstName} ${lastName}`.trim();
  return payload?.login || payload?.user?.login || 'Super Admin';
};

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('fr-FR');
};

const readJsonFile = (filePath, fallback) => {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    return fallback;
  }
};

const writeJsonFile = (filePath, data) => {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
};

const getPlatformSettings = () => readJsonFile(settingsPath, defaultSettings);

const savePlatformSettings = (values) => {
  const nextSettings = { ...defaultSettings, ...getPlatformSettings(), ...values };
  writeJsonFile(settingsPath, nextSettings);
  return nextSettings;
};

const appendSuperAdminLog = (action, description, user = 'Super Admin') => {
  const entry = {
    id: Date.now(),
    action,
    description,
    user,
    date: new Date().toISOString()
  };
  fs.appendFileSync(activityPath, `${JSON.stringify(entry)}\n`, 'utf8');
  logger.info(`[SUPER_ADMIN] ${action}`, { description, user });
  return entry;
};

const readSuperAdminLogs = () => {
  if (!fs.existsSync(activityPath)) return [];
  const content = fs.readFileSync(activityPath, 'utf8').trim();
  if (!content) return [];

  return content
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .sort((a, b) => new Date(b.date) - new Date(a.date));
};

module.exports = {
  normalizeRole,
  isSuperAdmin,
  getDisplayName,
  formatDate,
  defaultSettings,
  getPlatformSettings,
  savePlatformSettings,
  appendSuperAdminLog,
  readSuperAdminLogs
};
