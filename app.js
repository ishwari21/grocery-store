const bodyParser = require("body-parser");
const monk = require("monk");
const mongoose = require('mongoose');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const session = require('express-session');
const express = require("express");
const methodOverride = require('method-override')
const app = express();

app.use(methodOverride('_method'))

app.set('views', __dirname + '/views');
app.set("view engine", "ejs"); //to avoid typing ejs

app.use(express.static("public"));
app.use(bodyParser.urlencoded({extended: true}));

const db = monk('localhost:27017/Grocery'); // Connect to your MongoDB database named "Grocery"
const storeCollection = db.get('items'); // "items" is the name of your collection

// Set up session middleware
app.use(session({
    secret: 'your-secret-key', // Add a secret key for session encryption
    resave: false,
    saveUninitialized: false
}));
  
// passport config
var Account = require('./models/account');
passport.use(new LocalStrategy(Account.authenticate()));
passport.serializeUser(Account.serializeUser());
passport.deserializeUser(Account.deserializeUser());
  
// mongoose connection
mongoose.connect('mongodb://localhost:27017/Grocery');

db.on('open', () => {
    // Event listener for successful connection
    console.log('Connected to MongoDB');
});
  
db.on('error', (err) => {
    // Event listener for connection error
    console.error('Error connecting to MongoDB:', err);
});

app.use(session({ secret: 'this-is-a-secret-token' }));
app.use(passport.initialize());
app.use(passport.session());

app.get('/', function(req, res) {
    res.redirect("/store");
});

app.get("/store", function(req, res) {
    storeCollection.find({}, function(err, items) {
        if(err) {
            console.log("ERROR!");
        }
        else {
            res.render("index", {items: items, user: req.session.user});
        }
    });
});

app.get("/store/search", function(req, res) {
    var { name, type } = req.query;
    if (name == "") {
        name = {$exists: true};
    }
    else {
        // all game names that have "name" in it and case-"i"nsensitive
        name = {"$regex": name, "$options": "i"};
    }
    if (type == "No filter") {
        type = {$exists: true};
    }
    const itemSearch = {
        name: name,
        type: type
    }
    storeCollection.find(itemSearch, function(err, items) {
        if(err) {
            console.log("ERROR!");
        }
        else {
            res.render("index", {items: items, user: req.session.user});
        }
    });
});

app.put("/store/checkout", async (req, res) => {
    var items  = req.body;
    try {
        for (var item_name in items) {
            var qtyChange = items[item_name];
        
            const updatedItem = await storeCollection.update({ name: item_name }, { $inc: { qty: -qtyChange } });
        }
        res.render("checkout", {items: items, user: req.session.user});
    }
    catch (err) {
        res.redirect("/store");
    }
});

app.post("/store", async (req,res) => {
    try {
        const { name, description, type, qty, price, unit, image } = req.body;
        const newItem = {
          name,
          description,
          type,
          qty: parseInt(qty),
          price,
          unit,
          image
        };
    
        const insertedItem = await storeCollection.insert(newItem);
    
        // Redirect to the main page after successful form submission
        res.redirect('/'); // Redirect to the root URL
    } 
    catch (err) {
        res.render("new", {user: req.session.user});
    }
});

app.get("/store/new", function(req,res){
    res.render("new", {user: req.session.user});
});

app.get("/store/:id", function(req,res) {
    storeCollection.findOne({_id: req.params.id}, function(err, foundItem) {
    //findById(req.params.id, function(err, foundBlog){
        if(err) {
            res.redirect("/store");
        }
        else {
            res.render("show", {item: foundItem, user: req.session.user});
        }
    });
});

app.get("/store/:id/edit", function(req,res) {
    storeCollection.findOne({_id: req.params.id}, function(err, foundItem) {
        if(err) {
            res.redirect("/store");
        }
        else {
            res.render("edit", {item: foundItem, user: req.session.user});
        }
    });
});

app.put("/store/:id", async (req,res) => {
    //req.body.blog.body = req.sanitize(req.body.blog.body);
    try {
        const { name, description, type, qty, price, unit, image } = req.body;

        // Specify the condition to find the document to update
        const updateCondition = {
            _id: req.params.id
        };

        // Specify the entire updated data for the document
        const updatedDocument = {
            $set: {
                name,
                description,
                type,
                qty: parseInt(qty),
                price,
                unit,
                image
            }
        };
        
        const updatedItem = await storeCollection.update(updateCondition, updatedDocument);
        res.redirect("/store/"+req.params.id);
    }
    catch (err) {
        res.redirect("/store");
    }
});

app.delete("/store/:id", function(req,res) {
    // Specify the condition for deleting documents
    const deleteCondition = {
        _id: req.params.id
    };
    storeCollection.remove(deleteCondition)
    .then((result) => {
        console.log('Data deleted successfully:', result);
      })
      .catch((err) => {
        console.error('Error deleting data from MongoDB:', err);
      });
    res.redirect("/");
}); 





app.get('/register', function (req, res) {
    res.render('register', { account: "", user: req.session.user });
});

app.post('/register', function (req, res) {
    console.log("register post");
    Account.register(new Account({ username: req.body.username }), req.body.password, function (err, account) {
        if (err) {
            return res.render('register', { account: account, user: req.session.user });
        }

        passport.authenticate('local')(req, res, function () {
            console.log("success!");
            res.redirect('/login'); // Redirect to the home page after registration
        });
    });
});


app.post('/login', 
    passport.authenticate('local', { failureRedirect: '/login', failureMessage: true }), 
    function(req, res) {
        // Set the user property in the session after successful login
        req.session.user = req.user.username; // Assuming your user object has a 'username' property
        res.redirect('/'); // Redirect to the home page after login
    });

app.get('/logout', isLoggedIn, function (req, res) {
    req.logout(function(err) {
        if (err) {
            console.error("Error logging out: ", err);
        }
        req.session.destroy(function(err) {
            if (err) {
                console.error("Error destroying session: ", err);
            }
            res.redirect('/'); // Redirect to the home page after logout
        });
    });
});



// Middleware to check if the user is authenticated
function isLoggedIn(req, res, next) {
    if (req.isAuthenticated() && req.user) {
        return next();
    }
    res.redirect('/login');
}

app.get('/login', function (req, res) {
    login_error = { message: req.session.messages || [] }
    req.session.messages = null;
    res.render('login', {message: login_error, user: req.session.user});
});

// Error handler middleware
app.use(function(err, req, res, next) {
    console.error(err.stack); // Log the error for debugging
    res.status(500).send('Something went wrong!'); // Send a 500 Internal Server Error response
});



app.listen(3000, function() {
    console.log("Server is up");
});