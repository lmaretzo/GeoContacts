const express = require('express');
const path = require('path');
const db = require('./db');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const csrf = require('csurf');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const NodeGeocoder = require('node-geocoder');


const app = express();

const geocoderOptions = {
    provider: 'openstreetmap' // or 'google', 'bing', etc., depending on what you have access to
  };
  const geocoder = NodeGeocoder(geocoderOptions);
  

app.use((req, res, next) => {
    console.log('Session Cookie:', req.sessionID);
    if (req.sessionID) {
        console.log('Session User ID:', req.session.userId);
    }
    next();
});

app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: 'password', // I Hardcoded secret for testing purposes
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: false

    }
}));

app.use(cookieParser());
app.use(csrf({ cookie: true }));
const methodOverride = require('method-override');
app.use(methodOverride('_method'));   




app.use((req, res, next) => {
    console.log(`Middleware: anonymous function`);
    next();
});


function requireLogin(req, res, next) {
    console.log(`Session User ID: ${req.session.userId}`);

    if (req.session.userId) {
        next(); // If userId exists, proceed to the next middleware

    } 
    
    else {
        res.redirect('/login'); // If userId is undefined, redirect to the login page
    }
}

app.get('/', async (req, res) => {
    try {
        const contacts = await db.getAllContacts();
        res.render('index', { contacts, csrfToken: req.csrfToken(), user: req.session.userId });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error fetching contacts');
    }
});

app.get('/contact/:id', async (req, res) => {

    console.log("Requested contact ID:", req.params.id);

    try {
        const contact = await db.getContactById(req.params.id);
        console.log("Requested contact ID:", req.params.id);
        console.log("Retrieved contact:", contact);

        if (!contact) {
            return res.status(404).render('error', { error: 'Contact not found' });
        }

        res.render('contact', { contact, csrfToken: req.csrfToken(), user: req.session.userId });
    } catch (err) {
        console.error(err);
        res.status(500).render('error', { error: 'Error fetching contact' });
    }
});


// Route to display the edit page for a contact
app.get('/contact/:id/edit', async (req, res) => {
    try {
        const contact = await db.getContactById(req.params.id);
        if (!contact) {
            return res.status(404).render('error', { error: 'Contact not found' });
        }
        res.render('edit', { contact, csrfToken: req.csrfToken(), user: req.session.userId });
    } catch (err) {
        console.error('Error fetching contact for editing:', err);
        res.status(500).render('error', { error: 'Error fetching contact for editing' });
    }
});

app.post('/contact/:id/edit', async (req, res) => {
    console.log(req.body); // Log the body to see what's being passed

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).render('edit', {
            errors: errors.array(),
            contact: req.body,
            csrfToken: req.csrfToken(),
            user: req.session.userId
        });
    }

    try {
        const address = `${req.body.street}, ${req.body.city}, ${req.body.state}, ${req.body.zip}, ${req.body.country}`;
        console.log('Address for geocoding:', address); // Verify the address format

        const geocodeResult = await geocoder.geocode(address);
        if (geocodeResult.length) {
            req.body.lat = geocodeResult[0].latitude;
            req.body.lng = geocodeResult[0].longitude;
        } else {
            console.error('Geocoding failed, no results found for address:', address);
            return res.status(500).render('edit', {
                contact: req.body,
                error: 'Geocoding failed, no results found.',
                csrfToken: req.csrfToken(),
                user: req.session.userId
            });
        }

        await db.updateContact(req.params.id, req.body);
        res.redirect(`/contact/${req.params.id}`);
    } catch (err) {
        console.error('Error updating contact:', err);
        res.status(500).render('edit', {
            contact: req.body,
            error: 'Error updating contact. Please try again.',
            csrfToken: req.csrfToken(),
            user: req.session.userId
        });
    }
});

app.get('/login', (req, res) => {
    console.log('Request URL:', req.url);

    if (req.session.userId) {
        res.redirect('/'); // If already logged in, this redirects to the home page
    } else {

        res.render('login', { csrfToken: req.csrfToken() });
    }
});


app.get('/create', requireLogin, (req, res) => {
    res.render('create', {
        csrfToken: req.csrfToken(),
        user: req.session.userId
    });
});


app.post('/contact/:id/edit', [
body('firstName').trim().escape().notEmpty().withMessage('First Name is required.'),
body('lastName').trim().escape().notEmpty().withMessage('Last Name is required.'),
body('phoneNumber').trim().escape(),
body('emailAddress').trim().escape().isEmail().withMessage('Invalid email address.'),
body('street').trim().escape(),
body('city').trim().escape(),
body('state').trim().escape(),
body('zip').trim().escape(),
body('country').trim().escape(),
body('contactByEmail').toBoolean(),
body('contactByPhone').toBoolean()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).render('edit', {
            errors: errors.array(),
            contact: req.body,
            csrfToken: req.csrfToken(),
            user: req.session.userId
        });
    }

    try {
        const address = `${req.body.street}, ${req.body.city}, ${req.body.state}, ${req.body.zip}, ${req.body.country}`;
        const geocodeResult = await geocoder.geocode(address);
        if (geocodeResult.length) {
            req.body.lat = geocodeResult[0].latitude;
            req.body.lng = geocodeResult[0].longitude;
        } else {
            req.flash('errors', 'Failed to geocode address');
            return res.redirect('back');
        }

        await db.updateContact(
            req.params.id,
            req.body.firstName,
            req.body.lastName,
            req.body.phoneNumber,
            req.body.emailAddress,
            req.body.street,
            req.body.city,
            req.body.state,
            req.body.zip,
            req.body.country,
            req.body.contactByEmail ? 1 : 0,
            req.body.contactByPhone ? 1 : 0,
            req.body.lat,
            req.body.lng
        );

        res.redirect(`/contact/${req.params.id}`);
    } catch (err) {
        console.error(err);
        res.status(500).render('edit', {
            contact: req.body,
            error: 'Error updating contact. Please try again.',
            csrfToken: req.csrfToken(),
            user: req.session.userId
        });
    }
});



app.post('/contact/:id/edit', [

    body('firstName').trim().escape().notEmpty().withMessage('First Name is required.'),
    body('lastName').trim().escape().notEmpty().withMessage('Last Name is required.'),
    body('phoneNumber').trim().escape(),
    body('emailAddress').trim().escape().isEmail().withMessage('Invalid email address.'),
    body('street').trim().escape(),
    body('city').trim().escape(),
    body('state').trim().escape(),
    body('zip').trim().escape(),
    body('country').trim().escape(),
    body('contactByEmail').toBoolean(),
    body('contactByPhone').toBoolean()

], 

async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(422).render('edit', {
            errors: errors.array(),
            contact: req.body,
            csrfToken: req.csrfToken(),
            user: req.session.userId
        });
    }

    try {
        await db.updateContact(
            req.params.id,
            req.body.firstName,
            req.body.lastName,
            req.body.phoneNumber,
            req.body.emailAddress,
            req.body.street,
            req.body.city,
            req.body.state,
            req.body.zip,
            req.body.country,
            req.body.contactByEmail ? 1 : 0,
            req.body.contactByPhone ? 1 : 0
        );

        res.redirect(`/contact/${req.params.id}`);

    } catch (err) {

        console.error(err);

        res.status(500).render('edit', {
            contact: req.body,
            error: 'Error updating contact. Please try again.',

            csrfToken: req.csrfToken(),
            user: req.session.userId
        });
    }
});

app.post('/create', [
    body('firstName').trim().escape().notEmpty().withMessage('First Name is required.'),
    body('lastName').trim().escape().notEmpty().withMessage('Last Name is required.'),
    body('phoneNumber').trim().escape(),
    body('emailAddress').trim().escape().isEmail().withMessage('Invalid email address.'),
    body('street').trim().escape(),
    body('city').trim().escape(),
    body('state').trim().escape(),
    body('zip').trim().escape(),
    body('country').trim().escape(),
    body('contactByEmail').toBoolean(),
    body('contactByPhone').toBoolean()
], async (req, res) => {
    const errors = validationResult(req);

    console.log('req.body:', req.body); 


    if (!errors.isEmpty()) {
        return res.status(422).render('create', {
            errors: errors.array(),
            contact: req.body,
            csrfToken: req.csrfToken(),
            user: req.session.userId
        });
    }

    console.log('Inserting new contact:', req.body); 

    console.log('req.body:', req.body); // for debugging
    try {
        const address = `${req.body.street}, ${req.body.city}, ${req.body.state}, ${req.body.zip}, ${req.body.country}`;
        const geocodeResult = await geocoder.geocode(address);
        if (geocodeResult.length) {
            req.body.lat = geocodeResult[0].latitude;
            req.body.lng = geocodeResult[0].longitude;
        } else {
            throw new Error('Geocoding failed');
        }

        const newContactId = await db.addContact(req.body);
        res.redirect(`/contact/${newContactId}`);
    } catch (err) {
        console.error(err);
        res.status(500).render('error', { error: 'Error creating contact. Please try again.', csrfToken: req.csrfToken() });
    }
});

app.post('/:id/edit', [
    body('firstName').trim().escape().notEmpty().withMessage('First Name is required.'),
    body('lastName').trim().escape().notEmpty().withMessage('Last Name is required.'),
    body('phoneNumber').trim().escape(),
    body('emailAddress').trim().escape().isEmail().withMessage('Invalid email address.'),
    body('street').trim().escape(),
    body('city').trim().escape(),
    body('state').trim().escape(),
    body('zip').trim().escape(),
    body('country').trim().escape(),
    body('contactByEmail').toBoolean(),
    body('contactByPhone').toBoolean()


], async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.render('edit', {
            errors: errors.array(),
            contact: req.body
        });
    }

    try {
        await db.updateContact(
            req.params.id,
            req.body.firstName,
            req.body.lastName,
            req.body.phoneNumber,
            req.body.emailAddress,
            req.body.street,
            req.body.city,
            req.body.state,
            req.body.zip,
            req.body.country,
            req.body.contactByEmail ? 1 : 0,
            req.body.contactByPhone ? 1 : 0
        );

        res.redirect(`/${req.params.id}`);

    } catch (err) {
        console.error(err);
        res.render('edit', {
            contact: req.body,
            error: 'Error updating contact. Please try again.'
        });
    }
});

app.delete('/:id/delete', async (req, res) => {
    try {
        await db.deleteContact(req.params.id);
        res.redirect('/');
    } catch (err) {
        console.error(err);
        res.render('error', { error: 'Error deleting contact. Please try again.' });
    }
});

app.get('/login', (req, res) => {
    if (!req.session.userId) {
        res.render('login', { csrfToken: req.csrfToken() });
    } else {
        res.redirect('/');
    }
});

app.post('/login', async (req, res) => {
    try {
        const user = await db.checkUser(req.body.username, req.body.password);

        if (user) {
            req.session.userId = user.ID;
            res.redirect('/');
        } else {
            res.render('login', {
                error: 'Invalid username or password',
                csrfToken: req.csrfToken()
            });
        }
    } catch (err) {
        console.error(err);

        res.render('login', {
            error: 'Error during login attempt',
            csrfToken: req.csrfToken()
        });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
});

app.get('/signup', (req, res) => {
    if (req.session.userId) {
        return res.redirect('/');
    }

    res.render('signup', { csrfToken: req.csrfToken() });
});

app.post('/signup', [
    
    body('firstName').trim().escape(),
    body('lastName').trim().escape(),
    body('username').trim().escape().isLength({
        min: 4
    }).withMessage('Username must be at least 4 characters long.'),
    body('password').trim().isLength({
        min: 6
    }).withMessage('Password must be at least 6 characters long.')
], async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.render('signup', {
            errors: errors.array(),
            csrfToken: req.csrfToken()
        });
    }

    const {
        firstName,
        lastName,
        username,
        password
    } = req.body;

    const hashedPassword = await bcrypt.hash(password, 10);

    try {
        const userId = await db.addUser(firstName, lastName, username, hashedPassword);
        req.session.userId = userId;
        res.redirect('/');
    } 
    
    catch (err) {
        console.error(err);

        res.render('signup', {
            error: 'Error creating account. Please try again.',
            csrfToken: req.csrfToken()
        });
    }
});





app.post('/contact/:id/delete', async (req, res) => {
    try {
        await db.deleteContact(req.params.id);
        res.redirect('/');
    } 
    
    catch (err) {
        console.error(err);
        res.status(500).render('error', { error: 'Error deleting contact. Please try again.' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});
