"use strict";


let YouzanFetch           = require('./DomOperate')
let sleep                 = require('sleep');

let fs                    = require('fs')
let $                     = require('cheerio');

let h                     = fs.readFileSync('cheeio_test.html', 'utf-8');
h                         = $.load(h);
let data                  = h.html();



var webdriverio = require('webdriverio');
var options = {
    desiredCapabilities: {
        browserName: 'safari',
        debug:false
    }
};



var url = "https://koudaitong.com/v2/showcase/goods#list&keyword=&p=1&orderby=created_time&order=desc&page_size=20&multistore_status=0"
let wi  = webdriverio.remote(options)
    .init()
    .url(url)


// wi.getTitle().then(function(title) {
//         console.log('Title was: ' + title);
//     })
//     .setValue("[name=account]","13621822254")
//     .setValue("[name=password]","z5896321")
//     .waitForExist('.js-list-body-region',100000)
//     .getTitle().then(function(title) {
//         console.log('Title was: ' + title);
//     }).getHTML('.js-list-body-region').then(function(html) {
//         let w = new Worker(wi);
//         w.exec();
//     });


wi.getTitle().then(function(title) {
    console.log('Title was: ' + title);
}).getHTML('.js-list-body-region').then(function(html) {

    //默认是 出售中
    let w = new Worker(wi);
    w.exec();

});



let async_youzan_row = async function( num_iid ){

		// 引入有赞SDK
		let SDK 		= require('youzan-sdk');
		// 初始化SDK，在 https://koudaitong.com/v2/apps/open/setting 开启API接口，复制相应 AppID、AppSecert

		let AppID 		= "0eb3d2acf73c033353"
		let AppSecert 	= "e4dbae40b7a367c1efb7eea48c00fa75"
		let sdk_obj 	= SDK({key: AppID, secret: AppSecert})
		let data 		= await sdk_obj.get('kdt.item.get', {
		    num_iid: num_iid,
		    fields: ""
		});

		let youzan_row  = data.response.item;
		console.log(youzan_row);
		return youzan_row;
}



class WorkerProductPage {

    constructor(flag){
        this.wi             = wi
        this.timeout        = 600
        this.rows_total     = []
        this.page_flag      = flag

        //点击一下标题栏呗
        this.wi.click(flag + " a");
    }

    async fetch_page_data(){
        let html 			   	  = await this.wi.pause(this.timeout).getHTML('.js-list-body-region')
        let c                     = new YouzanFetch($)
        let res                   = c.get_page_rows(html);
        this.rows_total.push(res)
        console.log("rows",html,res)
    }
    async fetch_page(){

        let selector_page_next 	  = '.fetch_page.next'
        let isExisting            = await this.wi.isExisting(selector_page_next)
        console.log(">>>>>>>>>>>>是否存在下一页按钮",isExisting);
        if(isExisting) {
            this.wi.pause(this.timeout).click(selector_page_next)
            await this.fetch_page_data();
            await this.fetch_page()
        }else{
            await this.fetch_page_data();
        }

    }

    async exec(){
        await this.fetch_page();
        this.rows_total = [].concat(...this.rows_total)
        console.log("执行结束  总算到达页面尾部了" )
        console.log(this.rows_total)
        return this.rows_total
    }
}

class Worker{
    constructor(wi){
        this.wi             = wi;
        this.timeout        = 600;
        this.rows_group     = [];
        this.page_flags     = ["js-nav-list-soldout","js-nav-list-index","js-nav-list-draft"];
    }

    async fetch_tab_pages(){
        for ( let flag of this.page_flags ){
            let worker_procut_page  = new WorkerProductPage(flag)
            this.rows_group[flag]   = await worker_procut_page.exec()
            console.log(this.rows_group)
        }
    }
    async exec(){

        await this.fetch_tab_pages()
        //判断rows group 的长度
        if ( this.rows_group.length == 3 ){
            try{
                //只有三个标签都搞定之后才能写入
                this.wi.end();
                await this.combine_with_youzan_api_data();
            }catch(ex){
                console.log(ex.message)
            }
        }else{
            console.log( " 没有完全获取到 所有页面数据 共3个页面 获得页面总量为", this.rows_group.length)
        }
    }

    async combine_with_youzan_api_data(){

        let m = this
        let count = 0
        for(let r of m.rows_total){
            let product_id		  = r['id'];
            console.log( "r id" , product_id )
            let youzan_row_data   = await async_youzan_row( product_id );
            r  = Object.assign(r,youzan_row_data);

            count++;
            r["product_id"] = r['id'];
            r['id']         = count;
            console.log( "r youzan data combine is " , r )

            sleep.usleep(500000)

            console.log("现在的总数为",m.rows_total.length, "当前为 : " , count)
        }

        let data = m.rows_total


        var r = require('rethinkdb');

        var connection = null;
        r.connect( {host: 'wowdsgn.com', port: 28015}, (err, conn) => {

            if (err) throw err;
            connection = conn;

            let dbName 		= 'youzan'
            let tableName 	= "product"
            let db 			= r.db(dbName)
            let table		= db.table(tableName)


            table.delete().run(connection, (err, result) => {
                if (err) throw err;
                table.insert(this.rows_total).run(connection, (err, result) => {
                    if (err) throw err;
                    console.log(JSON.stringify(result, null, 2));
                })
            })

//
        })

        return m.rows_total
    }


}
