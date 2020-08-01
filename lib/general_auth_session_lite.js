const uuid = require('uuid/v4')
const AppLifeCycle = require("./general_lifecyle")


class SessionManager_Lite extends AppLifeCycle {
    constructor(exp_app,db_obj,business) {  // reference to the DB and initializes the a middleware vector
        super()
        this.db = db_obj
        this.app = exp_app
        this.middle_ware = null
        let conf = exp_app._extract_conf()
        if ( conf ) {
            this.middle_ware = conf.middleware["session"]
        }
        if ( this.middle_ware === undefined ) {
            this.middle_ware = []
        }
        this.conf = conf
        //
        this.business = business
        this.hashables = clonify(conf.forhash)
        //
        this.goingSessions = {};
        this.goingTokens = {};
    }

    extract_exposable_user_info(user,info) {
        return(user.name)
    }

    inSession(key) {
        return(this.goingSessions[key] !== undefined)
    }

    in_session(key,token) {
        if ( this.inSession(key) ) {
            return(this.goingSessions[key] !== token)
        }
        return(false)
    }

    // bool
    async tokenCurrent(token) {
        //
        if ( (this.goingTokens[token] == undefined) ) {
            //
            try {
                let key = await this.db.get_key_value(token)
                //
                if ( key == null ) {
                    return(false)
                } else {
                    this.goingSessions[key] = token;
                    this.goingTokens[token] = key;
                    return true
                }
            } catch(e) { // set an error flag
                return false
            }
            //
        }
        //
        return ( true )
    }

    //
    async guard(asset,body,req) {
        return(true)    // true by default
    }

    post_body_decode(udata) {
        for ( let key in udata ) {
            let field = udata[key]
            if ( field ) {
                field = decodeURIComponent(field)
                udata[key] = field.trim()
            }
        }
        return(udata)
    }

    // default behavior -- 
    do_hash(str) {
        return(global_hasher(str))
    }

    sess_data_accessor() {
        return "app_user_data"
    }

    unstash_session_token(elements) {
        let key = this.sess_data_accessor()
        return(elements[key])
    }

    key_for_user() {    // override this for tracking the user across of few user transitions
        return('id')
    }


    //
    match(post_body,transtion_object)  {
        if ( post_body._t_match_field ) {
            let t_match = transtion_object.elements.match;
            if ( t_match === post_body._t_match_field ) {
                return true
            }
        }
        return false
    }


    //
    process_transition(transition,post_body,req) {  // req for any session cookies, etc.
        let suuid = '' + uuid()
        let transtion_object = {
            "token" : (post_body._uuid_prefix ? post_body._uuid_prefix : '') + suuid,
            "secondary_action" : true,
            "type" : "transition",
            "asset_key" : transition
        }
        return(transtion_object)
    }

    finalize_transition(transition,post_body,elements,req)  {
        let finalization_state = {
            "state" : "UP",
            "OK" : "true"
        }    
        return(finalization_state)   // finalization state more likely some objecg
    }

    feasible(transition,post_body,req) {            // examine the session state to see if the transition can take place
        return(false)
    }

    // --
    session_accrue_errors(category,data,err) {}

    which_uploaded_files(req,post_body) {
        return([])      // the application should handle this
    }

    upload_file(post_body,ttrans,req) {
        //
        let files = this.which_uploaded_files(req,post_body)
        if ( !files || Object.keys(files).length === 0) {
            let finalization_state = {
                "state" : "failed",
                "OK" : "false"
            }
            return finalization_state
        }
        //
        let ukey = ttrans.primary_key()
        let proto_file_name = post_body[ukey]
        let file_name_base = ttrans.transform_file_name(proto_file_name)
        let ext = post_body.file_type
        //
        for ( let file_key in files ) {
            let uploaded_file = files[file_key]
            let file_differentiator = ttrans.file_entry_id(file_key)
            // mv is part of the express.js system
            let store_name = `${file_name_base}${file_differentiator}.${ext}`
            let dir = ttrans.directory()
            let udata = {
                'name' : proto_file_name,
                'id-source' : ukey,
                'id' : proto_file_name,
                'pass' : '',
                'dir' : dir,
                'file' : store_name
            }
            uploaded_file.mv(dir + '/'  + store_name, ((uudata,ureq) => {
                return((err) => {
                    if ( err ) {
                        this.session_accrue_errors("upload",uudata,err,ureq)
                    } else {
                        this.db.store("upload",uudata)
                    }
                });
            })(udata,req))
            //
        }
        let finalization_state = {
            "state" : "stored",
            "OK" : "true"
        }
        return finalization_state
    }

    //   assets
    process_asset(asset_id,post_body) {
        let transtion_object = {
            "token" : "nothing",
            "secondary_action" : false,
            "type" : "static_asset"
        }
        return(transtion_object)
    }


    update_session_state(transition,post_body,req) {    // req for session cookies if any
        return true
    }


    set_cookie(res,cookie_id,value,age) {
        // application overried 
    }

    release_cookie(res,cookie_id) {}

}



class GeneralAuth extends AppLifeCycle {

    constructor(sessClass) {
        super()
        //
        this.db = null
        this.sessionClass = sessClass ? sessClass : SessionManager
    }

    sessions(exp_app,db_obj,bussiness) {
        let sess_m = new this.sessionClass(exp_app,db_obj,bussiness);
        this.db = db_obj
        return(sess_m)
    }

}

module.exports.GeneralAuth = GeneralAuth;
module.exports.SessionManager_Lite = SessionManager_Lite
module.exports.SessionManager = SessionManager_Lite