const axios = require('axios');

const geocode = async (address) => {
    try {
        const response = await axios.get('https://nominatim.openstreetmap.org/search', {
            params: {
                q: address,
                format: 'json',
                addressdetails: 1
            },
            headers: {
                'User-Agent': 'ContactList/1.0 (lmaretzo574@gmail.com)' // Replace with your app name and contact information
            }
        });

        if (response.data.length === 0) {
            throw new Error('No geocoding results found');
        }

        const { lat, lon: lng, display_name: formattedAddress } = response.data[0];
        return { latitude: parseFloat(lat), longitude: parseFloat(lng), formattedAddress };
    } catch (error) {
        throw new Error('Error with the geocoding request: ' + error.message);
    }
};

module.exports = geocode;
