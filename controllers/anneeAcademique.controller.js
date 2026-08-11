const { prisma } = require('../lib/prisma');
const { getSchoolContext } = require('../utils/schoolContext');

const isAdmin = (req) => req.user?.user?.user?.role === 'ADMIN';
const parseDates = (body) => ({ start: new Date(body.date_debut), end: new Date(body.date_fin) });

exports.list = async (req, res) => {
  try {
    const ctx = await getSchoolContext(req);
    const annees = await prisma.anneeAcademique.findMany({ where: { etablissementId: ctx.etablissementId }, include: { trimestres: { orderBy: { ordre: 'asc' } } }, orderBy: { date_debut: 'desc' } });
    res.json({ annees });
  } catch (error) { res.status(error.status || 500).json({ message: error.message || 'Erreur serveur' }); }
};
exports.create = async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ message: 'Accès réservé à l’administrateur' });
    const ctx = await getSchoolContext(req); const { libelle, actif = false } = req.body; const { start, end } = parseDates(req.body);
    if (!libelle?.trim() || Number.isNaN(+start) || Number.isNaN(+end) || start >= end) return res.status(400).json({ message: 'Libellé et période valide requis' });
    const annee = await prisma.$transaction(async (tx) => { if (actif) await tx.anneeAcademique.updateMany({ where: { etablissementId: ctx.etablissementId }, data: { actif: false } }); return tx.anneeAcademique.create({ data: { libelle: libelle.trim(), date_debut: start, date_fin: end, actif: Boolean(actif), etablissementId: ctx.etablissementId } }); });
    res.status(201).json(annee);
  } catch (error) { res.status(error.code === 'P2002' ? 409 : error.status || 500).json({ message: error.code === 'P2002' ? 'Cette année existe déjà pour votre établissement' : error.message || 'Erreur serveur' }); }
};
exports.update = async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ message: 'Accès réservé à l’administrateur' });
    const ctx = await getSchoolContext(req); const id = Number(req.params.id); const current = await prisma.anneeAcademique.findFirst({ where: { id, etablissementId: ctx.etablissementId } });
    if (!current) return res.status(404).json({ message: 'Année introuvable' });
    const { start, end } = parseDates({ date_debut: req.body.date_debut || current.date_debut, date_fin: req.body.date_fin || current.date_fin });
    if (start >= end) return res.status(400).json({ message: 'La date de début doit précéder la date de fin' });
    const annee = await prisma.anneeAcademique.update({ where: { id }, data: { libelle: req.body.libelle?.trim() || current.libelle, date_debut: start, date_fin: end, actif: typeof req.body.actif === 'boolean' ? req.body.actif : current.actif } }); res.json(annee);
  } catch (error) { res.status(error.code === 'P2002' ? 409 : error.status || 500).json({ message: error.message || 'Erreur serveur' }); }
};
exports.activate = async (req, res) => {
  try { if (!isAdmin(req)) return res.status(403).json({ message: 'Accès réservé à l’administrateur' }); const ctx = await getSchoolContext(req); const id = Number(req.params.id); const target = await prisma.anneeAcademique.findFirst({ where: { id, etablissementId: ctx.etablissementId } }); if (!target) return res.status(404).json({ message: 'Année introuvable' }); const annee = await prisma.$transaction(async tx => { await tx.anneeAcademique.updateMany({ where: { etablissementId: ctx.etablissementId }, data: { actif: false } }); return tx.anneeAcademique.update({ where: { id }, data: { actif: true } }); }); res.json(annee); } catch (error) { res.status(error.status || 500).json({ message: error.message || 'Erreur serveur' }); }
};
