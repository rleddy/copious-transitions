const GeneralStatic = require.main.require('./lib/general_static')

const myStorageClass = null

class MediaUpStatic extends GeneralStatic {
    //
    constructor() {
        super(myStorageClass)
        //
        this.preloaded = {
            "uploader" : { "fname" : '/uploader.html', "ftype" : "html" },
            "song_submit" : { "fname" : '/submitter.html', "ftype" : "html" }
        }
        //
        this.singer_asset_media_object = null
        this.songofday_asset_media_object = null
    }

    preload_all(conf) {
        //
        if ( conf.static_files ) {
            this.generic_prep_cwd_offset(conf)
        }

        //
        super.preload_all()
        //
        // A) SINGER UPLOAD FORM -- uploader
        let data = this.preloaded.uploader.data
        let json = this.prepare_asset(data)
        //
        this.singer_asset_media_object = {
            "mime_type" : "appliation/json",
            "string" : JSON.stringify(json)
        }
        //
        // B) SONG OF DAY SUBMISSION FORM -- song_submit
        data = this.preloaded.song_submit.data
        json = this.prepare_asset(data)
        //
        this.songofday_asset_media_object = {
            "mime_type" : "application/json",
            "string" : JSON.stringify(json)
        }
        //
        
    }

    fetch(asset) {
        if ( asset == "singer-uploader" ) {
            if ( !(this.singer_asset_media_object) ) {
                return("empty")
            } else {
                return(this.singer_asset_media_object)
            }
        } else if ( asset == "songofday-uploader" ) {
            if ( !(this.songofday_asset_media_object) ) {
                return("empty")
            } else {
                return(this.songofday_asset_media_object)
            }
        } else {
            return(super.fetch())
        }
    }
    
}


module.exports = new MediaUpStatic()
