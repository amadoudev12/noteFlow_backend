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
const { getBulletinInformation, getMention } = require('./util')
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
const generate = async (matricule) => {
    const tempDir = path.join(os.tmpdir(), 'puppeteer-session-' + Date.now())
    fs.mkdirSync(tempDir, { recursive: true })
    let page;
    try {
        const anneeAcademique = await prisma.anneeAcademique.findFirst({where:{actif:true}})
        const trimestre = await prisma.trimestre.findFirst({
            where : { actif: true }
        })
        const absences = await prisma.absence.findMany({
            where:{
                eleveId: matricule,
                trimestreId: trimestre.id_trimestre,
                anneeAcademiqueId: anneeAcademique.id
            }
        });


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
        const { eleveInfo, matiere, moyenneGenerale, rang, enseignants, etablissement, rangMatiere, signature } = await getBulletinInformation(matricule)
        const enseignantWithSignatures = await Promise.all(
            enseignants.map(async (ens) => {
                const pathName = await prisma.signature.findUnique({
                    where : {
                        compteInstitutionnelId:ens.compteInstitutionnelId
                    }
                })
                return pathName?.url ??  ""
            })
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
        await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 45000 })
        await new Promise(resolve => setTimeout(resolve, 2000))
        
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
        await new Promise(resolve => setTimeout(resolve, 500))
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
        await browser.close()
        const relativePath = `uploads/bulletins/${fileName}`
        await prisma.bulletin.upsert({
            where : {
                eleveId_idtrimestre_id_annee:{
                    eleveId:eleveInfo.eleve.matricule,
                    idtrimestre:trimestre.id_trimestre,
                    id_annee:1,
                }
            },
            update : {
                fichier_url: relativePath
            },
            create : {
                eleveId: matricule,
                idtrimestre: trimestre.id_trimestre,
                id_annee: 1,
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


const generateClasseBulletins = async (id_classe) => {
    const inscriptions = await prisma.inscription.findMany({
        where: { id_classe },
        include: { eleve: true }
    })

    if (!inscriptions.length) {
        throw new Error("Aucun élève")
    }

    const results = []

    for (const ins of inscriptions) {
        try {
            const file = await generate(ins.eleve.matricule)
            results.push({
                matricule: ins.eleve.matricule,
                status: "success",
                file
            })
        } catch (err) {
            results.push({
                matricule: ins.eleve.matricule,
                status: "error"
            })
        }
    }

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
