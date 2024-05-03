const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const fs = require('fs');
const NodeGeocoder = require('node-geocoder');
const geocoderOptions = {
    provider: 'openstreetmap',
    httpAdapter: 'https', // Default
    formatter: null         // 'gpx', 'string', ...
};
const geocoder = NodeGeocoder(geocoderOptions);

class ContactDB {
        // Constructor for the class to initialize the database connection

    constructor(dbFile) {
        this.db = new sqlite3.Database(dbFile, async (err) => {
            if (err) {
                console.error('Error when connecting to the DB', err);
                return;
            }
            console.log('Connected to the SQLite database.');
            await this.initialize();
        });
    }

     // Function to update database schema to add new columns
    async updateSchema() {
        try {
            await this.runSql('ALTER TABLE contacts ADD COLUMN lat REAL;');
            await this.runSql('ALTER TABLE contacts ADD COLUMN lng REAL;');
        } catch (error) {
            console.error('Error updating schema:', error);
        }
    }
        // Initializes the database by creating tables and adding test data

    async initialize() {
        await this.createTables();
        //await this.updateSchema();  // Ensures new columns are added after table creation
        await this.ensureDefaultUserExists();
        await this.addTestContacts(); // Optionally call to add predefined contacts
    }
    // Creates the necessary database tables if they do not exist
    async createTables() {
        // Modified contacts table schema to include latitude and longitude
        const createContactsTable = `
            CREATE TABLE IF NOT EXISTS contacts (
                ID INTEGER PRIMARY KEY AUTOINCREMENT,
                FirstName TEXT NOT NULL,
                LastName TEXT NOT NULL,
                PhoneNumber TEXT,
                EmailAddress TEXT,
                Street TEXT,
                City TEXT,
                State TEXT,
                Zip TEXT,
                Country TEXT,
                Contact_By_Email INTEGER,
                Contact_By_Phone INTEGER,
                lat REAL,  -- Latitude
                lng REAL   -- Longitude
            );`;

        const createUsersTable = `
            CREATE TABLE IF NOT EXISTS users (
                ID INTEGER PRIMARY KEY AUTOINCREMENT,
                FirstName TEXT,
                LastName TEXT,
                Username TEXT UNIQUE,
                Password TEXT
            );`;

        await this.runSql(createContactsTable);
        await this.runSql(createUsersTable);
    }

    // Executes an SQL query with the provided parameters
    async runSql(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) {
                    console.error('Error executing SQL', err);
                    reject(err);
                } else {
                    resolve(this.lastID || this.changes);
                }
            });
        });
    }

    // Adds predefined contact entries to the database if they do not already exist
    async addTestContacts() {
        const contacts = [
            // Sample contacts with latitude and longitude
            {
                ID: 1, firstName: 'John', lastName: 'Doe', phoneNumber: '123456789',
                emailAddress: 'john@example.com', street: '1 Tornado Dr', city: 'Tuxedo',
                state: 'NY', zip: '10987', country: 'United States',
                contactByEmail: 1, contactByPhone: 0, lat: 0, lng: 0
            },
            {
                ID: 2, firstName: 'Jane', lastName: 'Doe', phoneNumber: '987654321',
                emailAddress: 'jane@example.com', street: '505 Ramapo Valley Rd', city: 'Mahwah',
                state: 'NJ', zip: '07430', country: 'United States',
                contactByEmail: 0, contactByPhone: 1, lat: 0, lng: 0
            },
        ];

        const checkSql = `SELECT COUNT(*) AS count FROM contacts WHERE ID = ?`;

        for (const contact of contacts) {
            const existingContact = await this.runGet(checkSql, [contact.ID]);
            if (existingContact.count === 0) {
                const insertSql = `
                    INSERT INTO contacts (
                        ID, FirstName, LastName, PhoneNumber, EmailAddress,
                        Street, City, State, Zip, Country, Contact_By_Email,
                        Contact_By_Phone, lat, lng
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `;
                await this.runSql(insertSql, Object.values(contact));
                console.log(`Contact ${contact.firstName} added.`);
            } else {
                console.log(`Contact ${contact.firstName} already exists.`);
            }
        }
    }

    // Helper function to run a query and return a single row
    async runGet(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) {
                    console.error('Error executing SQL', err);
                    reject(err);
                } else {
                    resolve(row || null);
                }
            });
        });
    }

    // Ensures that a default user exists in the database
    async ensureDefaultUserExists() {
        const defaultUsername = 'cmps369';
        const defaultPassword = 'rcnj';
        const userExists = await this.getUserByUsername(defaultUsername);
        if (!userExists) {
            const hashedPassword = await bcrypt.hash(defaultPassword, 10);
            await this.addUser('Default', 'User', defaultUsername, hashedPassword);
            console.log('Default user added.');
        } else {
            console.log('Default user already exists.');
        }
    }

    // Retrieves a user by username from the database
    async getUserByUsername(username) {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM users WHERE Username = ?`;
            this.db.get(sql, [username], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row || null);
                }
            });
        });
    }

    // Checks if the provided username and password match an existing user in the database
    async checkUser(username, password) {
        return new Promise(async (resolve, reject) => {
            const user = await this.getUserByUsername(username);
            if (user) {
                const match = await bcrypt.compare(password, user.Password);
                resolve(match ? user : null);
            } else {
                resolve(null); // Ensures the promise resolves correctly when no user is found
            }
        });
    }

    // Adds a new contact to the database with additional fields for latitude and longitude
    async addContact(contact) {
        const { firstName, lastName, phoneNumber, emailAddress, street, city, state, zip, country, contactByEmail, contactByPhone } = contact;
        const address = `${street}, ${city}, ${state}, ${zip}, ${country}`;
    
        try {
            const geocodeResult = await geocoder.geocode(address);
            if (geocodeResult.length > 0) {
                const lat = geocodeResult[0].latitude;
                const lng = geocodeResult[0].longitude;
    
                const sql = `
                    INSERT INTO contacts (
                        FirstName, LastName, PhoneNumber, EmailAddress, Street, City, State, Zip, Country,
                        Contact_By_Email, Contact_By_Phone, lat, lng
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `;
                await this.runSql(sql, [firstName, lastName, phoneNumber, emailAddress, street, city, state, zip, country, contactByEmail, contactByPhone, lat, lng]);
                console.log(`Contact ${firstName} ${lastName} added with coordinates.`);
            } else {
                throw new Error('Geocoding failed, no results found.');
            }
        } catch (error) {
            console.error('Error adding contact with geocoding:', error);
            throw error;
        }
    }
    
    // Retrieves a contact by its ID, including latitude and longitude
    async getContactById(id) {
        return new Promise((resolve, reject) => {
            // Retrieves contact along with latitude and longitude
            const sql = `SELECT * FROM contacts WHERE ID = ?`;
            this.db.get(sql, [id], (err, row) => {
                if (err) {
                    console.error('Error fetching contact:', err);
                    reject(err);
                } else {
                    resolve(row || null);
                }
            });
        });
    }

    // Updates the details of an existing contact in the database, including latitude and longitude
    async updateContact(id, contact) {
        const { firstName, lastName, phoneNumber, emailAddress, street, city, state, zip, country, contactByEmail, contactByPhone } = contact;
        const address = `${street}, ${city}, ${state}, ${zip}, ${country}`;
    
        try {
            const geocodeResult = await geocoder.geocode(address);
            if (geocodeResult.length > 0) {
                const lat = geocodeResult[0].latitude;
                const lng = geocodeResult[0].longitude;
    
                const sql = `
                    UPDATE contacts SET
                        FirstName = ?, LastName = ?, PhoneNumber = ?, EmailAddress = ?,
                        Street = ?, City = ?, State = ?, Zip = ?, Country = ?,
                        Contact_By_Email = ?, Contact_By_Phone = ?, lat = ?, lng = ?
                    WHERE ID = ?
                `;
                await this.runSql(sql, [firstName, lastName, phoneNumber, emailAddress, street, city, state, zip, country, contactByEmail, contactByPhone, lat, lng, id]);
                console.log(`Contact ${firstName} ${lastName} updated with new coordinates.`);

            } else {
                console.error('Geocoding failed, no results found for address:', address);
                // Here you can choose to proceed without updating lat/lng or handle it differently
                // For now, let's update without new coordinates
                const sqlWithoutGeo = `
                    UPDATE contacts SET
                        FirstName = ?, LastName = ?, PhoneNumber = ?, EmailAddress = ?,
                        Street = ?, City = ?, State = ?, Zip = ?, Country = ?,
                        Contact_By_Email = ?, Contact_By_Phone = ?
                    WHERE ID = ?
                `;
                await this.runSql(sqlWithoutGeo, [firstName, lastName, phoneNumber, emailAddress, street, city, state, zip, country, contactByEmail, contactByPhone, id]);
                console.log(`Updated contact without new coordinates due to geocode failure.`);
            }
        } catch (error) {
            console.error('Error updating contact with geocoding:', error);
            throw error;
        }
    }
    // Deletes a contact from the database using the contact's ID
    async deleteContact(id) {
        return new Promise((resolve, reject) => {
            const sql = `DELETE FROM contacts WHERE ID = ?`;
            this.db.run(sql, [id], function(err) {
                if (err) {
                    console.error('Error deleting contact:', err);
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    }

    // Retrieves all contacts from the database
    async getAllContacts() {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM contacts`;
            this.db.all(sql, [], (err, rows) => {
                if (err) {
                    console.error('Error fetching contacts:', err);
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    // Searches for contacts by first name or last name matching a search term
    async searchContacts(searchTerm) {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM contacts WHERE FirstName LIKE ? OR LastName LIKE ?`;
            this.db.all(sql, [`%${searchTerm}%`, `%${searchTerm}%`], (err, rows) => {
                if (err) {
                    console.error("Database error in searchContacts:", err);
                    reject(err);
                } else {
                    console.log("Search results:", rows);
                    resolve(rows);
                }
            });
        });
    }
}

module.exports = new ContactDB('contacts.db');
