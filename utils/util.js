const {prisma} = require('../lib/prisma')
const { getActiveSchoolYear, getActiveTerm, getActiveInscriptionForEleve } = require('./schoolContext')
const getMention = (moyenne) => {
    if (moyenne < 10) return "Insuffisant"
    if (moyenne < 12) return "Passable"
    if (moyenne < 14) return "Assez Bien"
    if (moyenne < 16) return "Bien"
    return "Très Bien"
}
// recuperer la liste des eleves d'une classe



const listeElevesRequest = async (idClasse) => {
    try {
        const classe = await prisma.classe.findUnique({
            where: { id: Number(idClasse) },
            select: { idEtablissement: true }
        });
        if (!classe) {
            throw new Error("Classe introuvable");
        }
        const annee = await getActiveSchoolYear(classe.idEtablissement);
        if (!annee) {
            throw new Error("Aucune année académique active");
        }
        const inscriptions = await prisma.inscription.findMany({
            where: {
                id_classe:Number(idClasse),
                id_annee_academique: annee.id
            },
            include: {
                eleve:true
            }
        });
        // on retourne uniquement les élèves
        const listeEleves = inscriptions.map(i => i.eleve);
        return listeEleves;
    } catch (err) {
        console.log("error au niveau du utils", err);
        throw err;
    }
};


// const moyenne = async (tab, matricule = null) => {
//     if (!tab || tab.length === 0) return 0;

//     let coefAvantInscription = 0;

//     if (matricule) {
//         const annee = await prisma.anneeAcademique.findFirst({
//             where: { actif: true }
//         });

//         const inscription = await prisma.inscription.findUnique({
//             where: {
//                 matricule_eleve_id_annee_academique: {
//                     matricule_eleve: matricule,
//                     id_annee_academique: annee.id
//                 }
//             }
//         });

//         if (inscription) {
//             const result = await prisma.note.aggregate({
//                 where: {
//                     id_inscription: inscription.id
//                 },
//                 _sum: {
//                     coefficient: true
//                 }
//             });

//             coefAvantInscription = result._sum.coefficient || 0;
//         }
//     }

//     let total = 0;
//     let totalCoef = 0;

//     tab.forEach(t => {
//         const val = t.valeur != null ? t.valeur : t.moyenne;

//         if (t.valeur != null) {
//             total += val * t.coefficient;
//             totalCoef += t.coefficient;
//         } else {
//             // t.moyenne => coefficient ne change pas
//             total += val;
//             totalCoef += t.coefficient;
//         }
//     });
//     console.log('coefficient',coefAvantInscription)
//     totalCoef += coefAvantInscription;

//     return parseFloat((total / totalCoef).toFixed(2));
// };
// `round: false` retourne la moyenne brute, sans arrondi — utile pour la
// moyenne par matière, qui sert ensuite de base à d'autres calculs
// (moyenne générale, moyenne × coefficient dans le bulletin) : arrondir à
// cette étape ferait remonter une petite erreur dans tous les calculs
// suivants. L'arrondi à 2 décimales reste la valeur par défaut, et n'est
// appliqué qu'à l'affichage final (moyenne générale, vues EJS, etc.).
const moyenne = (tab, { round = true } = {}) => {
    if (!tab || tab.length === 0) return 0;
    let total = 0;
    let totalCoef = 0;

    tab.forEach(t => {
        // On vérifie explicitement != null pour accepter 0
        const val = t.valeur != null ? t.valeur : t.moyenne;
        total     += val * t.coefficient;
        totalCoef += t.coefficient;
    });

    const resultat = total / totalCoef;
    return round ? parseFloat(resultat.toFixed(2)) : resultat;
}

const moyenneE = (tab)=>{
    if(!tab || tab.length === 0){
        return 0
    }
    let total = 0
    tab.forEach(t=>{
        total += isNaN(t.moyenneGenerale) ? 0 : t.moyenneGenerale
    })
    return parseFloat((total / tab.length).toFixed(2))
}

//recupere toutes les notes d'un eleve
const getNoteFunction = async (id, id_trimestre=null) => {
    if (!id) {
        throw new Error('aucun id selectionné')
    }
    try {
        let matieres = {}
        // L'inscription active de l'élève détermine à elle seule la bonne
        // année académique (et donc le bon établissement) : chaque inscription
        // porte sa propre année, pas besoin de la deviner à l'avance.
        const eleveExists = await prisma.eleve.findUnique({ where: { matricule: id }, select: { matricule: true } })
        if (!eleveExists) {
            throw new Error("élève introuvable")
        }
        const inscription = await getActiveInscriptionForEleve(id)
        if (!inscription) {
            return []
        }

        let idTrimestre = id_trimestre
        if (!idTrimestre) {
            const trimestre = await getActiveTerm(inscription.id_etablissement, inscription.id_annee_academique)
            if (!trimestre) {
                return []
            }
            idTrimestre = trimestre.id_trimestre
        }

        const notes = await prisma.note.findMany({
            where: {
                id_inscription: inscription.id,
                id_trimestre: idTrimestre
            },
            select: {
                valeur: true,
                coefficient: true,
                matiere: {
                    select: {
                        nom: true,
                        affectations: true
                    }
                }
            }
        })
        if (!notes.length) {
            return []
        }
        notes.forEach(note => {
            const nomMatiere = note.matiere.nom
            const coefMatiere = note.matiere.affectations[0]?.coefficient
            if (!matieres[nomMatiere]) {
                matieres[nomMatiere] = {
                    matiere: nomMatiere,
                    coefficient_matiere: coefMatiere,
                    notes: [],
                }
            }
            matieres[nomMatiere].notes.push({
                valeur: note.valeur,
                coefficient: note.coefficient
            })
        })
        return Object.values(matieres)
    } catch (err) {
        console.log('erreur au niveau du utils:', err)
        throw err
    }
}

//recuperation des notes des matieres 
const getNotesClasseByMatiere = async (
    idClasse,
    id_matiere,
    id_trimestre
) => {
    try {
        const classe = await prisma.classe.findUnique({
            where: { id: Number(idClasse) },
            select: { idEtablissement: true }
        });
        if (!classe) {
            throw new Error("Classe introuvable");
        }

        const annee = await getActiveSchoolYear(classe.idEtablissement);

        if (!annee) {
            throw new Error("Aucune année académique active trouvée");
        }

        const inscriptions = await prisma.inscription.findMany({
            where: {
                id_classe: Number(idClasse),
                id_annee_academique: annee.id
            },
            include: {
                eleve: {
                    select: {
                        matricule: true,
                        nom: true,
                        prenom: true
                    }
                },
                notes: {
                    where: {
                        id_matiere: Number(id_matiere),
                        id_trimestre: id_trimestre
                    },
                    include: {
                        matiere: {
                            include: {
                                affectations:true
                            }
                        }
                    }
                }
            }
        });

        return inscriptions.map(inscription => {
            const premiereNote = inscription.notes[0];
            return {
                matricule: inscription.eleve.matricule,
                nom: inscription.eleve.nom,
                prenom: inscription.eleve.prenom,
                matiere: premiereNote?.matiere?.nom || null,
                coefficient_matiere:
                    premiereNote?.matiere?.affectations?.[0]?.coefficient || null,
                notes: inscription.notes.map(note => ({
                    valeur: note.valeur,
                    coefficient: note.coefficient
                }))
            };
        });
    } catch (err) {
        console.error("Erreur dans getNoteFunctionByMatiere :", err);
        throw err;
    }
};

//recupere les moyennes des matieres d'un eleve
const calculerMoyenne = async (id, id_trimestre=null) => {
    // console.log('id trimestre fonction calculer moyenne', id_trimestre)
    const matieres = await getNoteFunction(id,id_trimestre)
    return matieres.map(m => {
        // Moyenne par matière non arrondie : le double appel ci-dessous
        // recalcule la même valeur pour rester cohérent avec l'appréciation.
        const moyenneMatiere = moyenne(m.notes, { round: false })
        return {
            matiere: m.matiere,
            coefficient: m.coefficient_matiere,
            moyenne: moyenneMatiere,
            appreciation: getMention(moyenneMatiere)
        }
    })
}

// calcule du rang 
const getRang = async (matricule, idClasse)=>{
    const moyennesEleves = []
    try{
        const listeEleves = await listeElevesRequest(idClasse)
        for(let eleve of listeEleves){
            const matricule = eleve.matricule
            const eleveMoy = await calculerMoyenne(matricule)
            moyennesEleves.push({
                matricule:eleve.matricule,
                nom:eleve.nom,
                prenom:eleve.prenom,
                moyenne: eleveMoy ? Number(moyenne(eleveMoy)) : 0
            })
        }
        if(!moyennesEleves){
            return null
        }
        moyennesEleves.sort((a,b)=> b.moyenne - a.moyenne)
        let rang = null
        for (let i=0; i<=moyennesEleves.length; i++){
            if(moyennesEleves[i].matricule == matricule){
                rang = i+1
                break;
            }
        }
        //console.log(rang)
        return rang
    }catch(err){
        return err
    }
}

const getRangParMatiere = async (matricule, idClasse) => {
    try {
        const listeEleves = await listeElevesRequest(idClasse)
        //Récupérer toutes les moyennes par matière pour chaque élève
        const toutesMoyennes = []
        for (let eleve of listeEleves) {
            const moyennes = await calculerMoyenne(eleve.matricule)
            toutesMoyennes.push({
                matricule: eleve.matricule,
                moyennes
            })
        }
        // Récupérer les matières depuis le premier élève
        const matieres = toutesMoyennes[0]?.moyennes || []
        const resultats = []
        // 3. Pour chaque matière → faire le classement
        for (let mat of matieres) {
            const classement = []
            for (let eleve of toutesMoyennes) {
                const matiereTrouvee = eleve.moyennes.find(m => m.matiere === mat.matiere)
                classement.push({
                    matricule: eleve.matricule,
                    moyenne: matiereTrouvee ? matiereTrouvee.moyenne : 0
                })
            }
            // Trier
            classement.sort((a, b) => b.moyenne - a.moyenne)
            // Trouver rang
            let rang = null
            for (let i = 0; i < classement.length; i++) {
                if (classement[i].matricule === matricule) {
                    rang = i + 1
                    break
                }
            }
            resultats.push({
                matiere: mat.matiere,
                rang
            })
        }
        return resultats
    } catch (err) {
        console.error(err)
        throw new Error("Erreur lors du calcul du rang par matière")
    }
}

// Calcule en une seule fois les moyennes de tous les élèves d'une classe.
// getRang/getRangParMatiere refont ce calcul indépendamment pour chaque
// élève (utile appelées isolément) ; quand on génère les bulletins de toute
// une classe, ça revient à recalculer N fois la même chose (O(N²) requêtes).
// getClassMoyennes + buildClassRanking permettent de ne le faire qu'une fois.
const getClassMoyennes = async (idClasse, id_trimestre = null) => {
    const listeEleves = await listeElevesRequest(idClasse)
    return Promise.all(
        listeEleves.map(async (eleve) => {
            const matieres = await calculerMoyenne(eleve.matricule, id_trimestre)
            return {
                matricule: eleve.matricule,
                nom: eleve.nom,
                prenom: eleve.prenom,
                matieres,
                moyenneGenerale: matieres.length ? Number(moyenne(matieres)) : 0
            }
        })
    )
}

// À partir des moyennes déjà calculées par getClassMoyennes, construit le
// rang global et le rang par matière de chaque élève — sans requête
// supplémentaire. Retourne { [matricule]: { rang, rangMatiere } }.
const buildClassRanking = (classMoyennes) => {
    const parMatricule = {}
    classMoyennes.forEach(e => { parMatricule[e.matricule] = { rang: null, rangMatiere: [] } })

    const classementGlobal = [...classMoyennes].sort((a, b) => b.moyenneGenerale - a.moyenneGenerale)
    classementGlobal.forEach((e, i) => { parMatricule[e.matricule].rang = i + 1 })

    const matieresVues = new Set()
    classMoyennes.forEach(e => e.matieres.forEach(m => matieresVues.add(m.matiere)))

    matieresVues.forEach(nomMatiere => {
        const classement = classMoyennes
            .map(e => ({
                matricule: e.matricule,
                moyenne: e.matieres.find(m => m.matiere === nomMatiere)?.moyenne ?? 0
            }))
            .sort((a, b) => b.moyenne - a.moyenne)
        classement.forEach((c, i) => {
            parMatricule[c.matricule].rangMatiere.push({ matiere: nomMatiere, rang: i + 1 })
        })
    })

    return parMatricule
}

// moyenne de la classe
const moyClasse = async (id, id_trimestre=null) => {
    try {
        // console.log('id trimestre fonction moyClaas', id_trimestre)
        const classe = await prisma.classe.findUnique({
            where: { id: Number(id) },
            select: { idEtablissement: true }
        })
        if (!classe) {
            throw new Error("Classe introuvable")
        }
        const annee = await getActiveSchoolYear(classe.idEtablissement)
        if (!annee) {
            throw new Error("Aucune année académique active")
        }
        const eleves = await prisma.inscription.findMany({
            where :{
                classe:{
                    id:Number(id)
                },
                id_annee_academique:annee.id
            }
        })
        
        let sum = 0
        for(let eleve of eleves){
            const moyenneMatieres = await calculerMoyenne(eleve.matricule_eleve, id_trimestre)
            const moyenneEleve = moyenne(moyenneMatieres)
            if(moyenneEleve){
                sum += moyenneEleve 
            }
        }
        
        const moyenneClasses = parseFloat((sum/eleves.length).toFixed(2))
        return moyenneClasses
    }catch(err){
        console.log("erreur au niveau de la fonction de recuperation de la moyenne",err)
    }
}

// information du bulletin
// `precalcule` (optionnel) : { matieres, moyenneGenerale, rang, rangMatiere }
// déjà calculés pour toute la classe par getClassMoyennes/buildClassRanking
// (voir generateClasseBulletins) — évite de refaire ces calculs pour chaque
// élève quand on génère les bulletins d'une classe entière.
const getBulletinInformation = async (matricule, precalcule = null)=>{
    try{
        const eleve = await getActiveInscriptionForEleve(matricule, {
            classe: {
                select: {
                    id: true,
                    libelle: true,
                    idEtablissement: true
                }
            }
        })
        if (!eleve) {
            throw new Error("Aucune inscription pour l'année académique active")
        }
        const idEtablissement = eleve.classe?.idEtablissement
        const etablissement = await prisma.etablissement.findUnique({
            where : {
                id:idEtablissement
            }
        })
        const enseignants = await prisma.affectation.findMany({
            where:{
                classeId:eleve.classe.id
            },
            include:{
                compteInstitutionnel:{
                    select: {
                        id:true,
                        user : {
                            select : {
                                enseignant : true
                            }
                        }
                    }
                }
            }
        })
        console.log('enseignants:',enseignants)
        // enseignants.map(ens=>{ens.enseignant.})
        const matieres = precalcule?.matieres ?? await calculerMoyenne(matricule)
        const matiereAvecProf = await Promise.all(
                matieres.map(async (m) => {
                const matiereId = await prisma.matiere.findUnique({
                    where: { nom_etablissement_id:{
                        nom: m.matiere, etablissement_id:etablissement.id 
                    }},
                    select: { id: true }
                })
                if (!matiereId) {
                    // Si la matière n'existe pas, on retourne juste la matière sans prof
                    return { ...m, professeur: "Non attribué" };
                }
                const enseignant = await prisma.affectation.findFirst({
                    where:{
                        classeId:eleve.classe.id,
                        matiereId:matiereId.id
                    },
                    include:{
                        compteInstitutionnel:{
                            select: {
                                id:true,
                                user : {
                                    select : {
                                        enseignant : true
                                    }
                                }
                            }
                        }
                    }
                })
                return {
                    ...m,
                    professeur: enseignant ? `${enseignant.compteInstitutionnel?.user.enseignant.nom} ${enseignant.compteInstitutionnel?.user.enseignant.prenom}` : "Non attribué"
                }
            })
        )
        const moyenneGenerale = precalcule?.moyenneGenerale ?? moyenne(matieres)
        const rang = precalcule ? precalcule.rang : await getRang(matricule, eleve.classe.id)
        const rangMatiere = precalcule ? precalcule.rangMatiere : await getRangParMatiere(matricule, eleve.classe.id)

        const signature = await prisma.signature.findFirst({
            where:{
                compteInstitutionnel:{
                    user:{
                        admin :{
                            etablissement : {
                                id:etablissement.id
                            }
                        }
                    }
                }
            }
        })
        // const matieres = await calculerMoyenne(matricule)

        if (!matieres.length) {
            return { 
                eleveInfo: eleve,
                matiere: [],
                moyenneGenerale: 0,
                rang: null,
                etablissement,
                enseignants,
                rangMatiere: [],
                // signature:signature.url
            }
        }
        return{
            eleveInfo:eleve,
            matiere:Object.values(matiereAvecProf),
            moyenneGenerale:moyenneGenerale,
            rang:rang,
            etablissement:etablissement,
            enseignants:enseignants,
            rangMatiere: rangMatiere,
            signature:signature.url
        }
    }catch(err){
        console.log(err)
    }
}

// recuperer les eleves bon et mauvais   recuperer les nombre d'eleve faible de chaque classe 
const moyenneElevesEtablissement = async (admin_id, type) => {
    try {
        const etablissement = await prisma.etablissement.findUnique({
            where: { admin_id: admin_id }
        })

        if (!etablissement) {
            return []
        }

        const annee = await getActiveSchoolYear(etablissement.id)
        if (!annee) {
            return []
        }

        const eleves = await prisma.inscription.findMany({
            where: {
                id_annee_academique: annee.id,
                classe: {
                    idEtablissement: etablissement.id
                }
            },
            include: {
                eleve: true,
                classe: {
                    select: {
                        libelle: true
                    }
                }
            }
        })

        const moyennes = await Promise.all(
            eleves.map(async (eleve) => {
                const moyenneMatieres = await calculerMoyenne(eleve.matricule_eleve)

                const moyenneGenerale = moyenneMatieres.length
                    ? moyenne(moyenneMatieres)
                    : 0
                return {
                    matricule: eleve.eleve.matricule,
                    nom: eleve.eleve.nom,
                    prenom: eleve.eleve.prenom,
                    classe: eleve.classe.libelle,
                    moyenne: moyenneGenerale
                }
            })
        )

        if (type === "faibles") {
            return moyennes.filter(m => m.moyenne < 10)
        } else {
            return moyennes.filter(m => m.moyenne >= 10)
        }

    } catch (err) {
        console.log("ERREUR MOYENNE:", err)
        return []
    }
}


// recuperer le nombre d'eleve faibles par classe 
const NombreEleveFaiblesClasse = async (admin_id)=>{
    try {
        const etablissement = await prisma.etablissement.findUnique({
            where: { admin_id: admin_id }
        })

        if (!etablissement) {
            return []
        }

        const annee = await getActiveSchoolYear(etablissement.id)
        if (!annee) {
            return []
        }

        const eleves = await prisma.inscription.findMany({
            where: {
                id_annee_academique: annee.id,
                classe: {
                    idEtablissement: etablissement.id
                }
            },
            include: {
                eleve: true,
                classe: {
                    select: {
                        libelle: true
                    }
                }
            }
        })
        const moyennes = await Promise.all(
            eleves.map(async (eleve) => {
                const moyenneMatieres = await calculerMoyenne(eleve.matricule_eleve)

                const moyenneGenerale = moyenneMatieres.length
                    ? moyenne(moyenneMatieres)
                    : 0
                return {
                    matricule: eleve.eleve.matricule,
                    nom: eleve.eleve.nom,
                    prenom: eleve.eleve.prenom,
                    classe: eleve.classe.libelle,
                    moyenne: moyenneGenerale
                }
            })
        )
        const faibleByClasse = moyennes.reduce((acc, eleve)=>{
            if(eleve.moyenne < 10){
                const classeExistante = acc.find(item => item.classe === eleve.classe)
                if(classeExistante){
                    classeExistante.nombre++  //nombre d'eleve faible
                }else{
                    acc.push({
                        classe: eleve.classe,
                        nombre: 1 //nombre d'eleve faible
                    })
                }
            }
            return acc
        }, [])
        return faibleByClasse
    }catch(err){
        console.log("ERREUR MOYENNE:", err)
        return []
    }
}

// recuperer le nombre d'eleve forts par classe 
const NombreEleveFortsClasse = async (admin_id)=>{
    try {
        const etablissement = await prisma.etablissement.findUnique({
            where: { admin_id: admin_id }
        })

        if (!etablissement) {
            return []
        }

        const annee = await getActiveSchoolYear(etablissement.id)
        if (!annee) {
            return []
        }

        const eleves = await prisma.inscription.findMany({
            where: {
                id_annee_academique: annee.id,
                classe: {
                    idEtablissement: etablissement.id
                }
            },
            include: {
                eleve: true,
                classe: {
                    select: {
                        libelle: true
                    }
                }
            }
        })
        const moyennes = await Promise.all(
            eleves.map(async (eleve) => {
                const moyenneMatieres = await calculerMoyenne(eleve.matricule_eleve)

                const moyenneGenerale = moyenneMatieres.length
                    ? moyenne(moyenneMatieres)
                    : 0
                return {
                    matricule: eleve.eleve.matricule,
                    nom: eleve.eleve.nom,
                    prenom: eleve.eleve.prenom,
                    classe: eleve.classe.libelle,
                    moyenne: moyenneGenerale
                }
            })
        )
        const faibleByClasse = moyennes.reduce((acc, eleve)=>{
            if(eleve.moyenne >= 10){
                const classeExistante = acc.find(item => item.classe === eleve.classe)
                if(classeExistante){
                    classeExistante.nombre++  //nombre d'eleve fort
                }else{
                    acc.push({
                        classe: eleve.classe,
                        nombre: 1   //nombre d'eleve fort
                    })
                }
            }
            return acc
        }, [])
        return faibleByClasse
    }catch(err){
        console.log("ERREUR MOYENNE:", err)
        return []
    }
}

const moyenneEtablissement = async(admin_id)=>{
    try{
        const etablissement = await prisma.etablissement.findUnique({
            where : {admin_id :admin_id}
        })
        if(!etablissement){
            return null
        }
        const annee = await getActiveSchoolYear(etablissement.id)
        if(!annee){
            return 0
        }
        const trimestre = await getActiveTerm(etablissement.id, annee.id)
        if(!trimestre){
            return 0
        }
        const eleves = await prisma.inscription.findMany({
            where :{
                id_annee_academique:annee.id,
                classe:{
                    idEtablissement:etablissement.id
                }
            },
            include : {
                eleve:true,
                classe:{
                    select:{
                        libelle:true
                    }
                }
            }
        })

        const moyennesEleves = await Promise.all(
            eleves.map(async (eleve) =>{
                const moyenneMatieres = await calculerMoyenne(eleve.matricule_eleve)
                const moyenneGenerale = moyenne(moyenneMatieres)
                console.log("moyenneGenerale", moyenneGenerale)
                return {
                    moyenneGenerale: moyenneGenerale
                }
            })
        )
        const moyenneEtablissement = moyenneE(moyennesEleves)
        return {
            moyenneEtablissement,
            trimestre:trimestre.libelle
        }
    }catch(err){
        console.log(err)
        return err
    }
}


const meilleureByClasse = async (idClasse)=>{
    try {
        // listeElevesRequest scope déjà les élèves sur la classe ET
        // l'année académique active de l'établissement de cette classe
        // (sans quoi on récupérerait aussi les élèves d'années antérieures
        // ayant occupé cette même classe).
        const eleves = await listeElevesRequest(idClasse)
        let elevesWithMoy = []
        for(let eleve of eleves){
            const moyenneMatieres = await calculerMoyenne(eleve.matricule)
            const moyenneEleve = moyenne(moyenneMatieres)
            if(moyenneEleve >=10){
                elevesWithMoy.push({
                    nom:eleve.nom,
                    prenom:eleve.prenom,
                    moyenne:moyenneEleve
                })
            }
        }
        return elevesWithMoy
    }catch(err){
        return err
    }
}

const mauvaisByClasse = async (idClasse)=>{
    try {
        const eleves = await listeElevesRequest(idClasse)
        let elevesWithMoy = []
        for(let eleve of eleves){
            const moyenneMatieres = await calculerMoyenne(eleve.matricule)
            const moyenneEleve = moyenne(moyenneMatieres)
            if(moyenneEleve < 10){
                elevesWithMoy.push({
                    nom:eleve.nom,
                    prenom:eleve.prenom,
                    moyenne:moyenneEleve
                })
            }
        }
        return elevesWithMoy
    }catch(err){
        return err
    }
}


const top1classeAndBad1 = async (idClasse, id_trimestre) => {
    try{
        const eleves = await listeElevesRequest(idClasse)
        if(!eleves){
            return null
        }
        const elevesWithMoy = await Promise.all(
            eleves.map( async (eleve)=>{
                const moyenneMatieres = await calculerMoyenne(eleve.matricule, id_trimestre)
                const moyenneEleve = moyenne(moyenneMatieres)
                if(!moyenneMatieres.length){
                    return null
                }
                return {
                        nom:eleve.nom,
                        prenom:eleve.prenom,
                        moyenne:moyenneEleve 
                }
            })
        )
        let maxMoy = elevesWithMoy[0]
        let nombreElevesFort = 0
        let minMoy = elevesWithMoy[0]
        let nombreElevesFaible = 0
        elevesWithMoy.map((eleve)=>{
            if(eleve.moyenne > maxMoy.moyenne){
                maxMoy = eleve
            }
            if(eleve.moyenne < minMoy){
                minMoy = eleve
            }

            eleve.moyenne >= 10 ? nombreElevesFort++ : nombreElevesFaible++
        })
        if (
            maxMoy.nom === minMoy.nom &&
            maxMoy.prenom === minMoy.prenom
        ) {
            return {
                meilleure: maxMoy.moyenne >= 10 ? maxMoy : null,
                mauvaise: maxMoy.moyenne < 10 ? maxMoy : null,
                fort: nombreElevesFort,
                faible: nombreElevesFaible
            };
        }
        return {
                meilleure: maxMoy.moyenne >= 10 ? maxMoy : null,
                mauvaise: maxMoy.moyenne < 10 ? maxMoy : null,
                fort: nombreElevesFort,
                faible: nombreElevesFaible
        };
    }catch(err){
        return err
    }
}

module.exports = {
    calculerMoyenne,
    listeElevesRequest,
    moyenne,
    getBulletinInformation,
    getRang,
    getClassMoyennes,
    buildClassRanking,
    getMention,
    getNotesClasseByMatiere,
    moyClasse,
    moyenneElevesEtablissement,
    moyenneEtablissement,
    meilleureByClasse, 
    NombreEleveFaiblesClasse,
    NombreEleveFortsClasse,
    mauvaisByClasse,
    top1classeAndBad1
}