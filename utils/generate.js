// const puppeteer = require('puppeteer-core')
// const chromium  = require('@sparticuz/chromium')
// const ejs       = require('ejs')
// const path      = require('path')
// const os        = require('os')
// const fs        = require('fs')
// const { getBulletinInformation } = require('./util')
// const { prisma }    = require('../lib/prisma')
// const supabase  = require('../lib/supabaseClient')

// // ─── Détection environnement ─────────────────────────────────────────────────
// const IS_PROD = process.env.NODE_ENV === 'production'

// // ─── Pool navigateur ─────────────────────────────────────────────────────────
// let browserPool = null

// const getBrowserFromPool = async () => {
//     if (browserPool && browserPool.connected) return browserPool

//     if (IS_PROD) {
//         // Render / Linux : on utilise le Chromium embarqué dans @sparticuz/chromium
//         browserPool = await puppeteer.launch({
//             args:             chromium.args,
//             defaultViewport:  chromium.defaultViewport,
//             executablePath:   await chromium.executablePath(),
//             headless:         chromium.headless,
//         })
//     } else {
//         // Local : on utilise le Chromium installé par puppeteer
//         // npm i puppeteer en dev suffit ; puppeteer-core est utilisé en prod
//         const puppeteerFull = require('puppeteer')
//         browserPool = await puppeteerFull.launch({
//             headless: true,
//             args: ['--no-sandbox', '--disable-setuid-sandbox'],
//         })
//     }

//     // Nettoyage automatique si le browser se ferme de façon inattendue
//     browserPool.on('disconnected', () => { browserPool = null })

//     return browserPool
// }

// // Fermer proprement le pool (utile pour les tests ou le graceful shutdown)
// const closeBrowserPool = async () => {
//     if (browserPool) {
//         try { await browserPool.close() } catch (_) {}
//         browserPool = null
//     }
// }

// // ─── Helpers ─────────────────────────────────────────────────────────────────

// const totalMoyenneCoeficient = (tab) => {
//     if (!tab || tab.length === 0) throw new Error('aucune note')
//     let total = 0
//     tab.forEach(t => { total += t.moyenne * t.coefficient })
//     return total.toFixed(2)
// }

// const getDistinction = (moyenneGenerale) => {
//     if (moyenneGenerale >= 16) return "Félicitations"
//     if (moyenneGenerale >= 14) return "Tableau d'honneur"
//     if (moyenneGenerale >= 12) return "Encouragements"
//     return ""
// }

// const openPage = async (browser) => {
//     const page = await browser.newPage()
//     await page.setDefaultNavigationTimeout(60000)
//     await page.setDefaultTimeout(60000)
//     return page
// }

// const closePage = async (page) => {
//     if (!page) return
//     try {
//         if (!page.isClosed()) await page.close()
//     } catch (e) {
//         console.warn('Fermeture page ignorée :', e.message)
//     }
// }

// const PDF_MARGINS = { top: '20mm', bottom: '20mm', left: '10mm', right: '10mm' }

// // ─── Bulletin d'un seul élève ─────────────────────────────────────────────────

// const generate = async (matricule) => {
//     let page
//     try {
//         const trimestre = await prisma.trimestre.findFirst({ where: { actif: true } })
//         if (!trimestre) throw new Error('Aucun trimestre actif trouvé')

//         const {
//             eleveInfo, matiere, moyenneGenerale,
//             rang, enseignants, etablissement, rangMatiere
//         } = await getBulletinInformation(matricule)
        
//         const decision    = moyenneGenerale >= 10 ? 'Admis' : 'Double'
//         const distinction = getDistinction(moyenneGenerale)

//         const fichier = path.join(__dirname, '../view/bulletin.ejs')
//         const html    = await ejs.renderFile(fichier, {
//             eleve: eleveInfo,
//             matiere,
//             moyenneGenerale: moyenneGenerale ?? 0,
//             rang,
//             decision,
//             enseignants,
//             etablissement,
//             trimestre,
//             totalMoyenneCoeficient: totalMoyenneCoeficient(matiere),
//             distinction,
//             rangMatiere,
//         })

//         const browser = await getBrowserFromPool()
//         page = await openPage(browser)
//         await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 45000 })
//         await new Promise(r => setTimeout(r, 2000))

//         const pdfBuffer = await page.pdf({
//             format: 'A4',
//             printBackground: true,
//             margin: PDF_MARGINS,
//         })

//         await closePage(page)
//         page = null

//         // Upload Supabase
//         const annee          = trimestre.annee ?? '2025-2026'
//         const trimestreLib   = trimestre.libelle
//         const classeLib      = eleveInfo.classe?.libelle ?? 'inconnu'
//         const chemin         = `${annee}/${trimestreLib}/${classeLib}/${matricule}.pdf`

//         const { error: uploadError } = await supabase.storage
//             .from('bulletins')
//             .upload(chemin, pdfBuffer, { contentType: 'application/pdf', upsert: true })

//         if (uploadError) throw uploadError

//         // Persistance en base
//         await prisma.bulletin.upsert({
//             where: {
//                 eleveId_idtrimestre_id_annee: {
//                     eleveId:     eleveInfo.eleve.matricule,
//                     idtrimestre: trimestre.id_trimestre,
//                     id_annee:    1,
//                 },
//             },
//             update:  { fichier_url: chemin },
//             create:  {
//                 eleveId:         matricule,
//                 idtrimestre:     trimestre.id_trimestre,
//                 id_annee:        1,
//                 moyenneGenerale,
//                 decision,
//                 rang,
//                 mention:         distinction,
//                 fichier_url:     chemin,
//             },
//         })

//         console.log('Bulletin généré :', chemin)
//         return chemin

//     } catch (err) {
//         console.error('Erreur génération bulletin :', err)
//         await closePage(page)
//         throw err
//     }
// }

// // ─── Bulletins de toute une classe ───────────────────────────────────────────

// const generateClasseBulletins = async (id_classe) => {
//     const inscriptions = await prisma.inscription.findMany({
//         where:   { id_classe },
//         include: { eleve: true },
//     })

//     if (!inscriptions.length) throw new Error('Aucun élève dans cette classe')

//     const results = []
//     for (const ins of inscriptions) {
//         try {
//             const file = await generate(ins.eleve.matricule)
//             results.push({ matricule: ins.eleve.matricule, status: 'success', file })
//         } catch {
//             results.push({ matricule: ins.eleve.matricule, status: 'error' })
//         }
//     }

//     return results
// }

// // ─── Fiche de notes ───────────────────────────────────────────────────────────

// const generateFicheNote = async (notes, matiere, etablissement, trimestre, classe, infosProf) => {
//     const tempDir = path.join(os.tmpdir(), `puppeteer-${Date.now()}`)
//     fs.mkdirSync(tempDir, { recursive: true })

//     let page
//     try {
//         const fichier = path.join(__dirname, '../view/listeNote.ejs')
//         const html    = await ejs.renderFile(fichier, {
//             notes, matiere, etablissement, trimestre, classe, infosProf,
//         })

//         const browser = await getBrowserFromPool()
//         page = await openPage(browser)
//         await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 45000 })
//         await new Promise(r => setTimeout(r, 3000))

//         const listeFile = path.join(tempDir, 'listeNote.pdf')
//         await page.pdf({
//             path:            listeFile,
//             format:          'A4',
//             printBackground: true,
//             margin:          PDF_MARGINS,
//         })

//         await closePage(page)
//         page = null

//         console.log('Fiche notes générée :', listeFile)
//         return listeFile

//     } catch (err) {
//         console.error('Erreur génération fiche notes :', err)
//         await closePage(page)
//         throw err
//     }
// }

// module.exports = { generate, generateClasseBulletins, generateFicheNote, closeBrowserPool }




const puppeteer = require('puppeteer')
// const chromium = require('@sparticuz/chromium')
const ejs = require('ejs')
const path = require('path')
const os = require('os')
const fs = require('fs')
const { getBulletinInformation, getMention, getClassMoyennes, buildClassRanking } = require('./util')
const { getActiveInscriptionForEleve, getActiveTerm, getActiveSchoolYear } = require('./schoolContext')
const { prisma } = require('../lib/prisma')
const supabase = require('../lib/supabaseClient')

// Pool global pour réutiliser les navigateurs
let browserPool = null

// Fonction pour obtenir un navigateur du pool
// const getBrowserFromPool = async () => {
//     if (!browserPool || !browserPool.connected) {
//         browserPool = await puppeteer.launch({
//             args: chromium.args,
//             defaultViewport: chromium.defaultViewport,
//             executablePath: await chromium.executablePath(),
//             headless: chromium.headless,
//         })
//     }
//     return browserPool
// }

const getBrowserFromPool = async () => {
    if (browserPool && browserPool.connected) {
        return browserPool
    }

    browserPool = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"]
    })

    return browserPool
}
// Fonction pour configurer les options de lancement de Puppeteer
const getLaunchOptions = async () => {
    return {
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
    }
}

const totalMoyenneCoeficient = (tab) => {
    // console.log("tab:",tab)
    if(!tab || tab.length === 0){
        return 0
    }
    let total = 0
    tab.forEach(t => {
        total += t.moyenne * t.coefficient
    })
    return (total).toFixed(2)
}

function Distinction(moyenneGenerale, rang) {
    let distinction = ''
    if (moyenneGenerale >= 16) distinction = "Félicitations";
    else if (moyenneGenerale >= 14) distinction = "Tableau d'honneur";
    else if (moyenneGenerale >= 12) distinction = "Encouragements";
    else distinction = "";
    return distinction
}

// bulletin d'un seul eleve
// `precalcule` (optionnel) : classement de la classe déjà calculé, transmis
// tel quel à getBulletinInformation (voir generateClasseBulletins).
const generate = async (matricule, precalcule = null) => {
    let page;
    try {
        const inscriptionActive = await getActiveInscriptionForEleve(matricule)
        if (!inscriptionActive) {
            throw new Error("Aucune inscription pour l'année académique active")
        }
        const anneeAcademique = inscriptionActive.annee
        const trimestre = await getActiveTerm(inscriptionActive.id_etablissement, anneeAcademique.id)
        if (!trimestre) {
            throw new Error("Aucun trimestre actif")
        }
        // Ces deux requêtes ne dépendent pas l'une de l'autre : autant les
        // lancer en parallèle plutôt que d'attendre la première avant de
        // démarrer la seconde.
        const [absences, bulletinInfo] = await Promise.all([
            prisma.absence.findMany({
                where:{
                    eleveId: matricule,
                    trimestreId: trimestre.id_trimestre,
                    anneeAcademiqueId: anneeAcademique.id
                }
            }),
            getBulletinInformation(matricule, precalcule)
        ]);

        const totalHeures = absences.reduce(
            (total, absence) => total + (absence.nombreHeures ?? 1),
            0
        )
        const heuresJustifiees = absences
            .filter((absence) => absence.justifie === "oui")
            .reduce((total, absence) => total + (absence.nombreHeures ?? 1), 0)
        const bilanAbsence = {
            absents: absences.filter((absence) => absence.statut === "ABSENT").length,
            retards: absences.filter((absence) => absence.statut === "RETARD").length,
            totalHeures,
            heuresJustifiees,
            heuresNonJustifiees: totalHeures - heuresJustifiees,
        };
        const { eleveInfo, matiere, moyenneGenerale, rang, enseignants, etablissement, rangMatiere, signature } = bulletinInfo
        // Une seule requête pour toutes les signatures des enseignants
        // plutôt qu'un aller-retour DB par enseignant.
        const compteIds = enseignants.map(ens => ens.compteInstitutionnelId).filter(Boolean)
        const signaturesEnseignants = compteIds.length
            ? await prisma.signature.findMany({
                where: { compteInstitutionnelId: { in: compteIds } },
                select: { compteInstitutionnelId: true, url: true }
            })
            : []
        const signatureParCompte = Object.fromEntries(
            signaturesEnseignants.map(s => [s.compteInstitutionnelId, s.url])
        )
        const enseignantWithSignatures = enseignants.map(
            ens => signatureParCompte[ens.compteInstitutionnelId] ?? ""
        )
        const decision = moyenneGenerale >= 10 ? "Admis" : "Double"
        const distinction = Distinction(moyenneGenerale)
        const fichier = path.join(__dirname, '../view/bulletin.ejs')
        const baseUrl = process.env.BASE_URL
        const html = await ejs.renderFile(fichier, {
            eleve: eleveInfo,
            matiere,
            moyenneGenerale:moyenneGenerale ?? 0,
            rang,
            decision,
            enseignantWithSignatures,
            etablissement,
            trimestre,
            totalMoyenneCoeficient: totalMoyenneCoeficient(matiere),
            distinction,
            rangMatiere,
            baseurl:baseUrl,
            signatureDirecteur:signature,
            bilanAbsence
        })
        const browser = await getBrowserFromPool()
        page = await browser.newPage()

        await page.setDefaultNavigationTimeout(60000)
        await page.setDefaultTimeout(60000)
        // "networkidle0" attend que les images/polices aient fini de charger
        // (contrairement à "domcontentloaded" suivi d'un sleep arbitraire) :
        // c'est en général bien plus rapide, et surtout ça ne dépend plus
        // d'une durée fixe devinée au hasard.
        await page.setContent(html, { waitUntil: "networkidle0", timeout: 45000 })

        const pdfBuffer = await page.pdf({
                format: 'A4',
                printBackground: true,
                margin: { top: '20mm', bottom: "20mm", left: "10mm", right: "10mm" }
        })
        if(!fs.existsSync('uploads/bulletins')){
            fs.mkdirSync('uploads/bulletins')
        }
        const annee = anneeAcademique.libelle  // récupère dynamiquement si possible
        const trimestreLibelle = trimestre.libelle // ex: T1
        const classe = eleveInfo.classe || "inconnu"
        const fileName = `${matricule}.pdf`
        // const chemin = `${annee}/${trimestreLibelle}/${classe.libelle}/${fileName}`
        const filePath = path.join(__dirname,'../uploads/bulletins', fileName)
        await fs.promises.writeFile(filePath, pdfBuffer)
        try {
            if (page && !page.isClosed()) {
                await page.close()
            }
        } catch (e) {
            console.log("Page déjà fermée, ignore :", e.message)
        }
        // upload vers supabase
        // const { data, error } = await supabase.storage
        //     .from("bulletins")
        //     .upload(chemin, pdfBuffer, {
        //         contentType: "application/pdf",
        //         upsert: true
        //     })

        // if (error) {
        //     console.error("Erreur upload :", error)
        //     throw error
        // }
        // NB : `browser` est le pool partagé (getBrowserFromPool) réutilisé
        // par tous les bulletins — on ne le ferme jamais ici. Le fermer à
        // chaque bulletin forçait Chromium à redémarrer en entier pour
        // l'élève suivant (le gros du temps perdu lors de la génération
        // d'une classe entière venait de là).
        const relativePath = `uploads/bulletins/${fileName}`
        await prisma.bulletin.upsert({
            where : {
                eleveId_idtrimestre_id_annee:{
                    eleveId:eleveInfo.eleve.matricule,
                    idtrimestre:trimestre.id_trimestre,
                    id_annee:anneeAcademique.id,
                }
            },
            update : {
                fichier_url: relativePath
            },
            create : {
                eleveId: matricule,
                idtrimestre: trimestre.id_trimestre,
                id_annee: anneeAcademique.id,
                id_etablissement:etablissement.id,
                moyenneGenerale,
                decision,
                rang,
                mention: distinction,
                fichier_url: relativePath
            }
        })
        return relativePath
    } catch (err) {
        console.log(err)
        if (page) {
            try { await page.close() } catch (e) { console.error("Erreur fermeture page :", e) }
        }
        throw err
    }
}


// Exécute fn sur chaque élément de `items` avec au plus `limit` appels en
// vol simultanément (plutôt qu'un for...await strictement séquentiel, ou un
// Promise.all sans limite qui ouvrirait autant de pages Puppeteer que
// d'élèves d'un coup).
async function mapWithConcurrency(items, limit, fn) {
    const results = new Array(items.length)
    let cursor = 0
    async function worker() {
        while (cursor < items.length) {
            const i = cursor++
            results[i] = await fn(items[i], i)
        }
    }
    await Promise.all(
        Array.from({ length: Math.min(limit, items.length) }, worker)
    )
    return results
}

// Nombre de bulletins générés en parallèle. Les pages Puppeteer partagent
// le même navigateur (getBrowserFromPool), donc une valeur trop haute
// grimperait vite en RAM/CPU sans forcément accélérer grand-chose.
const BULLETIN_CONCURRENCY = 3

const generateClasseBulletins = async (id_classe) => {
    const classe = await prisma.classe.findUnique({
        where: { id: Number(id_classe) },
        select: { idEtablissement: true }
    })
    if (!classe) {
        throw new Error("Classe introuvable")
    }
    const annee = await getActiveSchoolYear(classe.idEtablissement)
    if (!annee) {
        throw new Error("Aucune année académique active")
    }
    const inscriptions = await prisma.inscription.findMany({
        where: { id_classe, id_annee_academique: annee.id },
        include: { eleve: true }
    })

    if (!inscriptions.length) {
        throw new Error("Aucun élève")
    }

    // Le classement (moyennes + rangs) de toute la classe est calculé une
    // seule fois ici, puis transmis à chaque generate() : sans ça, chaque
    // bulletin recalculait indépendamment les moyennes de tous les autres
    // élèves de la classe (O(N²) requêtes pour N élèves).
    const classMoyennes = await getClassMoyennes(id_classe)
    const classement = buildClassRanking(classMoyennes)
    const moyennesParMatricule = Object.fromEntries(
        classMoyennes.map(e => [e.matricule, e])
    )

    const results = await mapWithConcurrency(inscriptions, BULLETIN_CONCURRENCY, async (ins) => {
        const matricule = ins.eleve.matricule
        try {
            const infos = moyennesParMatricule[matricule]
            const rangInfos = classement[matricule]
            const precalcule = infos && rangInfos ? {
                matieres: infos.matieres,
                moyenneGenerale: infos.moyenneGenerale,
                rang: rangInfos.rang,
                rangMatiere: rangInfos.rangMatiere
            } : null
            const file = await generate(matricule, precalcule)
            return { matricule, status: "success", file }
        } catch (err) {
            return { matricule, status: "error" }
        }
    })

    return results
}

const generateFicheNote = async(notes, matiere, etablissement, trimestre, classe, infosProf, profcompteId) => {
    const tempDir = path.join(os.tmpdir(), 'puppeteer-session-' + Date.now())
    fs.mkdirSync(tempDir, { recursive: true })
    // const formattedNotes = notes.map(eleve => {
    //     return {
    //         infos: eleve[0]?.infos || {},
    //         notes: eleve[0]?.notes || []
    //     }
    // })
    let page
    try {
        // const pathName = `signature/${profUserId}.png`
        // console.log('pathname',pathName)
        // const { data, error } = await supabase
        //         .storage
        //         .from('signatures')
        //         .createSignedUrl(pathName, 3600);
        const signature = await prisma.signature.findFirst({
            where: {
                compteInstitutionnelId:profcompteId
            }
        })
        console.log(profcompteId)
        const baseUrl = process.env.BASE_URL
        const fichier = path.join(__dirname, '../view/listeNote.ejs')
        const html = await ejs.renderFile(fichier, {
            notes,
            matiere,
            etablissement,
            trimestre,
            classe,
            infosProf,
            imageUrl:signature?.url ?? "",
            baseurl:baseUrl
        })
        
        const browser = await getBrowserFromPool()
        page = await browser.newPage()
        
        await page.setDefaultNavigationTimeout(60000)
        await page.setDefaultTimeout(60000)
        await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 45000 })
        await new Promise(resolve => setTimeout(resolve, 3000))
        
        const listeFile = path.join(tempDir, 'listeNote.pdf')
        await page.pdf({
            path: listeFile,
            format: 'A4',
            printBackground: true,
            margin: { top: '20mm', bottom: '20mm', left: '10mm', right: '10mm' }
        })
        await new Promise(resolve => setTimeout(resolve, 500))
        await page.close()
        
        return listeFile
    } catch(err) {
        console.error("Erreur génération PDF :", err)
        if (page) {
            try { await page.close() } catch (e) { console.error("Erreur fermeture page :", e) }
        }
        throw err
    }
}

module.exports = { generate, generateClasseBulletins, generateFicheNote }
