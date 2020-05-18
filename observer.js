require('dotenv').config();
var amqp = require('amqplib/callback_api');
const { ChatDB } = require('./chatdb/index.js');
const uuidv4 = require('uuid/v4');
var Message = require("./models/message");
var MessageConstants = require("./models/messageConstants");
const express = require('express');
const bodyParser = require('body-parser');
const app = express();
app.use(bodyParser.json());

var amqpConn = null;

var exchange = 'amq.topic';
const topic_outgoing = `apps.${process.env.APP_ID}.users.*.messages.*.outgoing`
const topic_incoming = `apps.${process.env.APP_ID}.users.*.messages.*.incoming`
// const topic_update = `apps.${process.env.APP_ID}.users.*.messages.*.*.update` // 'apps/tilechat/users/USER_ID/messages/CONVERS_WITH/MESSAGE_ID/update'
const topic_update = `apps.${process.env.APP_ID}.users.#.update`
const topic_archive = `apps.${process.env.APP_ID}.users.#.archive`
const topic_presence = `apps.${process.env.APP_ID}.users.*.presence.*`

var chatdb;

function startMQ() {
  console.log("Starting AMQP chat server...")
  // amqp.connect('amqp://andrea:Freedom73@localhost:5672?heartbeat=60', function (err, conn) {
  const userid = "ignored"
  //const password = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJlYzA4MmU5Yy1hOWIxLTQ1ZGYtYWRkMy0zMGY3YzY3NWEwZmUiLCJzdWIiOiJ1bGlzc2UiLCJzY29wZSI6WyJyYWJiaXRtcS5yZWFkOiovKi91bGlzc2UuKiIsInJhYmJpdG1xLnJlYWQ6Ki8qL2dpYWd1YXJveC4qIiwicmFiYml0bXEud3JpdGU6Ki8qL3VsaXNzZS4qIiwicmFiYml0bXEuY29uZmlndXJlOiovKi8qIl0sImNsaWVudF9pZCI6InVsaXNzZSIsImNpZCI6InVsaXNzZSIsImF6cCI6InVsaXNzZSIsImdyYW50X3R5cGUiOiJwYXNzd29yZCIsInVzZXJfaWQiOiJ1bGlzc2UiLCJvcmlnaW4iOiJ1YWEiLCJ1c2VyX25hbWUiOiJ1bGlzc2UiLCJlbWFpbCI6InJhYmJpdF9hbm9ueW1AZXhhbXBsZS5jb20iLCJhdXRoX3RpbWUiOjE1ODg1NDEwNzksImlhdCI6MTU4ODU0MTA3OSwiZXhwIjoxNTkxMTMzMDc5LCJpc3MiOiJodHRwOi8vbG9jYWxob3N0OjgwODAvdWFhL29hdXRoL3Rva2VuIiwiemlkIjoidWFhIiwiYXVkIjpbInJhYmJpdG1xIiwidWxpc3NlIl0sImprdSI6Imh0dHBzOi8vbG9jYWxob3N0OjgwODAvdWFhL3Rva2VuX2tleXMiLCJraWQiOiJsZWdhY3ktdG9rZW4ta2V5In0.hm60kLv8EEW-Ih8gIIltNKTxtSt6l6zJBoaIsP1Rd64"
  // const password = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJhN2RkZjdkNC02ZTdjLTQ5NzEtYmY0My1jOTZkMTYzMjAwNTkiLCJzdWIiOiJ1bGlzc2UiLCJzY29wZSI6WyJyYWJiaXRtcS5yZWFkOiovKi9hcHBzLnRpbGVjaGF0LnVzZXJzLnVsaXNzZS4jIiwicmFiYml0bXEud3JpdGU6Ki8qL2FwcHMudGlsZWNoYXQudXNlcnMudWxpc3NlLiMiLCJyYWJiaXRtcS5jb25maWd1cmU6Ki8qLyoiXSwiY2xpZW50X2lkIjoidWxpc3NlIiwiY2lkIjoidWxpc3NlIiwiYXpwIjoidWxpc3NlIiwiZ3JhbnRfdHlwZSI6InBhc3N3b3JkIiwidXNlcl9pZCI6InVsaXNzZSIsIm9yaWdpbiI6InVhYSIsInVzZXJfbmFtZSI6InVsaXNzZSIsImF1dGhfdGltZSI6MTU4ODU4MDQ3NywiaWF0IjoxNTg4NTgwNDc3LCJleHAiOjE1OTExNzI0NzcsImlzcyI6Imh0dHA6Ly9sb2NhbGhvc3Q6ODA4MC91YWEvb2F1dGgvdG9rZW4iLCJ6aWQiOiJ1YWEiLCJhdWQiOlsicmFiYml0bXEiLCJ1bGlzc2UiXSwiamt1IjoiaHR0cHM6Ly9sb2NhbGhvc3Q6ODA4MC91YWEvdG9rZW5fa2V5cyIsImtpZCI6ImxlZ2FjeS10b2tlbi1rZXkifQ.rcrHL_FoOAJNxhF64gJqIN3nwqtqpvsG4Pg2CpCEoIg"
  // const password = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJjYzQzZDZiZC1kNTY5LTRjZWMtOGJiZi00ZjA2ODY4Y2JlMWMiLCJzdWIiOiIwMS1PQlNFUlZFUiIsInNjb3BlIjpbInJhYmJpdG1xLnJlYWQ6Ki8qLyoiLCJyYWJiaXRtcS53cml0ZToqLyovKiIsInJhYmJpdG1xLmNvbmZpZ3VyZToqLyovKiJdLCJjbGllbnRfaWQiOiIwMS1PQlNFUlZFUiIsImNpZCI6IjAxLU9CU0VSVkVSIiwiYXpwIjoiMDEtT0JTRVJWRVIiLCJncmFudF90eXBlIjoicGFzc3dvcmQiLCJ1c2VyX2lkIjoiMDEtT0JTRVJWRVIiLCJvcmlnaW4iOiJ1YWEiLCJ1c2VyX25hbWUiOiIwMS1PQlNFUlZFUiIsImF1dGhfdGltZSI6MTU4ODU4NzQzMywiaWF0IjoxNTg4NTg3NDMzLCJleHAiOjE1OTExNzk0MzMsImlzcyI6Imh0dHA6Ly9sb2NhbGhvc3Q6ODA4MC91YWEvb2F1dGgvdG9rZW4iLCJ6aWQiOiJ1YWEiLCJhdWQiOlsicmFiYml0bXEiLCIwMS1PQlNFUlZFUiJdLCJqa3UiOiJodHRwczovL2xvY2FsaG9zdDo4MDgwL3VhYS90b2tlbl9rZXlzIiwia2lkIjoibGVnYWN5LXRva2VuLWtleSJ9.3SDis6B1SeLYCRcYRRHxeGp-bL0P56f0grORwfQiNes"
  // amqp.connect('amqp://' + userid + ':' + password + '@localhost:5672?heartbeat=60', function (err, conn) {
  console.log("Connecting to RabbitMQ:", process.env.RABBITMQ_URI)
  amqp.connect(process.env.RABBITMQ_URI, function (err, conn) {
    if (err) {
      console.error("[AMQP]", err.message);
      return setTimeout(startMQ, 1000);
    }
    conn.on("error", function (err) {
      if (err.message !== "Connection closing") {
        console.error("[AMQP] conn error", err.message);
      }
    });
    conn.on("close", function () {
      console.error("[AMQP] reconnecting");
      return setTimeout(startMQ, 1000);
    });
    console.log("[AMQP] connected.................");
    amqpConn = conn;
    whenConnected();
  });
}

function whenConnected() {
  startPublisher();
  startWorker();
}

var pubChannel = null;
var offlinePubQueue = [];
function startPublisher() {
  amqpConn.createConfirmChannel(function (err, ch) {
    if (closeOnErr(err)) return;
    ch.on("error", function (err) {
      console.error("[AMQP] channel error", err.message);
    });
    ch.on("close", function () {
      console.log("[AMQP] channel closed");
    });
    pubChannel = ch;
    if (offlinePubQueue.length > 0) {
      while (true) {
        var [exchange, routingKey, content] = offlinePubQueue.shift();
        publish(exchange, routingKey, content);
      }
    }
  });
}

function publish(exchange, routingKey, content, callback) {
  try {
    pubChannel.publish(exchange, routingKey, content, { persistent: true },
      function (err, ok) {
        if (err) {
          console.error("[AMQP] publish", err);
          offlinePubQueue.push([exchange, routingKey, content]);
          pubChannel.connection.close();
          callback(err)
        }
        else {
          console.log("published to", routingKey, "result", ok)
          callback(null)
        }
      });
  } catch (e) {
    console.error("[AMQP] publish", e.message);
    offlinePubQueue.push([exchange, routingKey, content]);
    callback(e)
  }
}

// function publish(routingKey, content, callback) {
//   try {
//     _publish(exchange, routingKey, content, { persistent: true },
//       function (err, ok) {
//         callback(err, ok)
//       });
//   } catch (e) {
//     console.error("[AMQP] publish", e.message);
//     offlinePubQueue.push([exchange, routingKey, content]);
//     callback(e)
//   }
// }

var channel;
function startWorker() {
  amqpConn.createChannel(function (err, ch) {
    channel = ch;
    if (closeOnErr(err)) return;
    ch.on("error", function (err) {
      console.error("[AMQP] channel error", err.message);
    });
    ch.on("close", function () {
      console.log("[AMQP] channel closed");
    });

    ch.prefetch(10);
    ch.assertExchange(exchange, 'topic', {
      durable: true
    });
    ch.assertQueue("jobs", { durable: true }, function (err, _ok) {
      if (closeOnErr(err)) return;
      subscribeTo(topic_outgoing, ch, _ok.queue)
      subscribeTo(topic_incoming, ch, _ok.queue)
      subscribeTo(topic_update, ch, _ok.queue)
      subscribeTo(topic_archive, ch, _ok.queue)
      subscribeTo(topic_presence, ch, _ok.queue)

      // ch.bindQueue(_ok.queue, exchange, topic_outgoing, {}, function (err3, oka) {
      //   console.log("bind: " + _ok.queue + " err: " + err3 + " topic: " + topic_outgoing);
      // });
      ch.consume("jobs", processMsg, { noAck: false });
      console.log("Worker is started");
    });
  });
}

function subscribeTo(topic, channel, queue) {
  channel.bindQueue(queue, exchange, topic, {}, function (err, oka) {
    console.log("bind: " + queue + " err: " + err + " topic: " + topic);
  });
}

function processMsg(msg) {
  work(msg, function (ok) {
    try {
      if (ok)
        channel.ack(msg);
      else
        channel.reject(msg, true);
    } catch (e) {
      closeOnErr(e);
    }
  });
}

function work(msg, callback) {
  console.log("Topic:", msg.fields.routingKey, " message:", msg.content.toString());
  const topic = msg.fields.routingKey //.replace(/[.]/g, '/');
  const message_string = msg.content.toString();
  if (topic.endsWith('.outgoing')) {
    process_outgoing(topic, message_string, callback);
  }
  else if (topic.endsWith('.incoming')) {
    process_incoming(topic, message_string, callback);
  }
  else if (topic.endsWith('.update')) {
    process_update(topic, message_string, callback);
  }
  else if (topic.endsWith('.archive')) {
    process_archive(topic, message_string, callback);
  }
  else if (topic.includes('.presence.')) {
    process_presence(topic, message_string, callback);
  }
  else {
    console.log("unkownn topic", topic)
  }
}

// ***** TOPIC HANDLERS ******/

function process_presence(topic, message_string, callback) {
  console.log("got PRESENCE testament", message_string, " on topic", topic)
  callback(true)
}

function process_outgoing(topic, message_string, callback) {
  var topic_parts = topic.split(".")
  // /apps/tilechat/users/(ME)SENDER_ID/messages/RECIPIENT_ID/outgoing
  const app_id = topic_parts[1]
  const sender_id = topic_parts[3]
  const recipient_id = topic_parts[5]
  const convers_with = recipient_id
  const me = sender_id

  recipient_inbox = 'apps.tilechat.users.' + recipient_id + '.messages.' + sender_id + '.incoming'
  sender_inbox = 'apps.tilechat.users.' + sender_id + '.messages.' + recipient_id + '.incoming'
  console.log("recipient_inbox:", recipient_inbox)
  console.log("sender_inbox:", sender_inbox)
  var message = JSON.parse(message_string)
  var messageId = uuidv4();
  const now = Date.now()
  var outgoing_message = message;
  outgoing_message.message_id = messageId
  outgoing_message.sender = sender_id
  outgoing_message.recipient = recipient_id
  outgoing_message.app_id = app_id
  outgoing_message.timestamp = now
  outgoing_message.status = MessageConstants.CHAT_MESSAGE_STATUS_CODE.DELIVERED

  // {
  //   message_id: messageId,
  //   text: message.text,
  //   sender: sender_id,
  //   sender_fullname: message.sender_fullname,
  //   recipient: recipient_id,
  //   recipient_fullname: message.recipient_fullname,
  //   channel_type: message.channel_type,
  //   app_id: app_id,
  //   timestamp: now
  // }
  
  // var savedMessage = outgoing_message
  // savedMessage.timelineOf = me
  // savedMessage.conversWith = convers_with
  // savedMessage.status = MessageConstants.CHAT_MESSAGE_STATUS.SENT
  // console.log("saving and forwarding message/conversation update:", savedMessage)
  // chatdb.saveOrUpdateMessage(savedMessage, function(err, msg) {
  //   console.log("error", err)
  //   const my_conversation_topic = 'apps.tilechat.users.' + me + '.conversations.' + convers_with
  //   let conversation = outgoing_message
  //   conversation.conversWith = convers_with
  //   conversation.is_new = false
  //   const conversation_payload = JSON.stringify(conversation)
  //   publish(exchange, my_conversation_topic, Buffer.from(conversation_payload), function(err) {
  //     if (err) {
  //       callback(false) // TODO message was already saved! What todo? Remove?
  //     }
  //     else {
  //       console.log("tessssss")
  //       chatdb.saveOrUpdateConversation(conversation, null)
  const message_payload = JSON.stringify(outgoing_message)
  publish(exchange, recipient_inbox, Buffer.from(message_payload), function(err, msg) {
    console.log("message", msg, "sent to recipient_inbox:", recipient_inbox, ", err:", err )
    if (recipient_id !== sender_id) {
      outgoing_message.status = MessageConstants.CHAT_MESSAGE_STATUS_CODE.SENT // it's better DELIVERED, but the client actually wants 100 to show the sent-checkbox
      const message_payload = JSON.stringify(outgoing_message)
      publish(exchange, sender_inbox, Buffer.from(message_payload), function(err, msg) {
        console.log("message", msg, "sent to sender_inbox:", sender_inbox, ", err:", err )
        callback(true)
      });
    }
    else {
      console.log("Recipient === Sender. Stopping to sender inbox")
      callback(true)
    }
  });
  
    //   }
    // });
  // })
}

// IMPORTANT: This handler only saves messages and creates conversations.
// Original messages were already delivered as-it-were (as they arrived here)
// to ALL the connected Clients, also subscribed to this same topic
function process_incoming(topic, message_string, callback) {
  var topic_parts = topic.split(".")
  // /apps/tilechat/users/ME/messages/CONVERS_WITH/incoming
  const app_id = topic_parts[1]
  const me = topic_parts[3]
  const convers_with = topic_parts[5]
  // const convers_with = sender_id
  // const me = recipient_id

  var incoming_message = JSON.parse(message_string)
  var savedMessage = incoming_message
  // const messageId = uuidv4();
  // savedMessage.message_id = messageId
  savedMessage.timelineOf = me
  savedMessage.conversWith = convers_with
  // savedMessage.status = MessageConstants.CHAT_MESSAGE_STATUS_CODE.DELIVERED
  
  console.log("saving incoming message:", savedMessage)
  chatdb.saveOrUpdateMessage(savedMessage, function(err, msg) {
    const my_conversation_topic = 'apps.tilechat.users.' + me + '.conversations.' + convers_with
    let conversation = incoming_message
    conversation.conversWith = convers_with // new!
    conversation.key = convers_with // retro comp
    conversation.is_new = true
    conversation.last_message_text = conversation.text // retro comp
    const conversation_payload = JSON.stringify(conversation)
    console.log("PUB CONV:", conversation_payload)
    publish(exchange, my_conversation_topic, Buffer.from(conversation_payload), function(err) {
      if (err) {
        callback(false) // TODO message was already saved! What todo? Remove?
      }
      else {
        chatdb.saveOrUpdateConversation(conversation, null)
        callback(true)
      }
    });
  })
}

function process_update(topic, message_string, callback) {
  var topic_parts = topic.split(".")
  console.log("UPDATE. TOPIC PARTS:", topic_parts, "payload:", message_string)
  if (topic_parts.length < 5) {
    console.log("process_update topic error.")
    callback(false)
    return
  }
  if (topic_parts[4] === "messages") {
    console.log(" MESSAGE UPDATE.")
    // 'apps.tilechat.users.*.messages.*.*.update'
    // 'apps/tilechat/users/USER_ID/messages/CONVERS_WITH/MESSAGE_ID/update'
    // message update, only status update actually supported
    const app_id = topic_parts[1]
    const user_id = topic_parts[3]
    const convers_with = topic_parts[5]
    const message_id = topic_parts[6]
    console.log("updating message:", message_id, "on convers_with", convers_with, "for user", user_id, "patch", message_string)
    
    const patch = JSON.parse(message_string)
    if (!patch.status || patch.status != 200) {
      callback(true)
      return
    }
    // If patched with "status = 200" then:
    // 1. Save message in my timeline with status = 200
    // 2. propagate "status = 250" to the symmetric message in recipient inbox

    // 1. SAVE MESSAGE ON MY TIMELINE
    // timelineOf: message.timelineOf, message_id: message.message_id
    const me = user_id
    const my_message_patch = {
      "timelineOf": me,
      "message_id": message_id,
      "status": patch.status // for the moment this is always = 200 (SENT)
    }
    const my_message_patch_payload = JSON.stringify(my_message_patch)
    console.log(">>> ON DISK... WITH A STATUS ON MY MESSAGE-UPDATE TOPIC", topic, "WITH PATCH", my_message_patch)
    chatdb.saveOrUpdateMessage(my_message_patch, function(err, msg) {
      console.log(">>> MESSAGE ON TOPIC", topic, "UPDATED!")
      if (err) {
        callback(false)
        return
      }
      // DISABLE BECAUSE NOT REALLY NECESSARY (FOR PERF) TO NOTIFY STATUS MODIFICATION TO THE ONE WHO COMMITED THE SAME MOD
      // const my_message_update_topic = 'apps.tilechat.users.' + me + '.messages.' + convers_with + '.' + message_id + '.clientupdate'
      // console.log(">>> NOW PUBLISHING... MY MESSAGE TOPIC UPDATE", my_message_update_topic, "WITH PATCH", my_message_patch)
      // publish(exchange, my_message_update_topic, Buffer.from(my_message_patch_payload), function(err) {
      //   console.log(">>> PUBLISHED!!!! MY MESSAGE TOPIC UPDATE", my_message_update_topic, "WITH PATCH", my_message_patch)
      //   if (err) {
      //     callback(false)
      //     return
      //   }
        const dest_message_patch = {
          "timelineOf": convers_with,
          "message_id": message_id,
          "status": MessageConstants.CHAT_MESSAGE_STATUS_CODE.RETURN_RECEIPT
        }
        const dest_message_patch_payload = JSON.stringify(dest_message_patch)
        console.log(">>> ON DISK... RECIPIENT MESSAGE ON DB WITH", dest_message_patch)
        chatdb.saveOrUpdateMessage(dest_message_patch, function(err, msg) {
          const recipient_message_update_topic = 'apps.tilechat.users.' + convers_with + '.messages.' + me + '.' + message_id + '.clientupdate'
          console.log(">>> NOW PUBLISHING... RECIPIENT MESSAGE TOPIC UPDATE", recipient_message_update_topic, "WITH PATCH", dest_message_patch)
          publish(exchange, recipient_message_update_topic, Buffer.from(dest_message_patch_payload), function(err) {
            console.log(">>> PUBLISHED!!!! RECIPIENT MESSAGE TOPIC UPDATE", recipient_message_update_topic, "WITH PATCH", dest_message_patch)
            if (err) {
              callback(false)
            }
            else {
              callback(true)
            }
          });
        });
      // });
    });
  }
  else if (topic_parts[4] === "conversations") {
    // conversation update, only is_new update actually supported
    // 'apps/tilechat/users/USER_ID/conversations/CONVERS_WITH/update'
    console.log(" CONVERSATION UPDATE.")
    const app_id = topic_parts[1]
    const user_id = topic_parts[3]
    const convers_with = topic_parts[5]
    console.log("updating conversation:", convers_with, "for user", user_id, "patch", message_string)
    
    const patch = JSON.parse(message_string)
    // 1. Patch my conversation: convers_with
    // 2. Publish the patch to my conversation: convers_with
    // 1. SAVE PATCH
    const me = user_id
    patch.timelineOf = me
    patch.conversWith = convers_with
    console.log(">>> ON DISK... CONVERSATION TOPIC", topic, "WITH PATCH", patch)
    chatdb.saveOrUpdateConversation(patch, function(err, doc) {
      console.log(">>> CONVERSATION ON TOPIC", topic, "UPDATED!")
      if (err) {
        callback(false)
        return
      }
      const patch_payload = JSON.stringify(patch)
      const my_conversation_update_topic = 'apps.tilechat.users.' + me + '.conversations.' + convers_with + '.clientupdate'
      console.log(">>> NOW PUBLISHING... MY CONVERSATION UPDATE", my_conversation_update_topic, "WITH PATCH", patch_payload)
      publish(exchange, my_conversation_update_topic, Buffer.from(patch_payload), function(err) {
        console.log(">>> PUBLISHED!!!! MY CONVERSATION UPDATE TOPIC", my_conversation_update_topic, "WITH PATCH", patch_payload, "err", err)
        if (err) {
          callback(false)
          return
        }
        else {
          callback(true)
        }
      });
    });
  }
}

function process_archive(topic, payload, callback) {
  // Ex. apps/tilechat/users/USER_ID/conversations/CONVERS_WITH/archive
  var topic_parts = topic.split(".")
  console.log("ARCHIVE. TOPIC PARTS:", topic_parts, "payload (ignored):", payload)
  if (topic_parts.length < 7) {
    console.log("process_archive topic error. topic_parts.length < 7:", topic)
    callback(true)
    return
  }
  if (topic_parts[4] === "conversations") {
    console.log("CONVERSATION ARCHIVE.")
    // 'apps.tilechat.users.*.messages.*.*.update'
    // 'apps/tilechat/users/USER_ID/messages/CONVERS_WITH/MESSAGE_ID/update'
    // message update, only status update actually supported
    const app_id = topic_parts[1]
    const user_id = topic_parts[3]
    const convers_with = topic_parts[5]
    console.log("archiving conversation:", convers_with, "for user", user_id, "payload", payload)
    const me = user_id
    conversation_archive_patch = {
      "timelineOf": me,
      "conversWith": convers_with,
      "archived": true
    }
    console.log(">>> ON DISK... ARCHIVE CONVERSATION ON TOPIC", topic)
    chatdb.saveOrUpdateConversation(conversation_archive_patch, function(err, msg) {
      console.log(">>> CONVERSATION ON TOPIC", topic, "ARCHIVED!")
      if (err) {
        callback(false)
        return
      }
      const conversation_archived_topic = 'apps.tilechat.users.' + user_id + '.conversations.' + convers_with + '.clientarchived'
      console.log(">>> NOW PUBLISHING... CONVERSATION ARCHIVED TOPIC", conversation_archived_topic)
      publish(exchange, conversation_archived_topic, Buffer.from(conversation_archive_patch), function(err) {
        console.log(">>> PUBLISHED!!!! CONVERSATION ON TOPIC", conversation_archived_topic, "ARCHIVED")
        if (err) {
          callback(false)
        }
        else {
          callback(true)
        }
      });
    });
  }
}


function closeOnErr(err) {
  if (!err) return false;
  console.error("[AMQP] error", err);
  amqpConn.close();
  return true;
}

var mongouri = process.env.MONGODB_URI || "mongodb://localhost:27017/chatdb";
var mongodb = require("mongodb");
// var ObjectID = mongodb.ObjectID;
// Create a database variable outside of the
// database connection callback to reuse the connection pool in the app.
var db;
console.log("connecting to mongodb...")
mongodb.MongoClient.connect(mongouri, { useNewUrlParser: true, useUnifiedTopology: true }, function (err, client) {
  if (err) {
    console.log(err);
    process.exit(1);
  } else {
    console.log("MongoDB successfully connected.")
  }
  db = client.db();
  // var port = process.env.PORT || 3000;
  // app.listen(port, () => {
  
  chatdb = new ChatDB({database: db})
  console.log('Starting observer.')
  startMQ();
  // });
});
