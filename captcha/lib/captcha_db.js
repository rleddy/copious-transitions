const { DBClass, SessionStore } = require.main.require('./lib/general_db')
const processExists = require('process-exists');
const EventEmitter = require('events')
const CitadelClient = require('node_citadel')
//const cached = require('cached')
//
//
//const Memcached = require("memcached")
const MemCacheStoreFactory = require('connect-memcached');
var MemcachePlus = require('memcache-plus');



const apiKeys = require.main.require('./local/api_keys')


g_citadel_pass = apiKeys.citadel_password.trim();  // decrypt ??

// pre initialization

(async () => {
  const exists = await processExists('memcached');
  if ( !exists ) {
    console.log("Memchached deamon has not been intialized")
    process.exit(1)
  }
})();

const memcdClient = new MemcachePlus(); //new Memcached('localhost:11211');  // leave it to the module to figure out how to connect

/*
const userCache = cached('users', { backend: {
  type: 'memcached',
  client: memcdClient
}});
*/


var g_citadel = null
var g_citadel_pass = ""
var g_restarting = false


//
//
class CitadelRestarter extends EventEmitter {
    constructor() {
      super()
      this.on('restart',() => {
        console.log("restarting connection")
        g_restarting = true
        run_citadel()
      })
    }
}


//
//
async function run_citadel() {
    let citadel = new CitadelClient()
  
    await citadel.connect()
    console.log("citadel connected")
    let time_data = await citadel.server_time()
    console.log(time_data.split('\n')[0])
    //
    citadel.set_restart_agent(new CitadelRestarter())
    // 
    g_citadel = citadel
    g_restarting = false
}

//
//
async function post_new_user() {
  if ( g_restarting ) {
    setTimeout(() => { post_new_user() }, 200 )
  } else if ( G_users_trns.empty_queue() ) {
    setTimeout(() => { post_new_user() }, 1000 )
  } else {
    //
    while ( g_citadel && !(G_users_trns.empty_queue()) ) {
      let udata = G_users_trns.get_work()
      await g_citadel.create_user(udata.name,udata.pass)
      await g_citadel.logout()
    }
    setTimeout(() => { post_new_user() }, 1000 )
    //
  }
}


async function post_contact_message() {
  if ( g_restarting ) {
    setTimeout(() => { post_contact_message() }, 200 )
  } else if ( G_contact_trns.empty_queue() ) {
    setTimeout(() => { post_contact_message() }, 1000 )
  } else {
    //
    await g_citadel.user('admin')
    await g_citadel.password(g_citadel_pass)    
    while ( g_citadel && !(G_contact_trns.empty_queue()) ) {
      let msg_body = G_contact_trns.get_work()
      //
      let msgObject = {
        'recipient' : "admin",
        'anonymous' : false, 
        'type' : false,
        'subject' : decodeURIComponent(msg_body.name),
        'author' : decodeURIComponent(msg_body.email),
        'references' : decodeURIComponent(msg_body.website),
        'text' : decodeURIComponent(msg_body.comment)
      }
      //
      await g_citadel.post_message(msgObject)
    }
    await g_citadel.logout()
    setTimeout(() => { post_contact_message() }, 1000 )
  }
}


async function dropConnections() {
  if ( g_citadel ) {
    await g_citadel.logout()
    g_citadel.quit()
  }
}


// ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
//

class CaptchaSessionStore extends SessionStore {
    //
    constructor(db_wrapper) {
        super(db_wrapper)
    }
    //
    generateStore(expressSession) {
        if ( super.can_generate_store(expressSession,true) ) {
            // custom code goes here
            let MemcachedStore = new MemCacheStoreFactory(expressSession)
            return (new MemcachedStore({ client: memcdClient }))
        } else {
            process.exit(1)
        }
    }
    //
}



class CaptchaDBClass extends DBClass {

    //
    constructor() {
        super(CaptchaSessionStore,memcdClient)
    }

    // // // 
    initialize(conf) {
        setTimeout(post_new_user,5000)
        setTimeout(post_contact_message,5000)
        super.initialize(conf)
    }

    // // // 
    drop() {
        dropConnections()
    }

    //  custom: contacts, ...
    store(collection,data) {
        if ( G_contact_trns.tagged(collection) ) {
          let udata = G_contact_trns.update(data)
          G_contact_trns.enqueue(udata)
        } else {
          super.store(collection,data)
        }
    }


    // // // 
    store_user(fdata) {
        if ( G_users_trns.tagged('user') ) {
          let [udata,tandems] = G_users_trns.update(fdata)          // custom user storage (seconday service)
          G_users_trns.enqueue(tandems)
          //
          let key_key = G_users_trns.kv_store_key()
          let key = udata[key_key]
          this.store_cache(key,udata,G_users_trns.back_ref());  // this app will use cache to echo persitent storage
          super.store_user(udata,key_key)                               // use persitent storage
        }
    }

    async fetch_user(fdata) {
      if ( G_users_trns.from_cache() ) {
        let udata = await this.fetch_user_from_key_value_store(fdata[G_users_trns.kv_store_key()])
        if ( udata ) {
          return(udata)
        } else {
          let key_key = G_users_trns.kv_store_key()
          let key = fdata[key_key]
          udata = super.fetch_user(key)  // no callback, just get value
          if ( udata ) {
            this.store_cache(key,udata,G_users_trns.back_ref());
            return(udata)
          }
        }
      }
      return(false)
    }

    update_user(udata) {
      //
      let key_key = G_users_trns.kv_store_key()
      let key = udata[key_key]
      //
      this.store_cache(key,udata,G_users_trns.back_ref());  // this app will use cache to echo persitent storage
      super.update_user(udata,key_key)                               // use persitent storage
    }


    async exists(collection,post_body) {
        let query = post_body
        if ( G_users_trns.tagged(collection) ) {
            if ( G_users_trns.from_cache() ) {
                let udata = await this.fetch_user_from_key_value_store(post_body[G_users_trns.kv_store_key()])
                if ( udata ) {
                    return(true)
                }
            }
            query = G_users_trns.existence_query(post_body)
        }
        return(super.exists(collection,query))
    }

    // // // 
    last_step_initalization() {
        run_citadel()
    }

}


//
//
module.exports = new CaptchaDBClass()
