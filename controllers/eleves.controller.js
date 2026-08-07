const {prisma} = require('../lib/prisma')
const bcrypt = require('bcrypt')
const { calculerMoyenne, getRang } = require('../utils/util')
const { generate } = require('../utils/generate')
const xlsx = require('xlsx')
const supabase = require('../lib/supabaseClient')
const sendEmail = require('../services/sendEmail')
const generateCertificat = require('../utils/generateCertificat')

const createEleveController = async (req, res) => {
    const {classe} = req.body;

    if (!req.file) {
        return res.status(404).json("aucun fichier n'a été sélectionné");
    }

    if (!classe) {
        return res.status(404).json("aucune classe sélectionnée");
    }
    const idEtablissement = req.user.profil.etablissement.id
    try {
        const etablissement = await prisma.etablissement.findUnique({where:{id:idEtablissement}})
        const annee = await prisma.anneeAcademique.findFirst({where:{actif:true}})
        const filename = req.file.filename
        const wb = xlsx.readFile(`./uploads/imports/${filename}`)
        const sheetName = wb.SheetNames[0]
        const sheet = wb.Sheets[sheetName]
        const eleves = xlsx.utils.sheet_to_json(sheet)
        for (let row of eleves) {
            const prenomSanitized = row.prenom
                .toLowerCase()
                .trim()
                .normalize("NFD")
                .replace(/\s+/g, "")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/[^a-z0-9]/g, "")
            const etabSanitized = etablissement.nom
                .toLowerCase()
                .trim()
                .normalize("NFD")
                .replace(/\s+/g, "")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/[^a-z0-9]/g, "")
            const login = `${prenomSanitized}@${etabSanitized}.edu`
            const hashPass = await bcrypt.hash(login, 10);
            let eleve = await prisma.eleve.findUnique({
                where : {
                    matricule:row.matricule
                }
            })
            if (!eleve) {
                const user = await prisma.user.create({
                    data: {
                        role: "ELEVE"
                    }
                })
                eleve = await prisma.eleve.create({
                    data: {
                        matricule: row.matricule,
                        nom: row.nom,
                        prenom: row.prenom,
                        email:row.email,
                        dateNaissance: row.dateNaissance
                            ? new Date(row.dateNaissance)
                            : null,
                        lieuNaissance: row.lieuNaissance || null,
                        sexe: row.sexe,
                        affecte:row.affecte,
                        boursier:row.boursier,
                        redoublant:row.redoublant,
                        nationalite:row.nationalite,
                        userId: user.id
                    }
                })
                //INSCRIPTION 
                await prisma.inscription.create({
                    data: {
                        matricule_eleve: eleve.matricule,
                        id_classe: Number(classe),
                        id_annee_academique: Number(annee.id),
                        id_etablissement:idEtablissement
                    }
                })
                const compte = await prisma.compteInstitutionnel.create({
                    data : {
                        login:login,
                        mot_passe:hashPass,
                        user:{
                            connect:{
                                id:user.id
                            }
                        },
                        etablissement:{
                            connect:{
                                id:etablissement.id
                            }
                        }
                    }
                })
                await sendEmail(eleve.nom, eleve.email, compte.login, compte.login)
            }
        }
        return res.status(201).json({
            message: "les élèves ont été ajoutés avec succès ✅"
        });
    } catch (err) {
        console.log(err)
        return res.status(500).json({
            message: "erreur au niveau de la base de données"
        })
    }
}



const getAllElevesController = async (req, res)=>{
    try {
        const eleves = await prisma.eleve.findMany()
        return res.json({message:'liste des eleves:', eleves}).status(200)
    }catch(err){
        return res.json({message:'erreur', err}).status(505)
    }
}

const  getEleveByClasseController = async (req,res)=>{
    try{
        const eleves = await prisma.eleve.findMany({
            where : {idClasse:req.id}
        })
        if(!eleves){
            return res.status(404).json({message:"la classe n'existe pas"})
        }
        return res.status(200).json({message:"liste de la classe", eleves})
    }catch(err){
        console.log(err)
        return res.status(500).json({message:"erreur",err})
    }
}

const getEleveController = async (req,res)=>{
    const matricule = req.params.id
    if(!matricule){
        return res.status(400).json({message:'veuillez renseigner le matricule'})
    }
    try {
        const annee = await prisma.anneeAcademique.findFirst({where:{actif:true}})
        const eleve = await prisma.inscription.findUnique({
            where :{
                matricule_eleve_id_annee_academique :{
                    matricule_eleve:matricule,
                    id_annee_academique:annee.id
                },
            },
            include :{
                eleve:true,
                classe:{
                    select:{
                        libelle:true
                    }
                }
            }
        })
        if(!eleve){
            return res.status(404).json({message:"l'eleve n'existe pas !!"})
        }
        return res.status(201).json({eleveInformation:eleve})
    }catch(err){
        console.log(err)
        return res.status(500).json({message:"erreur",err})
    }
}

const moyennesController = async (req,res)=>{
    const id = req.params.id
    if(!id){
        return res.status(400).json({message:'veuillez renseigner le matricule'})
    }
    try{
        const moyenne = await calculerMoyenne(id)
        return res.status(201).json({message:'vos moyenne:', moyenne})
    }catch(err){
        console.log('erreur au  niveau du controller',err)
        return res.status(500).json({message:"erreur au nieveau du serveur",err})
    }
}

const EleveRang = async (req,res)=>{
    const matricule = req.user.profil.matricule
    // const idClasse = req.user.profil.idClasse
    try{
        const annee = await prisma.anneeAcademique.findFirst({where:{actif:true}})
        const idClasse = await prisma.inscription.findUnique({
            where :{
                matricule_eleve_id_annee_academique:{
                    matricule_eleve:matricule,
                    id_annee_academique:annee.id
                },
            },
            select:{
                id_classe:true
            }
        })
        const rang = await getRang(matricule, idClasse.id_classe)
        //console.log(rang)
        return res.status(200).json({rang})
    }catch(err){
        console.log(err)
        return res.status(500).json({message:'erreur:', err})
    }
}



const getBulletin = async (req, res) => {
    try {
        const { matricule, classe} = req.body
        const annee = await prisma.anneeAcademique.findFirst({
            where:{actif:true},
        })
        const trimestre = await prisma.trimestre.findFirst({
            where : {actif:true},
        })
        // const filePath = `${annee.libelle}/${trimestre.libelle}/${classe}/${matricule}.pdf`
        // console.log(filePath)
        // const { data, error } = await supabase.storage
        //     .from('bulletins')
        //     .createSignedUrl(filePath, 60) // lien valide 60 secondes
        // if (error) throw error
        // console.log(data.signedUrl)
        const bulletin = await prisma.bulletin.findUnique({
            where : {
                eleveId_idtrimestre_id_annee : {
                    eleveId:matricule,
                    idtrimestre:trimestre.id_trimestre,
                    id_annee:annee.id
                }
            }
        })
        return res.json({
            url: bulletin.fichier_url
        })
    } catch (err) {
        console.log(err)
        res.status(500).json({ message: "Erreur récupération bulletin" })
    }
}
const absenceController = async (req, res) => {
    const body = req.body
    const {config, absences}  = body
    if(!body){
        return res.status(400).json({message:'fournissez les donnés'})
    }
    try {
        for (let absence of absences) {
            await prisma.absence.create({
                data:{
                    nombre:absence.nombre,
                    justifiee:(absence.justifiee).toLowerCase(),
                    eleve : {
                        connect: {matricule:absence.matricule}
                    },
                    trimestre : {
                        connect: {id_trimestre:Number(config.trimestre)}
                    }
                }
            })
        }
        return res.status(201).json({message:"Absence enregistré"})
    }catch(err){
        console.log(err)
        return res.status(500).json({message:'erreur au niveau de la bd'})
    }
}

const createCertificat = async (req, res)=>{
    const matricule = req.user.profil.matricule
    try{
        const annee = await prisma.anneeAcademique.findFirst({
            where:{
                actif:true
            }
        })
        const inscription = await prisma.inscription.findUnique({
            where : {
                matricule_eleve_id_annee_academique : {
                    matricule_eleve:matricule,
                    id_annee_academique:annee.id
                }
            },
            include:{
                eleve:true,
                classe:{
                    select:{
                        libelle:true,
                        etablissement:true
                    }
                }
            }
        })
        const signature = await prisma.signature.findFirst({
            where:{
                compteInstitutionnel:{
                    user:{
                        admin :{
                            etablissement : {
                                id:inscription.classe.etablissement.id
                            }
                        }
                    }
                }
            }
        })
        if(!inscription){
            return res.status(404).json({message:"cet eleve n'est pas inscrit"})
        }
        let compteur = await prisma.compteurCertificat.findUnique({
            where:{
                annee_academique_id:annee.id
            }
        })
        if(!compteur){
            compteur = await prisma.compteurCertificat.create({
                data :{
                    annee_academique_id:annee.id,
                    compteur:0
                }
            })
        }
        const nouveauCompteur = compteur.compteur+1
        // generation du numero du certificat 
        const numeroCertificat = `CF-${annee.libelle}-${String(nouveauCompteur).padStart(4,'0')}`
        await prisma.compteurCertificat.update({
            where:{annee_academique_id:annee.id},
            data:{
                compteur:nouveauCompteur
            }
        })
        const certificat = await prisma.certificatFrequentation.create({
            data :{
                numero:numeroCertificat,
                eleve_id:matricule,
                annee_academique_id:annee.id
            }
        })
        const certificatFile = await generateCertificat(inscription.eleve, annee, certificat,
            inscription.classe, inscription.classe.etablissement, signature.url
        )
        return res.download(certificatFile, 'certificat de frequentation')
    }catch(err){
        console.log(err)
        return res.status(500).json({err})
    }
}

module.exports = {
    getAllElevesController,
    createEleveController,
    getEleveByClasseController,
    getEleveController,
    moyennesController,
    EleveRang,
    getBulletin,
    absenceController,
    createCertificat
}