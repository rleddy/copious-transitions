const GeneralBusiness = require.main.require('./lib/general_business')

class UploaderBusiness extends GeneralBusiness {
    //
    constructor() {
        super()
        this.db = null
        this.rules = null
    }

}

module.exports = new UploaderBusiness()
