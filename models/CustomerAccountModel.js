const mongoose = require('mongoose');
// Read the storefront's existing users collection without creating duplicate accounts.
const schema = new mongoose.Schema({}, { strict: false, collection: 'users', autoCreate: false, autoIndex: false });
module.exports = { CustomerAccount: mongoose.models.CustomerAccount || mongoose.model('CustomerAccount', schema) };
