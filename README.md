## GeoContacts

## Overview:
GeoContacts is a full-stack web application designed to manage contact information with a unique feature of geocoding addresses. Built with Node.js, Express, and SQLite, it provides an intuitive interface for users to add, edit, delete, and view contact details integrated with maps. This app uses OpenStreetMap for mapping functionalities and ensures secure access with session-based authentication.

## Features:
User Authentication: Secure login and signup processes to manage access to the application.
Contact Management: Users can create, retrieve, update, and delete contacts in a structured database.
Geocoding: Automatically converts physical addresses into coordinates and displays them on a map.
Interactive Maps: Visual representation of contact addresses using Leaflet.js, enhancing user interaction and usability.
Responsive Design: Made to provide an optimal viewing experience across a wide range of devices.
Technology Stack
Backend: Node.js, Express
Database: SQLite
Frontend: Pug (Template Engine), Bootstrap (CSS Framework)
Maps: Leaflet.js, OpenStreetMap
Authentication: bcrypt.js for hashing passwords, express-session for managing sessions
Form Validation: express-validator
Geocoding: NodeGeocoder with OpenStreetMap provider

## Prerequisites:
Before you begin, ensure you have Node.js and npm installed on your system.

## Usage:
After starting the app, you can:
Register: Sign up for a new account to start managing contacts.
Log In/Out: Access your personal contact list securely.
Create Contact: Add new contacts with details including name, phone number, and address.
View Contacts: Browse through the contacts in your list with their locations displayed on a map.
Edit/Delete Contacts: Update contact details or remove them from your list.
