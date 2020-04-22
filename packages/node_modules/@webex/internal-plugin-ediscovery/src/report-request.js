/**
 * Creates a report request object with a specific set of search parameters
 * @param {String} name - A label to identify the report
 * @param {String} description - A textual summary of the reports purpose
 * @param {Array<String>} emails - A list of user emails relevant to the report
 * @param {Array<String>} userIds - A list of UUIDs relevant to the report
 * @param {Array<String>} keywords - A list of search terms relevant to the report
 * @param {Array<String>} spaceNames - A list of space names relevant to the report
 * @param {Object} range - Contains the start time and end time defining the search period
 * @returns {Object} ReportRequest - Contains all search parameters
 */
class ReportRequest {
  constructor(name = '', description = '', emails = [], userIds = [], keywords = [], encryptionKeyUrl = '', spaceNames = [], range = {startTime: '2020-01-01T00:00:00', endTime: '2020-01-01T23:59:59'}) {
    this.name = name;
    this.description = description;
    this.emails = emails;
    this.userIds = userIds;
    this.keywords = keywords;
    this.encryptionKeyUrl = encryptionKeyUrl;
    this.spaceNames = spaceNames;
    this.range = range;
  }
}

export default ReportRequest;
