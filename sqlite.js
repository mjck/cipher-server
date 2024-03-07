/**
 * Module handles database management
 *
 * The sample data is for a chat log with one table:
 * Messages: id + message text
 */

const fs = require("fs");
const dbFile = "./.data/users.db";
const exists = fs.existsSync(dbFile);
const sqlite3 = require("sqlite3").verbose();
const dbWrapper = require("sqlite");
let db;

//SQLite wrapper for async / await connections https://www.npmjs.com/package/sqlite
dbWrapper
  .open({
    filename: dbFile,
    driver: sqlite3.Database
  })
  .then(async dBase => {
    db = dBase;

    try {
      if (!exists) {
        await db.run(
          "CREATE TABLE Users (id TEXT PRIMARY KEY UNIQUE, user_id TEXT, user_name TEXT)"
        );
        console.log("Database re-created.")
      }
      console.log("Connection to database initiated")
      console.log(await db.all("SELECT * from Users"));
    } catch (dbError) {
      console.error(dbError);
    }
  });

// Server script calls these methods to connect to the db
module.exports = {
  
  // Get a user from the database if the user exists
  getUser: async id => {
    try {
      return await db.all("SELECT * from Users WHERE id = ?", [
        id
      ]);
    } catch (dbError) {
      console.error(dbError);
    }
  },
  
  // Get all users in the database
  getUsers: async () => {
    try {
      return await db.all("SELECT * from Users");
    } catch (dbError) {
      console.error(dbError);
    }
  },

  // Add new user
  addUser: async (id, user_id, user_name) => {
    let success = false;
    try {
      success = await db.run("INSERT INTO Users (id, user_id, user_name) VALUES (?, ?, ?)", [
        id,
        user_id,
        user_name
      ]);
    } catch (dbError) {
      console.error(dbError);
    }
    return success.changes > 0 ? true : false;
  },

  // Update message text
  updateUser: async (id, user_id, user_name) => {
    let success = false;
    try {
      success = await db.run(
        "Update Users SET user_id = ? user_name = ? WHERE id = ?",
        user_id,
        user_name,
        id
      );
    } catch (dbError) {
      console.error(dbError);
    }
    return success.changes > 0 ? true : false;
  },

  // Remove user
  deleteUser: async id => {
    let success = false;
    try {
      success = await db.run("Delete from Users WHERE id = ?", id);
    } catch (dbError) {
      console.error(dbError);
    }
    return success.changes > 0 ? true : false;
  }
};
