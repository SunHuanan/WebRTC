var express = require('express'),
	app = express(),
	server = require('http').createServer(app);
var http = require('http').Server(app);
var path = require("path");
//pour obtenir le contenu de post, il faut ajouter ce module;
var bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({
	extended: false
}));
app.use(bodyParser.json());


app.use(express.static(path.join(__dirname, 'public')));
server.listen(80);


app.get('/', function(req, res) {
	res.sendfile(__dirname + '/web.html');
});


var onlineUsers = {};
var onlineCount = 0;
var rooms = {};
var roomNum = 0;
var count = 0;

//configurer "cross-domain access"
app.all('*', function(req, res, next) {
	res.header("Access-Control-Allow-Origin", "*");
	res.header("Access-Control-Allow-Headers", "X-Requested-With");
	res.header("Access-Control-Allow-Methods", "PUT,POST,GET,DELETE,OPTIONS");
	res.header("X-Powered-By", ' 3.2.1')
	res.header("Content-Type", "application/json;charset=utf-8");
	next();
});

app.get('/', function(req, res) {
	res.sendfile(__dirname + '/webrtc.html');
});
//test
app.get('/demande', function(req, res) {
	var list = "userlist";
	console.log("on a cree un list : " + list);
	res.send(JSON.stringify({
		"answer": "agree"
	}));
});
//recevoir la demande de userlist de client, 
//envoyer la liste a client
app.get('/userList', function(req, res) {

	res.send(JSON.stringify({
		"onlineUsers": onlineUsers
	}));
});
//envoyer la description du but
app.get('/getotherSDP/:telephone', function(req, res) {
	var telephone = req.params.telephone;
	console.log("demande number " + telephone);
	for (key in rooms) {
		if (rooms[key].caller.telephone == telephone || rooms[key].responder.telephone == telephone) {

			var object = (rooms[key].caller.telephone == telephone) ? rooms[key].responder : rooms[key].caller;
			console.log("but sdp " + object.sdp);
			if (object.sdp != "") {
				res.send(JSON.stringify({
					"sdp": object.sdp
				}));
			} else {
				res.send(JSON.stringify({
					"sdp": ""
				}));
			}

		}
	}

});

app.get('/getCandidate/:telephone', function(req, res) {
	var telephone = req.params.telephone;
	console.log("getcandidate number " + telephone);
	for (key in rooms) {
		if (rooms[key].caller.telephone == telephone || rooms[key].responder.telephone == telephone) {

			var object = (rooms[key].caller.telephone == telephone) ? rooms[key].responder : rooms[key].caller;

			if (object.candidate != "") {
				res.send(JSON.stringify({
					"candidate": object.candidate
				}));
				object.candidate = "";
			} else {
				res.send(JSON.stringify({
					"candidate": ""
				}));
			}

		}
	}

});

app.get('/closeRoom/:telephone', function(req, res) {
	var telephone = req.params.telephone;

	for (key in rooms) {
		if (rooms[key].caller.telephone == telephone || rooms[key].responder.telephone == telephone) {
			delete rooms[key];
			console.log("delete the room");
		}
	}

});
//envoyer les infos de la demande des autre a client
app.get('/videoChat/:telephone', function(req, res) {

	var telephone = req.params.telephone;
	var hasProp = false;
	for (var prop in rooms) {
		hasProp = true;
		break;
	}
	if (!hasProp) {
		res.send(JSON.stringify({
			"rooms": "nochat"
		}));
	} else {
		for (key in rooms) {

			//console.log(telephone+"==="+rooms[key].telephone1+"==="+rooms[key].telephone2);
			if (rooms[key].responder.telephone == telephone) {
				if (rooms[key].responder.status != "ready") {
					res.send(JSON.stringify({
						"owner": "responder",
						"rooms": rooms[key],
						"roomNum": key
					}));
				} else {
					res.send(JSON.stringify({
						"rooms": "inchat"
					}));
				}

			} else if (rooms[key].caller.telephone == telephone) {
				if (rooms[key].caller.status != "ready") {
					res.send(JSON.stringify({
						"owner": "caller",
						"rooms": rooms[key],
						"roomNum": key
					}));
				} else {
					res.send(JSON.stringify({
						"rooms": "inchat"
					}));
				}

			} else {
				res.send(JSON.stringify({
					"rooms": "nochat"
				}));
			}
		}

	}

});

//recevoir la demande d'inscription de client, 
//ajouter ce client dans la liste de clients
app.post('/adduser', function(req, res) {

	console.log(req.body.telephone);
	onlineUsers[onlineCount] = req.body.telephone;
	res.send(JSON.stringify({
		"answer": "success login"
	}));
	onlineCount++;
});

//ajouter le description du caller
app.post('/callerAddSDP', function(req, res) {

	console.log(req.body.caller + "===" + req.body.sdp);
	for (key in rooms) {
		if (rooms[key].caller.telephone == req.body.caller) {
			rooms[key].caller.sdp = req.body.sdp;
			rooms[key].caller.status = "ready";
		}
	}
	res.send(JSON.stringify({
		"answer": "success add sdp"
	}));

});

//ajouter les infos des deux candidtatuers
app.post('/addCandidate', function(req, res) {
	var telephone = req.body.caller;
	console.log(req.body.caller + "===" + req.body.candidate);
	for (key in rooms) {
		if (rooms[key].caller.telephone == telephone || rooms[key].responder.telephone == telephone) {
			var object = (rooms[key].caller.telephone == telephone) ? rooms[key].caller : rooms[key].responder;
			object.candidate[count] = req.body.candidate;
			console.log("add a candidate");
		}
	}
	count++
	res.send(JSON.stringify({
		"answer": "success add candidate"
	}));

});

//ajouter le description du responder
app.post('/respondAddSDP', function(req, res) {

	console.log(req.body.roomNum + "===" + req.body.sdp);
	rooms[req.body.roomNum].responder.status = "ready";
	rooms[req.body.roomNum].responder.sdp = req.body.sdp;

	res.send(JSON.stringify({
		"answer": "success add sdp"
	}));

});

//transferer la demande a server
app.post('/call', function(req, res) {

	console.log(req.body);
	var isInChat = false;
	//TODO:ajouter la contrainte pour verifier s'ils sont dans le video chat
	for (key in rooms) {
		if (rooms[key].caller.telephone == req.body.caller || 
			rooms[key].responder.telephone == req.body.caller ||
			rooms[key].caller.telephone == req.body.responder ||
			rooms[key].caller.telephone == req.body.responder) {
			isInChat = true;
		}
	}

	if (isInChat) {
		res.send(JSON.stringify({
			"answer": "someone is in the videochat, cannot be called"

		}));
	} else {
		rooms[roomNum] = {
			"caller": {
				"telephone": req.body.caller,
				"status": "",
				"sdp": "",
				"candidate": {}
			},
			"responder": {
				"telephone": req.body.responder,
				"status": "",
				"sdp": "",
				"candidate": {}
			}

		}

		res.send(JSON.stringify({
			"answer": "call received by server,created a room"

		}));
		roomNum++;

	}


});
