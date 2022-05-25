const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const port = process.env.PORT || 5000;
require('dotenv').config();

// middleware
app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.dor1v.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
async function run() {
    try {
        await client.connect();
        const productCollection = client.db("productCollection").collection("product");
        const orderCollection = client.db("productCollection").collection("order");
        const reviewCollection = client.db("productCollection").collection("review");

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

        // read all review
        app.get('/review', async (req, res) => {
            const query = {};
            const cursor = reviewCollection.find(query);
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
        app.get('/orders', async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const cursor = orderCollection.find(query);
            const myOrder = await cursor.toArray();
            res.send(myOrder);
        });

        // Delete single product
        app.delete('/myorder/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await orderCollection.deleteOne(query);
            res.send(result);
        });
    }
    finally {

    }
}
run().catch(console.dir)


app.get('/', (req, res) => {
    res.send('hey this is my final project');
});
app.listen(port, () => {
    console.log('Listen to port', port);
});