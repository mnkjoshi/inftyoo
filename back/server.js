import express from 'express';
import sgMail from '@sendgrid/mail'
import dotenv from 'dotenv'

import admin from "firebase-admin";

import adminCert from "./etc/secrets/tgh-firebase-rd-cert.json" assert { type: "json" }

const firebaseConfig = {
    credential: admin.credential.cert(adminCert),
    databaseURL: "https://the-golden-hind-default-rtdb.firebaseio.com/",
};

const app = express();

const firebaseApp = admin.initializeApp(firebaseConfig)

app.use(express.json());
app.use(express.urlencoded({ extended: true}));

dotenv.config();
const mailAPIkey = process.env.mailAPIkey
sgMail.setApiKey('SG.' + mailAPIkey)

app.get('/', (request, response) => {
    response.status(200);
    response.send("Yarrr! Ahoy there, matey!");
});

app.post('/login', async (request, response) => {
    const { username, password } = request.body
    
    try {
        const authenticated = await AttemptAuth(username, password);
        if (authenticated) {
            const token = await FetchUserToken(request.body.username);
            if (token.substr(1, 11) == "validation=") {
                response.status(401);
                response.send("User needs to verify.")
                OfferVerify(username, token)
            }
            
            if (token) {
                response.status(200);
                response.send({ username,  token });
            } else {
                response.status(401);
                response.send("No token exists, user needs to verify.");
            }
        } else {
            response.status(401);
            response.send("Incorrect login details.");
        }
    } catch(error) {
        response.status(500);
        response.send(error.message);
         try {
        const authenticated = await AttemptAuth(username, password);
        if (authenticated) {
            const token = await FetchUserToken(request.body.username);
            
            if (token) {
                response.status(200);
                response.send({ username,  token });
            } else {
                response.status(401);
                response.send("No token exists, user needs to verify.");
            }
        } else {
            response.status(401);
            response.send("Incorrect login details.");
        }
    } catch(error) {
        response.status(500);
        response.send(error.message);
    }
    }
});

app.post('/register', async (request, response) => {
    const { username, password, email } = request.body

    try { //Check if username is taken!

        const Existence = await CheckUser(username, email);

        if (Existence === 1) {
            response.status(500);
            response.send("Username");
        } else if (Existence === 2) {
            response.status(500);
            response.send("Email");
        }
    } catch(error) {
        response.status(500);
        response.send(error);
    }

    try { //Try registering the user!
        const worked = await Register(username, password, email)
    } catch (error) {
        response.status(500);
        response.send("Err")
    }
    response.status(200);
        response.send("User successfully created!")
});

app.post('/verify', async (request, response) => {
    const { token } = request.body
    const db = admin.database();
    const newToken = GenerateToken();

    db.ref(`vlist/${token}`).set({ user: null })
    db.ref(`users/${username}`).update({ token: newToken })

    response.status(200);
    response.send("Verification successful!");
});



//process.env.PORT
const listener = app.listen(3000, (error) => {
    if (error == null) {
        console.log("Server now running on port " + listener.address().port)
        console.log("http://localhost:" + listener.address().port)
    } else {
        console.log(error)
    }
});

async function AttemptAuth(username, password) {
    const db = admin.database();

    try {
            
        const snapshot = await db.ref(`users/${username}/password`).once('value');
        if (snapshot.exists()) {
            const storedPassword = snapshot.val();
            return storedPassword === password;
        } else {
            return false;
        }
    } catch (error) {
        console.error("Error while authenticating the user: ", error);
        return false;
    }
}
async function FetchUserToken(User) {
    const db = admin.database();

    try {
        const DataSnapshot = await db.ref(`users/${username}/token`).once('value');
        if (DataSnapshot.exists()) {
            return DataSnapshot.val();
        } else {
            return null
        }
    } catch (error) {
        console.log("Error found while fetching user token: " + error)
    }
    return token
}

async function Register(username, password, email) {
    const db = admin.database();
    const newToken = "validation=" + GenerateToken()
    try {

        db.ref(`users/${username}`).set({ 
            password: password,
            email: email,
            favourites: {1: "Placeholder"},
            token: newToken,
        })

        email = email.replace(".", "@@@")

        db.ref(`emails/${email}`).set({ 
            user: username,
        })

        db.ref(`vlist/${newToken}`).set({ 
            user: username,
        })
    } catch (error) {
        return error
    }

    await OfferVerify(username, newToken, email)
    return 0
}

async function CheckUser(username, email) {
    const db = admin.database();

    const UserSnaphot = await db.ref(`users/${username}`).once('value');
    if (UserSnaphot.exists()) {
        return 1
    }

    email = email.replace(".", "@@@")
    const EmailSnapshot = await db.ref(`emails/${email}`).once('value');
    if (EmailSnapshot.exists()) {
        return 2
    }

    return 0
}

async function OfferVerify(username, token, email) {
    if (email == null) {
        const db = ref(getDatabase());
        const EmailSnapshot = await db.ref(`users/${username}/email`).once('value');
        email = EmailSnapshot.val();
    }

    email = email.replace("@@@", ".")

    let link = "https://tgh.com/verify/" + token
    const msg = {
        to: email, // Change to your recipient
        from: 'disvelop@proton.me', // Change to your verified sender
        subject: 'TGH Verification',
        html: `<html> <head> <title>EMAIL</title> </head> <body> <div> <h1 style="text-align:center;">Welcome to TGH</h1> <hr> <p style= "text-align:center;">Click the link below to verify your account.</p> <a clicktracking=off href="${link}" style="text-align:center; align-self:center;">${link}</a> </div> </body> </html>`,
    }

    sgMail
    .send(msg)
    .then(() => {
      console.log('Email verification sent!')
    })
    .catch((error) => {
        console.log("VerE")
      console.error(error)
    })
}

function GenerateToken() {
    return Math.random().toString(36).substr(2) + Math.random().toString(36).substr(2);
}