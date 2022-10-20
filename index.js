const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const app = express();
const port = process.env.PORT || 5000;
require('dotenv').config();

// middleware
app.use(cors());
app.use(express.json());


// const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.dor1v.mongodb.net/?retryWrites=true&w=majority`;
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.dor1v.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, net) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'UnAuthorized Access' });
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'Forbidden Access' });
        }
        req.decoded = decoded;
        net();
    })
}

async function run() {
    try {
        await client.connect();
        const productCollection = client.db("productCollection").collection("product");
        const orderCollection = client.db("productCollection").collection("order");
        const reviewCollection = client.db("productCollection").collection("review");
        const profileCollection = client.db("productCollection").collection("profile");
        const userCollection = client.db("productCollection").collection("user");


        // jasonwebtoken
        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: (email) };
            const options = { upsert: true };
            const updateDoc = {
                $set: user,
            };
            const result = await userCollection.updateOne(filter, updateDoc, options);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET)
            res.send({ result, token });
        });

        // for admin
        app.put('/user/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const requester = req.decoded.email;
            const requesterAccount = await userCollection.findOne({ email: requester });
            if (requesterAccount.role === 'admin') {
                const filter = { email: (email) };
                const updateDoc = {
                    $set: { role: 'admin' },
                };
                const result = await userCollection.updateOne(filter, updateDoc);
                res.send(result);
            }
            else {
                res.status(403).send({ message: 'Forbidden' });
            }
        });


        // payment system
        app.post('/create-payment-intent', async (req, res) => {
            const service = req.body;
            const price = service.price;
            const amount = price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });
            res.send({ clientSecret: paymentIntent.client_secret })
        });

        // Admin permission
        app.get('/admin/:email', async (req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({ email: email });
            const isAdmin = user.role === 'admin';
            res.send({ admin: isAdmin })
        })


        // post new item
        app.post('/product', async (req, res) => {
            const newItem = req.body;
            const add = await productCollection.insertOne(newItem);
            res.send(add);
        });

        // post revies item
        app.post('/review', async (req, res) => {
            const newReview = req.body;
            const addReview = await reviewCollection.insertOne(newReview);
            res.send(addReview);
        });

        // post profile item
        app.post('/profile', async (req, res) => {
            const newProfile = req.body;
            const addProfile = await profileCollection.insertOne(newProfile);
            res.send(addProfile);
        });

        // read all review
        app.get('/review', async (req, res) => {
            const query = {};
            const cursor = reviewCollection.find(query);
            const reviews = await cursor.toArray();
            res.send(reviews);
        });

        // read all users
        app.get('/user', verifyJWT, async (req, res) => {
            const query = {};
            const cursor = userCollection.find(query);
            const users = await cursor.toArray();
            res.send(users);
        });

        // read profile
        app.get('/profile', async (req, res) => {
            const query = {};
            const cursor = profileCollection.find(query);
            const reviews = await cursor.toArray();
            res.send(reviews);
        });


        // read all products
        app.get('/product', async (req, res) => {
            const query = {};
            const cursor = productCollection.find(query);
            const products = await cursor.toArray();
            res.send(products);
        });

        // Read single product
        app.get('/product/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const product = await productCollection.findOne(query);
            res.send(product);
        });


        // Update quantity with previous quantity
        app.put('/product/:id', async (req, res) => {
            const id = req.params.id;
            const user = req.body;
            const filter = { _id: ObjectId(id) };
            const options = { upsert: true };
            let updateDoc;
            if (user.increseQuantity) {
                updateDoc = {
                    $set: {
                        avlbQuantity: user.increseQuantity,
                    },
                }
            }
            else {
                updateDoc = {
                    $set: {
                        avlbQuantity: user.reduceQuantity,
                    },
                }
            }
            const result = await productCollection.updateOne(filter, updateDoc, options);
            res.send(result);
        });

        // order collection
        app.post('/order', async (req, res) => {
            const order = req.body;
            const query = { email: order.email, product: order.product }
            const exists = await orderCollection.findOne(query);
            if (exists) {
                return res.send({ success: false, order: exists })
            }
            const result = await orderCollection.insertOne(order);
            return res.send({ success: true, result });
        });

        // Read all order product
        app.get('/order', async (req, res) => {
            const query = {};
            const cursor = orderCollection.find(query);
            const myOrder = await cursor.toArray();
            res.send(myOrder);
        });

        // Read my order product using email
        app.get('/orders', verifyJWT, async (req, res) => {
            const email = req.query.email;
            const decodedEmail = req.decoded.email;
            if (email === decodedEmail) {
                const query = { email: email };
                const cursor = orderCollection.find(query);
                const myOrder = await cursor.toArray();
                return res.send(myOrder);
            }
            else {
                return res.status(403).send({ message: 'Forbidden Access' });
            }
        });

        // read user for payment from my orders
        app.get('/order/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const order = await orderCollection.findOne(query);
            res.send(order);
        })

        // Delete single product
        app.delete('/myorder/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await orderCollection.deleteOne(query);
            res.send(result);
        });

        // Delete single product of products
        app.delete('/product/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await productCollection.deleteOne(query);
            res.send(result);
        });
    }
    finally {

    }
}
run().catch(console.dir)


app.get('/', (req, res) => {
    res.send('hey this is my final project for manufacture website');
});
app.listen(port, () => {
    console.log('Listen to port', port);
});