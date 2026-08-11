const {prisma} = require('../lib/prisma')
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
        const annee = await prisma.anneeAcademique.findFirst({
            where: { actif: true }
        });
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
const moyenne = (tab) => {
    if (!tab || tab.length === 0) return 0;
    let total = 0;
    let totalCoef = 0;

    tab.forEach(t => {
        // On vérifie explicitement != null pour accepter 0
        const val = t.valeur != null ? t.valeur : t.moyenne;
        total     += val * t.coefficient;
        totalCoef += t.coefficient;
    });

    return parseFloat((total / totalCoef).toFixed(2));
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
        if(id_trimestre){
            const annee = await prisma.anneeAcademique.findFirst({where:{actif:true}})
            const eleve = await prisma.eleve.findUnique({
                where: { matricule: id },
                include: {
                    inscriptions: {
                        where: {
                            id_annee_academique: annee.id
                        },
                        include: {
                            notes: {
                                where: {
                                    id_trimestre: id_trimestre
                                },
                                select: {
                                    valeur: true,
                                    coefficient: true,
                                    matiere: {
                                        select: {
                                            nom: true,
                                            affectations:true
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            })
            // élève introuvable
            if (!eleve) {
                throw new Error("élève introuvable")
            }
            if (!eleve.inscriptions.length) {
                return []
            }
            const inscription = eleve.inscriptions[0]
            // aucune note
            if (!eleve.inscriptions.length || !eleve.inscriptions[0].notes.length) {
                return []
            }
            inscription.notes.forEach(note => {
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
        }else {
            const trimestre = await prisma.trimestre.findFirst({
                where: { actif: true }
            })
            if(!trimestre) {
                return []
            }
            const annee = await prisma.anneeAcademique.findFirst({where:{actif:true}})
            const eleve = await prisma.eleve.findUnique({
                where: { matricule: id },
                include: {
                    inscriptions: {
                        where: {
                            id_annee_academique: annee.id
                        },
                        include: {
                            notes: {
                                where: {
                                    id_trimestre: trimestre.id_trimestre
                                },
                                select: {
                                    valeur: true,
                                    coefficient: true,
                                    matiere: {
                                        select: {
                                            nom: true,
                                            affectations:true
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            })
            // élève introuvable
            if (!eleve) {
                throw new Error("élève introuvable")
            }
            if (!eleve.inscriptions.length) {
                return []
            }
            const inscription = eleve.inscriptions[0]
            // aucune note
            if (!eleve.inscriptions.length || !eleve.inscriptions[0].notes.length) {
                return []
            }
            inscription.notes.forEach(note => {
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
        }
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
        const annee = await prisma.anneeAcademique.findFirst({
            where: { actif: true }
        });

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
    return matieres.map(m => ({
        matiere: m.matiere,
        coefficient: m.coefficient_matiere,
        moyenne: Number(moyenne(m.notes, id)),
        appreciation: getMention(moyenne(m.notes,id))
    }))
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

// moyenne de la classe 
const moyClasse = async (id, id_trimestre=null) => {
    try {
        // console.log('id trimestre fonction moyClaas', id_trimestre)
        const annee = await prisma.anneeAcademique.findFirst({where:{actif:true}})
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
const getBulletinInformation = async (matricule)=>{
    try{
        const annee = await prisma.anneeAcademique.findFirst({where:{actif:true}})
        const eleve = await prisma.inscription.findFirst({
            where :{
                matricule_eleve:matricule,
                id_annee_academique:annee.id
            },
            include :{
                eleve:true,
                classe:{
                    select :{
                        id:true,
                        libelle:true,
                        idEtablissement:true
                    }
                }
            }
        })
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
        const matieres = await calculerMoyenne(matricule)
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
        const moyenneGenerale = moyenne(matieres)
        const rang = await getRang(matricule, eleve.classe.id)
        const rangMatiere = await getRangParMatiere(matricule, eleve.classe.id)

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

        const annee = await prisma.anneeAcademique.findFirst({
            where: { actif: true }
        })

        if (!etablissement) {
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

        const annee = await prisma.anneeAcademique.findFirst({
            where: { actif: true }
        })

        if (!etablissement) {
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

        const annee = await prisma.anneeAcademique.findFirst({
            where: { actif: true }
        })

        if (!etablissement) {
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
        const trimestre = await prisma.trimestre.findFirst({where:{actif:true}})
        if(!etablissement){
            return null
        }
        if(!trimestre){
            return 0
        }
        const annee = await prisma.anneeAcademique.findFirst({where:{actif:true}})
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
        const eleves = await prisma.inscription.findMany({
            where :{
                classe:{
                    id:Number(idClasse)
                }
            },
            include : {
                eleve:true,
            }
        })
        let elevesWithMoy = []
        for(let eleve of eleves){
            const moyenneMatieres = await calculerMoyenne(eleve.matricule_eleve)
            const moyenneEleve = moyenne(moyenneMatieres)
            if(moyenneEleve >=10){
                elevesWithMoy.push({
                    nom:eleve.eleve.nom,
                    prenom:eleve.eleve.prenom,
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
        const eleves = await prisma.inscription.findMany({
            where :{
                classe:{
                    id:Number(idClasse)
                }
            },
            include : {
                eleve:true,
            }
        })
        let elevesWithMoy = []
        for(let eleve of eleves){
            const moyenneMatieres = await calculerMoyenne(eleve.matricule_eleve)
            const moyenneEleve = moyenne(moyenneMatieres)
            if(moyenneEleve < 10){
                elevesWithMoy.push({
                    nom:eleve.eleve.nom,
                    prenom:eleve.eleve.prenom,
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