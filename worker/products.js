"use strict";

let YouzanSDK             = require('../youzan/YouzanSDK')
let YouzanFetch           = require('./products_row')
let sleep                 = require('sleep')
let DB                    = require('./db')

const youzan = new YouzanSDK();
// Object.freeze(youzan);

// async function test(){
//     let res = await youzan.test()
//     console.log("最后结果为",res)
// }
//
// test()

var webdriverio = require('webdriverio');
var options = {
    desiredCapabilities: {
        browserName: 'safari',
        debug:false
    }
};


var url = "https://koudaitong.com/v2/showcase/goods#list&keyword=&p=1&orderby=created_time&order=desc&page_size=20&disable_express_type=&multistore_status=0"
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
//         let w = new WorkerOrders(wi);
//         w.exec();
//     });


wi.getTitle().then(function(title) {
    console.log('Title was: ' + title);
}).getHTML('.js-list-body-region').then(function(html) {
    let w = new Worker(wi);
    w.exec();
});


class WorkerProductPage {

    constructor(flag){
        this.wi                 = wi
        this.timeout            = 600
        this.rows_total         = []
        this.page_flag          = flag
        this.test_page_count    = 0

    }

    async fetch_page_data(){
        let html 			   	  = await this.wi.pause(this.timeout).getHTML('.js-list-body-region')
        let c                     = new YouzanFetch()
        let res                   = c.get_page_rows(html);

        res.map( (el,i) => {
            el["flag"]            = this.page_flag //判断是售罄还是啥
            return el
        })


        this.rows_total.push(res)
        console.log("rows",html,res)
    }
    async fetch_page(){

        let selector_page_next 	  = '.fetch_page.next'
        let isExisting            = await this.wi.isExisting(selector_page_next)
        console.log(">>>>>>>>>>>>是否存在下一页按钮",isExisting);
        // if(isExisting && this.mock_page_count()) {
        if( isExisting ) {
            this.wi.pause(this.timeout).click(selector_page_next)
            await this.fetch_page_data();
            await this.fetch_page()
        }else{
            await this.fetch_page_data();
        }

    }

    mock_page_count(){
        this.test_page_count = this.test_page_count + 1
        if ( this.test_page_count > 3) {
            return false
        }else {
            return  true
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
        // this.page_flags     = ["index","soldout","draft"];
        this.page_flags     = ["index","soldout","draft"];
        this.rows_total     = [];
    }

    async fetch_tab_pages(){
        var worker_procut_page      = null
        for ( let flag of this.page_flags ){
            worker_procut_page      = new WorkerProductPage(flag)

            //点击一下标题栏呗
            let tab_selector        = "#js-nav-list-" + flag + " a";
            console.log(">>>>>>>点击了",tab_selector)

            await this.wi.click(tab_selector)
            await this.wi.pause(1000);

            let  produc_page_data   = await worker_procut_page.exec()
            this.rows_total.push(produc_page_data)
            console.log(this.rows_total)
        }
    }
    async exec(){

        await this.fetch_tab_pages()

        try{
            //只有三个标签都搞定之后才能写入
            this.wi.end()
            await this.combine_with_youzan_api_data()
            await this.to_db()

        }catch(ex){
            console.log(ex.message)
        }
    }

    async combine_with_youzan_api_data(){

        this.rows_total = [].concat(...this.rows_total)

        let count   = 0
        for(let r of this.rows_total){

            console.log( "r product_id" , r["product_id"] )
            let youzan_row_data   = await youzan.api_product_row( r["product_id"] );
            r  = Object.assign(r,youzan_row_data);

            count++;
            r['series_id']   = count;
            console.log( "r youzan data combine is " , r )

            sleep.usleep(500000)

            console.log("现在的总数为",this.rows_total.length, "当前为 : " , count)
        }
    }
    async to_db(){
        this.rows_total = [].concat(...this.rows_total)

        var db = new DB()
        await db.conn()
        let  res  = await db.full_insert_product( this.rows_total)
        console.log("显示一下最后的所有数据" , this.rows_total)
        console.log("显示一下数据库结果" , res)
        return this.rows_total
    }

}
