const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const _ = require("lodash");
const { reject } = require("lodash");

const date = require(__dirname + "/date.js");
const app = express();
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

// const items = [];
// const workItems = [];

const itemSchema = new mongoose.Schema({
    content: {
        type: String,
        required: true
    },
    checked: {
        type: Boolean,
        required: true
    }
});

const Item = mongoose.model("Item", itemSchema);

const listSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    realName: {
        type: String,
        required: true
    },
    items: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Item",
        required: true
    }]
});

const List = mongoose.model("List", listSchema);


async function getLists() {
    let lists = [];
    await List.find()
        .then(result => {
            if (result) {
                result.forEach(list => {
                    lists.push({ name: list.name, realName: list.realName });
                });
            };
        })
        .catch((err) => { console.log(err) });
    return lists;
}

async function renderListItem(listName) {
    let listItem = [];
    await List.findOne({ name: listName })
        .populate("items")
        .then(result => {
            if (result && result.items.length > 0) {
                result.items.forEach(item => {
                    listItem.push({ content: item.content, _id: item._id.toString() });
                });
            };
        })
        .catch((err) => { console.log(err) });
    return listItem;
}

async function addListItem(listName, realListName, item) {
    const newItem = new Item({
        _id: new mongoose.Types.ObjectId(),
        content: item.content,
        checked: false
    });
    await newItem.save().catch((err) => { console.log(err) });
    let count = await List.countDocuments({ name: listName }).catch((err) => { console.log(err) });
    if (count === 0) {
        const newList = new List({
            name: listName,
            realName: realListName,
            items: [newItem._id]
        });
        await newList.save()
            .then(console.log("New list created"))
            .catch((err) => { console.log(err) });
    } else {
        await List.findOne({ name: listName })
            .then(result => {
                result.items.push(newItem._id);
                result.save() //use save() instead of updateOne()
                    .then(console.log("New item added to list"))
            });
        // await List.updateOne({ name: listName }, { $push: { items: newItem._id } })
        //     .then(console.log("New item appended to list"))
        //     .catch((err) => { console.log(err) });
    }
    return 'Done';
}

async function deleteListItem(listName, itemId) {
    let count = await List.countDocuments({ name: listName }).catch((err) => { console.log(err) });
    if (count === 0) {
        console.log("List not found");
        return reject("List not found");
    } else {
        await List.updateOne({ name: listName }, { $pull: { items: { $eq: new mongoose.Types.ObjectId(itemId) } } })
            .then(result => console.log(result))
            .catch((err) => { console.log(err) });
        return 'Done';
    }
}


app.get("/about", (req, res) => {
    res.render("about");
});

app.route("/")
    .get((req, res) => {
        const day = date.getDay();
        res.redirect("/list/" + day);
    })
    .post((req, res) => {
        res.status(403).send("POST operation not supported on /");
    });
app.get("/list", (req, res) => {
    getLists()
        .then(lists => {
            res.render("allLists", { listOfLists: lists });
        });
});
app.route("/list/:listName")
    .get((req, res) => {
        const customListName = _.lowerCase(req.params.listName);
        renderListItem(customListName)
            .then((result) => {
                res.render("list", { listTitle: req.params.listName, listItems: result });
            });
    })
    .post((req, res) => {
        const customListName = _.lowerCase(req.params.listName);
        addListItem(customListName, req.params.listName, { content: req.body.content, checked: false })
            .then(
                a => res.redirect("/list/" + req.params.listName)
            );
    });

app.post("/list/delete/:listName", (req, res) => {
    const customListName = _.lowerCase(req.params.listName);
    deleteListItem(customListName, req.body.itemId)
        .then(
            a => res.redirect("/list/" + req.params.listName)
        );
});

app.get("/reset", (req, res) => {
    Item.deleteMany({}, (err) => {
        if (err) {
            console.log(err);
        } else {
            console.log("Deleted all items");
        }
    });
    List.deleteMany({}, (err) => {
        if (err) {
            console.log(err);
        } else {
            console.log("Deleted all lists");
        }
    });
    res.redirect("/");
});


async function main() {
    const user = process.argv[2];
    const password = process.argv[3];
    await mongoose.connect(`mongodb+srv://${user}:${password}@cluster0.mvgwpdk.mongodb.net/todolistDB?retryWrites=true&w=majority`)
        //await mongoose.connect("mongodb://localhost:27017/todolistDB")
        .then(() => { console.log("Connected to MongoDB") });
    mongoose.connection.on("error", console.error.bind(console, "connection error:"));

    app.listen(process.env.PORT || 3000, () => {
        console.log(`server running on ${process.env.PORT || 3000}`);
    });
}
main().catch(console.error);
