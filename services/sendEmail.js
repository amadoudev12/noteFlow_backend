const transporter = require('../lib/transporter');

transporter.verify((error, success) => {
    if (error) {
        console.error("Erreur transporter :", error);
    } else {
        console.log("Serveur email prêt");
    }
});


const sendEmail = async (nom, email, identifiant, motDePasse, role) => {

    const loginUrl = "https://tonsite.com/login";

    const htmlMessage = `
    <div style="font-family:Arial, sans-serif;background:#f1f5f9;padding:30px;">

        <div style="
            max-width:600px;
            margin:auto;
            background:white;
            border-radius:12px;
            overflow:hidden;
            box-shadow:0 4px 15px rgba(0,0,0,0.08);
        ">

            <!-- HEADER -->
            <div style="
                background:#2563eb;
                padding:25px;
                text-align:center;
                color:white;
            ">
                <h2 style="margin:0;">
                    NoteFlow
                </h2>

                <p style="margin-top:8px;">
                    Plateforme de gestion scolaire
                </p>
            </div>


            <!-- BODY -->
            <div style="padding:30px;">

                <h3 style="color:#1e293b;">
                    Bonjour ${nom},
                </h3>


                <p style="
                    color:#475569;
                    line-height:1.6;
                ">
                    Votre compte a été créé avec succès sur la plateforme
                    <strong>NoteFlow</strong>.
                    Vous pouvez maintenant accéder à votre espace personnel
                    avec les informations suivantes :
                </p>


                <!-- ROLE -->

                <div style="
                    background:#eff6ff;
                    border-radius:8px;
                    padding:15px;
                    margin:20px 0;
                    color:#1e40af;
                ">
                    <strong>Type de compte :</strong> ${role}
                </div>



                <!-- IDENTIFIANTS -->

                <div style="
                    background:#f8fafc;
                    border:1px solid #e2e8f0;
                    border-radius:10px;
                    padding:20px;
                    margin:25px 0;
                ">

                    <p style="margin:0 0 10px;">
                        <strong>Identifiant :</strong>
                        ${identifiant}
                    </p>


                    <p style="margin:0;">
                        <strong>Mot de passe temporaire :</strong>
                        ${motDePasse}
                    </p>

                </div>



                <!-- BUTTON -->

                <div style="
                    text-align:center;
                    margin:30px 0;
                ">

                    <a href="${loginUrl}" 
                    style="
                        background:#2563eb;
                        color:white;
                        padding:14px 26px;
                        text-decoration:none;
                        border-radius:8px;
                        font-weight:bold;
                        display:inline-block;
                    ">
                        Se connecter
                    </a>

                </div>



                <p style="
                    color:#64748b;
                    font-size:14px;
                    line-height:1.6;
                ">
                    ⚠️ Lors de votre première connexion, vous devrez modifier
                    votre mot de passe pour sécuriser votre compte.
                </p>


            </div>



            <!-- FOOTER -->

            <div style="
                background:#f8fafc;
                padding:15px;
                text-align:center;
                font-size:12px;
                color:#94a3b8;
            ">

                © 2026 NoteFlow - Tous droits réservés

            </div>


        </div>

    </div>
    `;


    try {

        const info = await transporter.sendMail({

            from: process.env.EMAIL_USER,

            to: email,

            subject: "Création de votre compte NoteFlow",

            html: htmlMessage

        });


        console.log("Email envoyé :", info.messageId);


    } catch(error){

        console.error(
            "Erreur lors de l'envoi de l'email :",
            error
        );

    }

};


module.exports = sendEmail;