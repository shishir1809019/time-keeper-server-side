const express = require("express");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;
const cors = require("cors");
const ObjectId = require("mongodb").ObjectId;

// middleware
app.use(cors());
app.use(express.json());

// firebase admin-sdk
const admin = require("firebase-admin");
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const { MongoClient } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.jcjym.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function verifyToken(req, res, next) {
  if (req.headers?.authorization?.startsWith("Bearer ")) {
    const token = req.headers.authorization.split(" ")[1];
    try {
      const decodedUser = await admin.auth().verifyIdToken(token);
      req.decodedEmail = decodedUser.email;
    } catch {
      //
    }
  }
  next();
}

async function run() {
  try {
    await client.connect();
    const database = client.db("timeKeeperMaster");
    const watchCollection = database.collection("watches");
    const purchaseCollection = database.collection("purchases");
    const reviewCollection = database.collection("reviews");
    const userCollection = database.collection("users");

    // get api for watches & reviews
    app.get("/watches", async (req, res) => {
      const cursor = watchCollection.find({});
      const result = await cursor.toArray();
      res.json(result);
    });
    app.get("/reviews", async (req, res) => {
      const cursor = reviewCollection.find({});
      const result = await cursor.toArray();
      res.json(result);
    });

    //get api single watches
    app.get("/watch/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const service = await watchCollection.findOne(query);
      res.send(service);
    });

    //Post api for purchase and review
    app.post("/purchase", async (req, res) => {
      const newPurchase = req.body;
      const result = await purchaseCollection.insertOne(newPurchase);
      res.json(result);
    });
    app.post("/review", async (req, res) => {
      const newReview = req.body;
      const result = await reviewCollection.insertOne(newReview);
      res.json(result);
    });

    //get api for my purchases
    app.get("/myPurchases/:email", async (req, res) => {
      console.log(req.params);
      const result = await purchaseCollection
        .find({ email: req.params.email })
        .toArray();
      res.json(result);
    });

    //delete api for cancel purchase by user
    app.delete("/purchase/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await purchaseCollection.deleteOne(query);

      console.log(result);
      res.json(result);
    });
    // delete api for delete products by admin
    app.delete("/dashboard/watches/:id", async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const query = { _id: ObjectId(id) };
      const result = await watchCollection.deleteOne(query);

      console.log(result);
      res.json(result);
    });
    // delete api for delete purchase by admin
    app.delete("/dashboard/purchase/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await purchaseCollection.deleteOne(query);
      res.send(result);
    });

    //add new product by admin
    app.post("/dashboard/addProduct", async (req, res) => {
      const newUser = req.body;
      const result = await watchCollection.insertOne(newUser);
      res.send(result);
    });

    // get api for confirm admin
    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      let isAdmin = false;
      if (user?.role === "admin") {
        isAdmin = true;
      }
      res.json({ admin: isAdmin });
    });
    //get api for show all purchases by admin
    app.get("/dashboard/allPurchases", async (req, res) => {
      const cursor = purchaseCollection.find({});
      const result = await cursor.toArray();
      res.json(result);
    });

    //post api for add user info to database(email-password)
    app.post("/users", async (req, res) => {
      const user = req.body;
      const result = await userCollection.insertOne(user);
      res.json(result);
    });
    //put api for add user info to database (google sign-in)
    app.put("/users", async (req, res) => {
      const user = req.body;
      const filter = { email: user.email };
      const options = { upsert: true };
      const updateDoc = { $set: user };
      const result = await userCollection.updateOne(filter, updateDoc, options);
      res.json(result);
    });

    //put api for update role in database user info for make admin

    app.put("/users/admin", verifyToken, async (req, res) => {
      const user = req.body;
      const requester = req.decodedEmail;
      console.log(requester);
      if (requester) {
        const requesterAccount = await userCollection.findOne({
          email: requester,
        });
        if ((requesterAccount.role = "admin")) {
          const filter = { email: user.email };
          const updateDoc = { $set: { role: "admin" } };
          const result = await userCollection.updateOne(filter, updateDoc);
          res.json(result);
        }
      } else {
        res
          .status(401)
          .json({ message: "You don't have access to make Admin" });
      }
    });

    //put api for purchase status update
    app.put("/dashboard/purchaseStatus/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          status: "Shipped",
        },
      };
      const result = await purchaseCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      res.json(result);
    });
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello watch lover!");
});

app.listen(port, () => {
  console.log(`app listening at ${port}`);
});
