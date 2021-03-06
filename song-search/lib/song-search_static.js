const GeneralStatic = require.main.require('./lib/general_static')

const myStorageClass = null
const FORCE_FAIL_FETCH = "NotAnObject"

class SongSearchStatic extends GeneralStatic {
    //
    constructor() {
        super(myStorageClass)
        //
        this.preloaded = {
            "song_of_day_info" : { "fname" : '/song_of_day.json', "ftype" : "json" }
        }
        //
        this.song_of_day_info_asset_media_object = null
    }

    preload_all(conf) {
        //
        if ( conf.static_files ) {
            this.generic_prep_cwd_offset(conf)
        }
        //
        super.preload_all()
        //
        // C) SONG OF DAY INFO (FOR DISPLAY)
        let json = this.preloaded.song_of_day_info.data
        //
        this.song_of_day_info_asset_media_object = {
            "mime_type" : "application/json",
            "string" : JSON.stringify(json)
        }

        let intervalRef = setInterval(async () => { 
            let json = await this.reload("song_of_day_info"); 
            this.song_of_day_info_asset_media_object.string = JSON.stringify(json) 
        },conf.song_of_day_interval)

        this.intervalRefs.push(intervalRef)
    }

    fetch(asset) {
        if ( asset === "song_of_day_info" ) {
            if ( !(this.song_of_day_info_asset_media_object) ) {
                return("empty")
            } else {
                return(this.song_of_day_info_asset_media_object)
            }
        } else {
            let export_object = this.db.get_from_cache(asset_id)
            if ( export_object ) {
                if ( export_object === FORCE_FAIL_FETCH ) {
                    return({
                        "mime_type" : "text/ascii",
                        "string" : FORCE_FAIL_FETCH
                    })
                }
                return(export_object)
            }
        }
        return(super.fetch(asset))
    }
}


module.exports = new SongSearchStatic()

// this.db.set_static_in_play(body._session_id,post_body._info_acces)