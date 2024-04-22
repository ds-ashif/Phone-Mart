var express=require('express');
var ejs=require('ejs');
var bodyParser=require('body-parser');
var mysql=require('mysql');
var session=require('express-session');
var path = require('path'); 

mysql.createConnection({
    host:"localhost",
    user:"root",
    password:"",
    database:"node_project"
})

var app=express();
app.use(express.static('public'));
app.set('views', path.join(__dirname, 'views'));
app.set('view engine','ejs');


app.listen(8080);
app.use(bodyParser.urlencoded({extended:true}));
app.use(session({
    secret:"secret",
    resave:false,
    saveUninitialized:true
}));

function isProductInCart(cart,id){
    for (let i = 0; i < cart.length; i++) {
        if(cart[i].id==id) return true;
    }
    return false;
}

function calculateTotal(cart,req){
    total=0;
    for(let i=0;i<cart.length;i++){
        if(cart[i].sale_price){
            total=total+(cart[i].sale_price*cart[i].quantity);
        }else{
            total=total+(cart[i].price*cart[i].quantity)
        }
    }
    req.session.total=total;
    return total; 
}

app.get('/',function(req,res){

    var con=mysql.createConnection({
        host:"localhost",
        user:"root",
        password:"",
        database:"node_project"
    })
    con.query("SELECT * FROM products",(err,result)=>{

        res.render('pages/index',{result:result});
    })
    
});

app.post("/add_to_cart",function(req,res){
    var id=req.body.id;
    var name=req.body.name;
    var price=req.body.price;
    var sale_price=req.body.sale_price;
    var quantity=req.body.quantity;
    var image=req.body.image;
    var product={id:id,name:name,price:price,sale_price:sale_price,quantity:quantity,image:image};


    if (!req.session.cart) {
        req.session.cart = [];
    }

    if(req.session.cart){
        var cart=req.session.cart;
        if(!isProductInCart(cart,id)){
            cart.push(product);
        }else{
            req.session.cart=[product];
            var cart=req.session.cart;

        }

        calculateTotal(cart,req);

        res.redirect('/cart');
    }



});

app.get('/cart',function(req,res){

    if (!req.session.cart) {
        req.session.cart = [];
    }


    var cart=req.session.cart;
    var total=req.session.total;

    res.render('pages/cart',{cart:cart,total:total});
})


app.post('/remove_product',function(req,res){
    var id=req.body.id;
    var cart=req.session.cart;

    for(let i=0;i<cart.length;i++){
        if(cart[i].id==id){
            cart.splice(cart.indexOf(i),1);
        }
    }
    // re-calculate total
    calculateTotal(cart,req);
    res.redirect('/cart');
})


app.post('/edit_product_quantity',function(req,res){
    // get values from inputs
    var id=req.body.id;
    var quantity=req.body.quantity;
    var increase_btn=req.body.increase_product_quantity;
    var decrease_btn=req.body.decrease_product_quantity;
    var cart=req.session.cart;

    if(increase_btn){
        for(let i=0;i<cart.length;i++){
            if(cart[i].id==id){
                if(cart[i].quantity>0){
                    cart[i].quantity=parseInt(cart[i].quantity)+1;
                }
            }
        }
    }

    
    if(decrease_btn){
        for(let i=0;i<cart.length;i++){
            if(cart[i].id==id){
                if(cart[i].quantity>1){
                    cart[i].quantity=parseInt(cart[i].quantity)-1;
                }
            }
        }
    }

    calculateTotal(cart,req);
    res.redirect('/cart');


});

app.get('/checkout',function(req,res){
    var total=req.session.total;
    res.render('pages/checkout');
})

app.post('/place_order',function(req,res){
    var name=req.body.name;
    var email=req.body.email;
    var phone=req.body.phone;
    var city=req.body.city;
    var address=req.body.address;
    var cost=req.session.total;
    var status="not paid";
    var date=new Date();
    var products_ids="";

    var con=mysql.createConnection({
        host:"localhost",
        user:"root",
        password:"",
        database:"node_project"
    })
    var cart=req.session.cart;
    for(let i=0;i<cart.length;i++){
        products_ids=products_ids+","+cart[i].id;
    }
    con.connect((err)=>{
        if(err){
            console.log(err);
        }else{
            var query="INSERT INTO orders(cost,name,email,status,city,address,phone,date,products_ids) VALUES ?";
            var values=[
                [cost,name,email,status,city,address,phone,date,products_ids]
            ];
            con.query(query,[values],(err,result)=>{
                res.redirect('/payment');
            })
        }
    })
    
})



app.post("/my-server/create-paypal-order", async (req, res) => {
    const order = await createOrder();
    res.json(order);
  });
  
  // use the orders api to create an order
  function createOrder() {
    // create accessToken using your clientID and clientSecret
    // for the full stack example, please see the Standard Integration guide
    // https://developer.paypal.com/docs/multiparty/checkout/standard/integrate/-/
    const accessToken = "REPLACE_WITH_YOUR_ACCESS_TOKEN";
    return fetch ("https://api-m.sandbox.paypal.com/v2/checkout/orders", {
      method: "POST",
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ${accessToken}',
      },
      body: JSON.stringify({
        "purchase_units": [
          {
            "amount": {
              "currency_code": "USD",
              "value": "100.00"
            },
            "reference_id": "d9f80740-38f0-11e8-b467-0ed5f89f718b"
          }
        ],
        "intent": "CAPTURE",
        "payment_source": {
          "paypal": {
            "experience_context": {
              "payment_method_preference": "IMMEDIATE_PAYMENT_REQUIRED",
              "payment_method_selected": "PAYPAL",
              "brand_name": "EXAMPLE INC",
              "locale": "en-US",
              "landing_page": "LOGIN",
              "shipping_preference": "SET_PROVIDED_ADDRESS",
              "user_action": "PAY_NOW",
              "return_url": "https://example.com/returnUrl",
              "cancel_url": "https://example.com/cancelUrl"
            }
          }
        }
      })
    })
    .then((response) => response.json());
  }
            
app.get('/payment',function(req,res){
    var total=req.session.total
    res.render('pages/payment',{total:total});
});



app.get('/About_', function(req, res) {
    res.render('pages/About_.ejs'); 
});

// app.get('/About_', function(req, res) {
//     res.render('pages/about'); 
// });

app.get('/Brand_', function(req, res) {
    res.render('pages/Brand_.ejs'); 
});



app.get('/contact', function(req, res) {
    res.render('pages/contact.ejs'); 
});

app.get('/cart', function(req, res) {
    res.render('pages/cart.ejs'); 
});

app.get('/index', function(req, res) {
    res.render('pages/index.ejs'); 
});
