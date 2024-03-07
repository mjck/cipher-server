const path = require("path");
const express = require("express");
const zlib = require("zlib");
const fs = require("fs");
const { parse } = require("csv-parse");
const db = require("./sqlite.js");
const app = express();

const errorMessage =
  "Whoops! Error connecting to the database–please try again!";

app.use(express.json())

// if you're using common js
const StreamChat = require("stream-chat").StreamChat;

// instantiate your stream client using the API key and secret
// the secret is only used server side and gives you full access to the API
// find your API keys here https://getstream.io/dashboard/
const serverSideClient = StreamChat.getInstance(
  process.env.API_KEY,
  process.env.API_SECRET
);

const fnames = [
  "1_a_map_ppp.csv",
  "1_b_map_ppp.csv",
  "2_a_map_ppt.csv",
  "2_b_map_ppt.csv",  
  "3_a_map_ptp.csv",
  "3_b_map_ptp.csv",
  "4_a_map_ptt.csv",
  "4_b_map_ptt.csv",
  "5_a_map_tpp.csv",
  "5_b_map_tpp.csv",
  "6_a_map_tpt.csv",
  "6_b_map_tpt.csv",  
  "7_a_map_ttp.csv",
  "7_b_map_ttp.csv",
  "8_a_map_ttt.csv",
  "8_b_map_ttt.csv" 
];

const ciphers = {
  "1_a_map_ppp.csv": [],
  "1_b_map_ppp.csv": [],
  "2_a_map_ppt.csv": [],
  "2_b_map_ppt.csv": [],  
  "3_a_map_ptp.csv": [],
  "3_b_map_ptp.csv": [],
  "4_a_map_ptt.csv": [],
  "4_b_map_ptt.csv": [],
  "5_a_map_tpp.csv": [],
  "5_b_map_tpp.csv": [],
  "6_a_map_tpt.csv": [],
  "6_b_map_tpt.csv": [],  
  "7_a_map_ttp.csv": [],
  "7_b_map_ttp.csv": [],
  "8_a_map_ttt.csv": [],
  "8_b_map_ttt.csv": [] 
}

Object.entries(ciphers).forEach(([fname, cipher]) => {
  fs.createReadStream(".data/" + fname)
    .pipe(
      parse({
        delimiter: ",",
        ltrim: true
      })
    )
    .on("data", function (row) {
       //ciphers[fname].push(row);
      cipher.push(...row);
    })
    .on("end", function () {
      console.log(`Parsed ${fname}`);
      //console.log(cipher);
    })
});

const chatClient = StreamChat.getInstance(process.env.API_KEY);

//const users = [{ username: "marcel", password: "marcel" }];
// app.get("/foo", (req, res) => {
//   res.json({ message: "Hello World Stream!" });
// });

// ping request
// app.get('/hello', (req, res) => {
// 	/* Your code here */
// 	res.status(200).send('Hello!');
// });

String.prototype.hashCode = function() {
    var hash = 0, i = 0, len = this.length;
    while ( i < len ) {
        hash  = ((hash << 5) - hash + this.charCodeAt(i++)) << 0;
    }
    return hash + 2147483647 + 1;
};

// https://stackoverflow.com/questions/7616461/generate-a-hash-from-string-in-javascript
// public static long hashcode(Object obj) {
//    return ((long) obj.hashCode()) + Integer.MAX_VALUE + 1l;
//}

// decode text
function decodeText(text) {
  const buffer = Buffer.from(text, "base64");
  const decompressed = zlib.inflateRawSync(buffer).toString("utf-8");
  const tokens = decompressed.split("],");
  const cipher = tokens[0].substring(9).split(",").map((e) => Number("0x" + e));
  const cipherText = tokens[1].substring(11, tokens[1].length-1);
  return {
    cipher: cipher,
    cipherText: cipherText
  }
}

// encode text
function encodeText(cipher, cipherText) {
  const cipher16 = cipher.map((e) => e.toString(16)); 
  const text = `{cipher=[${cipher16}],cipherText=${cipherText}}`;
  const base64Compressed = zlib.deflateRawSync(text).toString("base64");
  return base64Compressed
}

// identity cipher
function identityCipher(user_id, length) {
  const hash = user_id.hashCode();
  const index = hash % 16
  return ciphers[fnames[index]];
}

// encrypt/decrypt cipher
function encryptDecrypt(cipherA, cipherB) {
  let recipher = cipherA.map((value, index) => {
       return index < cipherB.length ? value ^ parseInt(cipherB[index], 10) : value;
  });
  return recipher
}

// query message recipients
async function channelRecipients(user_id, channel) {
  var recipients = [];
  const query = await channel.queryMembers({});
  query["members"].forEach(function (member, index) {
    if (member["user_id"] != user_id) {
      recipients.push(member["user_id"]);
    }
  });
  return recipients
}

// re-encode text
async function reencodeText(user_id, channel, text) {
   const recipients = await channelRecipients(user_id, channel);
   // decode text
   const { cipher, cipherText } = decodeText(text);
   // decrypt sender cipher
   const senderIdCipher = identityCipher(user_id, cipher.length);
   const senderCipher = encryptDecrypt(cipher, senderIdCipher);
   // encrypt with recipient cipher
   const recipientIdCipher = identityCipher(recipients[0], senderCipher.length);
   const recipientCipher = encryptDecrypt(senderCipher, recipientIdCipher);
   // encode text
   return encodeText(recipientCipher, cipherText);  
}

// api
app.post("/get-user", async (request, reply) => {
  const user_id = request.body.user_id
  let data = {};
  data.user = await db.getUser(user_id);
  if (!data.user || data.user.length == 0) data.error = `User ${user_id} not found`;
  const status = data.error ? 401 : 201;
  reply.status(status).send(data);
});

app.post("/add-user", async (request, reply) => {
  const { user_id, user_name } = request.body;
  let data = {};
  data.success = await db.addUser(user_id, user_name);
  const status = data.success ? 201 : 401;
  reply.status(status).send(data);
});

app.get("/users", async (request, reply) => {
  let data = {};
  data.users = await db.getUsers();
  console.log(data.users);
  if (!data.users) data.error = errorMessage;
  const status = data.error ? 400 : 200;
  reply.status(status).send(data);
});

app.post('/send-message', async (req, res) => {
   const { user_id, cid, text, timeout } = req.body;
   //console.log(`sending ${text} to channel ${cid} by ${user_id} with timeout ${timeout}`)  
   try {
     const channel = serverSideClient.channel('messaging', cid);
     console.log(user_id.hashCode());
     const encodedText = await reencodeText(user_id, channel, text);
     await channel.sendMessage({
       text: encodedText,
       user_id: user_id,
       attachments: [{
         "type" : "cipher",
         "timeout" : timeout 
       }]
     });
     res.status(200);
   } catch (err) {
     console.log(err);
     res.status(400);
   }
});

// delete a message with a timeout
app.post('/delete-message', async (req, res) => {
  const { timeout, message_id: messageID } = req.body;
  console.log(`requested deletion of message_id ${messageID} with timeout ${timeout}`)
  setTimeout(async () => {
    try {
      await serverSideClient.deleteMessage(messageID, true);
      res.status(200);
    } catch (err) {
      console.log(err);
      res.status(500);
    }
  }, 1000 * timeout);
});

// add user as a member of general channel
app.post('/add-member', async (req, res) => {
  let data = {};
  const type = req.body.type
  const cid = req.body.cid
  const user_id = req.body.user_id
  try {
    console.log(`add-member ${user_id} to channel ${type}:${cid}`)
    const generalChannel = serverSideClient.channel(type, cid);
    await generalChannel.addMembers([user_id.toString()]);
    data.message = `add-member ${user_id} to channel ${type}:${cid} successful` 
    res.status(200).send(data);
  } catch (err) {
      data.message = "add-member not successful"
      console.log(err);
      res.status(401);
    }
});

// generate a token for the user with given id
app.post("/token", async (req, res) => {
  const device_id = req.body.device_id
  const user_id = req.body.user_id
  const user_name = req.body.user_name
  //const phonenumber = req.body.phonenumber
  //const user_id = username.concat(phonenumber).replace(/[^\w]/gi, '').toLowerCase()
  console.log(`create token for ${device_id}, ${user_id}, ${user_name}`)
  try {
    
    if (!(device_id == process.env.ADMIN_DEVICE_ID && process.env.ADMIN_BYPASS.toLowerCase() == "true")) {
      
      // check if device id exists in database
      let result = await db.getUser(device_id);

      //console.log(`search results in ${result.length}`);
      
      if (result.length > 0) {
        if (result[0].user_id != user_id) {
          // user attempts to login with a different user_id on a
          // previous recorded device id
          console.log(`A user = ${result[0].user_id} is already registered on device ${device_id}`);
          res.sendStatus(401);
          return
        } 
      } else {
        // user does not exist, add to database
        let success = await db.addUser(device_id, user_id, user_name)
        if (success)
          console.log(`create record for ${device_id}, ${user_id}, ${user_name}`)
      }
    }
    
    // create token for user_id
    const token = await serverSideClient.createToken(user_id.toString());
    
    res.status(200).json({
      //user_id: user_id,
      token: token,
    });
    
  } catch (error) {
    console.log(error);
    res.sendStatus(400);
  }
});

// app.get('/login', (req, res) => {
//   const username = req.body.username
//   const password = red.body.password
//   const authentic = users.find(user => user.username == username && user.password == password)
//   if (authentic) {
//   }
// }

if (process.env.SERVER_ENABLED.toLowerCase() == "true") {
  // Listen for requests
  const listener = app.listen(process.env.PORT, () => {
    console.log("Cipher server is listening on port " + listener.address().port);
  });
} else {
  console.log("Cipher server is not running.");
}

// // Require the fastify framework and instantiate it
// const fastify = require("fastify")({
//   // set this to true for detailed logging:
//   logger: false,
// });

// // Setup our static files
// fastify.register(require("@fastify/static"), {
//   root: path.join(__dirname, "public"),
//   prefix: "/", // optional: default '/'
// });

// // fastify-formbody lets us parse incoming forms
// fastify.register(require("@fastify/formbody"));

// // point-of-view is a templating manager for fastify
// fastify.register(require("@fastify/view"), {
//   engine: {
//     handlebars: require("handlebars"),
//   },
// });

// // Our main GET home page route, pulls from src/pages/index.hbs
// fastify.get("/", function (request, reply) {
//   // params is an object we'll pass to our handlebars template
//   let params = {
//     greeting: "Hello Node!",
//   };
//   // request.query.paramName <-- a querystring example
//   return reply.view("/src/pages/index.hbs", params);
// });

// // A POST route to handle form submissions
// fastify.post("/", function (request, reply) {
//   let params = {
//     greeting: "Hello Form!",
//   };
//   // request.body.paramName <-- a form post example
//   return reply.view("/src/pages/index.hbs", params);
// });

// // Run the server and report out to the logs
// fastify.listen(
//   { port: process.env.PORT, host: "0.0.0.0" },
//   function (err, address) {
//     if (err) {
//       console.error(err);
//       process.exit(1);
//     }
//     console.log(`Your app is listening on ${address}`);
//   }
// );
