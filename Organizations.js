var mongoose = require('mongoose');
var Schema = mongoose.Schema;

const OrganizationSchema = new Schema({
  organizationName: { type: String, required: true, unique: true }
});

module.exports = mongoose.model('Organization', OrganizationSchema);