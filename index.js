
var express=require('express');
var ejs=require('ejs');
var bodyParser=require('body-parser');
var mysql=require('mysql');
var session=require('express-session');
var path = require('path'); 

const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));



mysql.createConnection({
    host:"localhost",
    user:"root",
    password:"",
    database:"phonemart"
})

var app=express();
app.use(express.static('public'));
app.set('views', path.join(__dirname, 'views'));
app.set('view engine','ejs');


app.listen(8081,()=>{
    console.log('server running at port 8081');
});
app.use(bodyParser.urlencoded({extended:true}));
app.use(session({
    secret:"secret",
    resave:false,
    saveUninitialized:true
}));
app.use(express.json()); // To parse JSON bodies

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
        database:"phonemart"
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
        database:"phonemart"
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
  
  
async function getAccessToken() {
    const clientId = 'Your client id';       
    const clientSecret = 'your secret key';      

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const response = await fetch("https://api-m.sandbox.paypal.com/v1/oauth2/token", {
        method: "POST",
        headers: {
            "Authorization": `Basic ${credentials}`,
            "Content-Type": "application/x-www-form-urlencoded"
        },
        body: "grant_type=client_credentials"
    });

    const data = await response.json();
    return data.access_token;
}

async function createOrder() {
  const accessToken = await getAccessToken(); // get token dynamically

  return fetch("https://api-m.sandbox.paypal.com/v2/checkout/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: "USD",
            value: "100.00"
          }
        }
      ]
    })
  }).then(res => res.json());
}

app.post("/my-server/capture-paypal-order/:orderID", async (req, res) => {
    const accessToken = await getAccessToken();
    const orderID = req.params.orderID;

    const response = await fetch(`https://api-m.sandbox.paypal.com/v2/checkout/orders/${orderID}/capture`, {
        method: "POST",
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
        }
    });

    const data = await response.json();
    res.json(data);
});

       
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


app.post('/chatbot', function(req, res) {
    const message = req.body.message.toLowerCase().trim();

    const faqResponses = [
        {
            keywords: ['hi', 'hello', 'hey'],
            response: "Hey, how may I help you? Please ask!"
        },
        {
            keywords: ['how', 'order', 'place'],
            response: "To place an order, add a phone to your cart and proceed to checkout."
        },
        {
            keywords: ['delivery', 'time', 'days'],
            response: "Delivery usually takes 3–5 business days depending on your location."
        },
        {
            keywords: ['return', 'refund', 'policy'],
            response: "You can return products within 7 days of delivery for a full refund."
        },
        {
            keywords: ['payment', 'method', 'pay'],
            response: "We accept payments via PayPal. It’s fast and secure!"
        },
        {
            keywords: ['contact', 'support', 'help'],
            response: "You can reach us at shop.Phonemart@gmail.com or call us at (+91) 8522369417."
        },
        {
            keywords: ['warranty', 'guarantee'],
            response: "Most of our phones come with a 1-year manufacturer warranty."
        },
        {
            keywords: ['cancel', 'order'],
            response: "To cancel an order, contact support within 12 hours of placing it."
        },
        {
            keywords: ['track', 'status'],
            response: "Tracking is available via email once your order is shipped."
        },
        {
            keywords: ['offers', 'sale', 'discount'],
            response: "We currently have up to 25% off on selected phones!"
        }
    ];

    const found = faqResponses.find(faq =>
        faq.keywords.some(keyword => message.includes(keyword))
    );

    const fallback = "I'm still learning. Could you try asking in a different way?";
    res.json({ reply: found ? found.response : fallback });
});




