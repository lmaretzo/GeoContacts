const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const fs = require('fs');
const geocode = require('./geocode'); // Import the geocode function from the new file


class ContactDB {
        // Constructor for the class to initialize the database connection



        async addUser(firstName, lastName, username, hashedPassword) {
            console.log('Inserting user into database:', { firstName, lastName, username }); // Log 7
            const sql = `
                INSERT INTO users (FirstName, LastName, Username, Password)
                VALUES (?, ?, ?, ?)
            `;
            try {
                const result = await this.runSql(sql, [firstName, lastName, username, hashedPassword]);
                console.log('User inserted successfully with ID:', result); // Log 8
                return result;
            } catch (error) {
                console.error('Error inserting user into database:', error); // Log 9
                throw error;
            }
        }

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

            const formattedAddressExists = await this.columnExists('contacts', 'formattedAddress');
            if (!formattedAddressExists) {
                await this.runSql('ALTER TABLE contacts ADD COLUMN formattedAddress TEXT;');
                console.log('Added "formattedAddress" column to contacts table.');
            } else {
                console.log('"formattedAddress" column already exists.');
            }
        } catch (error) {
            console.error('Error updating schema:', error);
        }
    }


    async columnExists(tableName, columnName) {
        const sql = `
            SELECT COUNT(*) AS count
            FROM pragma_table_info(?)
            WHERE name = ?;
        `;
        const result = await this.runGet(sql, [tableName, columnName]);
        return result && result.count > 0;
    }


        // Initializes the database by creating tables and adding test data

    async initialize() {
        await this.createTables();
        await this.updateSchema();  // Ensures new columns are added after table creation
        await this.ensureDefaultUserExists();
        await this.addTestContacts(); 
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
                lng REAL,   -- Longitude
                formattedAddress TEXT -- Geocoded Address

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
            {
                ID: 1, firstName: 'John', lastName: 'Doe', phoneNumber: '123456789',
                emailAddress: 'john@example.com', street: '1 Tornado Dr', city: 'Tuxedo',
                state: 'NY', zip: '10987', country: 'United States',
                contactByEmail: 1, contactByPhone: 0, lat: 41.1885435, lng: -74.1852656,
                formattedAddress: '1 Tornado Dr, Tuxedo, NY, 10987, United States'
            },
            {
                ID: 2, firstName: 'Jane', lastName: 'Doe', phoneNumber: '987654321',
                emailAddress: 'jane@example.com', street: '505 Ramapo Valley Rd', city: 'Mahwah',
                state: 'NJ', zip: '07430', country: 'United States',
                contactByEmail: 0, contactByPhone: 1, lat: 0, lng: 0,
                formattedAddress: '505 Ramapo Valley Rd, Mahwah, NJ, 07430, United States'
            }
        ];
    
        const checkSql = `SELECT COUNT(*) AS count FROM contacts WHERE ID = ?`;
    
        for (const contact of contacts) {
            const existingContact = await this.runGet(checkSql, [contact.ID]);
            if (existingContact.count === 0) {
                const insertSql = `
                    INSERT INTO contacts (
                        FirstName, LastName, PhoneNumber, EmailAddress,
                        Street, City, State, Zip, Country, Contact_By_Email,
                        Contact_By_Phone, lat, lng, formattedAddress
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `;
                await this.runSql(insertSql, [
                    contact.firstName, contact.lastName, contact.phoneNumber, contact.emailAddress,
                    contact.street, contact.city, contact.state, contact.zip, contact.country,
                    contact.contactByEmail, contact.contactByPhone, contact.lat, contact.lng,
                    contact.formattedAddress 
                ]);
                console.log(`Contact ${contact.firstName} added with formatted address.`);
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
        console.log('Attempting to add contact with address:', address); // Log added
    
        try {
            const { latitude, longitude, formattedAddress } = await geocode(address);
            const lat = latitude;
            const lng = longitude;
            console.log(`Contact ${firstName} ${lastName} added with coordinates and formatted address: ${formattedAddress}.`); // Log success
    
            const sql = `
                INSERT INTO contacts (
                    FirstName, LastName, PhoneNumber, EmailAddress, Street, City, State, Zip, Country,
                    Contact_By_Email, Contact_By_Phone, lat, lng, formattedAddress
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            const contactId = await this.runSql(sql, [firstName, lastName, phoneNumber, emailAddress, street, city, state, zip, country, contactByEmail, contactByPhone, lat, lng, formattedAddress]);
            return contactId; // Return the inserted contact's ID
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
            const { latitude, longitude, formattedAddress } = await geocode(address);
            const lat = latitude;
            const lng = longitude;
            console.log(`Contact ${firstName} ${lastName} updated with new coordinates and formatted address: ${formattedAddress}.`); // Log success
    
            const sql = `
                UPDATE contacts SET
                    FirstName = ?, LastName = ?, PhoneNumber = ?, EmailAddress = ?,
                    Street = ?, City = ?, State = ?, Zip = ?, Country = ?,
                    Contact_By_Email = ?, Contact_By_Phone = ?, lat = ?, lng = ?, formattedAddress = ?
                WHERE ID = ?
            `;
            await this.runSql(sql, [firstName, lastName, phoneNumber, emailAddress, street, city, state, zip, country, contactByEmail, contactByPhone, lat, lng, formattedAddress, id]);
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
        const sql = `SELECT * FROM contacts`;
        return new Promise((resolve, reject) => {
            this.db.all(sql, [], (err, rows) => {
                if (err) {
                    console.error('Error fetching contacts:', err);
                    reject(err);
                } else {
                    console.log('Fetched contacts:', rows); // Log all contacts
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