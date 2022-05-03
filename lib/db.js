const { hash } = require('./hasher')
const { MongoClient, ObjectId } = require('mongodb');
module.exports={exports}
module.exports = class DatabaseClient {
    constructor(uri, database) {
        this.uri = uri;
        this.database;
        this.databaseName = database
        this.connected = false;
        this.conn = new MongoClient(this.uri)
    }
    /**
     * 
     * @param {string} email 
     * @param {string} password 
     * @param {{}} metadata 
     * @returns {Promise<ObjectId>}
     */
    createUser(email, password, admin, metadata) {
        return new Promise(async (resolve, reject) => {
            await this.conn.connect()
            var database = this.conn.db(this.databaseName);
            var users = database.collection('users');
            
            users.findOne({
                _id: "e"
            }).then(async value => {
               if (value == null) {
                users.insertOne({
                    email: email,
                    admin: admin,
                    password: await hash(password),
                    metadata: metadata
                }).then(value => {
                   resolve(value.insertedId)
                }).catch(err => {
                    reject(err)
                })
               } else {
                     reject(new Error("User already exists"))
               }
            }).catch(err => {
                reject(err)
            })

        })
    }
    /**
     * 
     * @param {string} id 
     * @returns {Promise<number>}
     */
    deleteUser(id) {
        return new Promise(async (resolve, reject) => {
            await this.conn.connect()
            var database = this.conn.db(this.databaseName);
            var users = database.collection('users');
            users.deleteOne({
                _id: new ObjectId(id)
            }).then(value => {
               resolve(value.deletedCount)
            }).catch(err => {
                reject(err)
            })
        })
    }
    editUser(id, data) {
        return new Promise(async (resolve, reject) => {
            await this.conn.connect()
            var database = this.conn.db(this.databaseName);
            var users = database.collection('users');
            users.updateOne({"_id": new ObjectId(id)}, {"$set": data}).then(value => {
               resolve(value.deletedCount)
            }).catch(err => {
                reject(err)
            })
        })
    }
    fetchUser(id) {
        return new Promise(async (resolve, reject) => {
            await this.conn.connect()
            var database = this.conn.db(this.databaseName);
            var users = database.collection('users');
            users.findOne({
                _id: new ObjectId(id)
            }).then(value => {
               resolve(value)
            }).catch(err => {
                reject(err)
            })
        })
    }
    fetchUserFromEmail(email) {
        return new Promise(async (resolve, reject) => {
            await this.conn.connect()
            var database = this.conn.db(this.databaseName);
            var users = database.collection('users');
            users.findOne({
                email: email
            }).then(value => {
               resolve(value)
            }).catch(err => {
                reject(err)
            })
        })
    }
    /**
     * 
     * @returns {Promise<import('mongodb').WithId<import('mongodb').Document>[]>}
     */
    fetchNodes() {
        return new Promise(async (resolve, reject) => {
            await this.conn.connect()
            var database = this.conn.db(this.databaseName);
            var nodes = database.collection('nodes');
            nodes.find().toArray().then(value => {
               resolve(value)
            }).catch(err => {
                reject(err)
            })
        })
    }
    fetchNodeFromName(name) {
        return new Promise(async (resolve, reject) => {
            await this.conn.connect()
            var database = this.conn.db(this.databaseName);
            var nodes = database.collection('nodes');
            nodes.findOne({
                name: name
            }).then(value => {
               resolve(value)
            }).catch(err => {
                reject(err)
            })
        })
    }
}