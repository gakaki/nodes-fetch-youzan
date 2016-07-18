"use strict";

 class YouzanFetch{
    constructor($){
        this.$                = $;
        this.final_data       = [];
    }

    get_brand_name(data){
      var reg = /【.*】/
      var res = data.match(reg)
      console.log("match brand",res)
      if (!res) {
        return ""
      }
      else if (res.length >= 1)
        res     = res[0]
      else
        res     = res
      return res
    }

    get_page_rows(data){
        let $                 = this.$;
        this.page_data        = $('.widget-list-item',data);
        this.page_data.map( (i, el) => {

			var title_el		  = $(el).find(".new-window").eq(0)
            var title             = title_el.text().trim()
            var brand             = this.get_brand_name(title)

            if (title){
				var href  		  = title_el.attr('href').trim()
                var id            = $(el).find('.checkbox').eq(0).attr("data-item-id").trim();
                var price         = $(el).find('.goods-price').eq(0).text().trim();
                var price_int     = price.replace("￥","");

                var td4           = $(el).children('td').eq(3);
                var uv            = $(td4).children('div').eq(0).text().trim().trimLeft().replace("UV:","");
                var pv            = $(td4).children('div').eq(1).text().trim().trimLeft().replace("PV:","");

                var stock           = $(el).children('td').eq(4).text().trim();//库存

                var sale_num      = $(el).children('td').eq(5).text().trim();
                sale_num          = sale_num.replace('-',"0");

                var created_at    = $(el).children('td').eq(7).text().trim();

                var o             = {
					href			: href,
                    title           : title,
                    brand           : brand,
                    id              : id,

                    price           : price,
                    price_int       : price_int,

                    uv              : uv,
                    pv              : pv,

                    sale_num        : sale_num,
                    stock           : stock,
                    created_at      : created_at
                };
                this.final_data.push(o);
                return o;
            }else{
                return null;
            }
        })
        return this.final_data;
    }
}
module.exports = YouzanFetch
