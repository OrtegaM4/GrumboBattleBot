//Initialize Discord Bot
var Discord = require('discord.js');
var auth = require('./auth.json');
const client = new Discord.Client();

//Config
let config = require('./config.js');

//Initialize DB functions
let dbfunc = require('./data/db.js');

//Initialize game functions
let state = require('./state.js');
let battlefunc = require('./command/battle.js');
let challengefunc = require('./command/challenge.js');
let itemsfunc = require('./command/items.js');
let shopfunc = require('./command/shop.js');
let activefunc = require('./command/actives.js');
let enemyfunc = require('./command/enemy.js');

//Text
let fs = require('fs');
let help = fs.readFileSync("./text/help.txt", "utf8");
let help2 = fs.readFileSync("./text/help2.txt", "utf8");
let guide = fs.readFileSync("./text/guide.txt", "utf8");
let guide2 = fs.readFileSync("./text/guide2.txt", "utf8");
let guide3 = fs.readFileSync("./text/guide3.txt", "utf8");
let patchnotes = fs.readFileSync("./text/patchnotes.txt", "utf8");

let requestTimes = {}; //Store character request times so they can't request more than once every 1 second

client.on("ready", () => {
	
	// This event will run if the bot starts, and logs in, successfully.
	console.log(`Bot has begun battle, with ${client.users.size} users, in ${client.channels.size} channels of ${client.guilds.size} guilds.`); 

	// What the bot is playing
	client.user.setActivity(`Battling ${client.users.size} dudes in ${client.guilds.size} servers`);

	//Could be long, should do on startup
	shopfunc.initWeighedArrays();
	battlefunc.initWeighedArrays();
	
	dbfunc.connectToServer(function(error){
		
		listen();
	});
});

/**
* Listen for commands.
*/
function listen(){

	client.on("message", async message => {
		
		// Ignore self
		if(message.author.bot) return;
		
		// Our bot needs to know if it will execute a command
		// It will listen for messages that will start with `!grumbo`
		if(message.content.substring(0, config.COMMAND.length) == config.COMMAND){
			
			var lastRequest = requestTimes[message.author.id];
			var currentTime = new Date().getTime();
			if(lastRequest == null || (lastRequest != null && lastRequest + 750 < currentTime)){
			
				requestTimes[message.author.id] = currentTime;
				dbfunc.getDB().collection("characters").findOne({"_id": message.author.id}, function(err, character){
					
					//If character doesn't exist
					if(character == null){
						
						dbfunc.createNewCharacter(message, function(error){
			
							parseCommand(message);
						});
					}
					else{
						
						parseCommand(message);
					}
				});
			}
			else{
				
				//Don't allow requests from same person too quickly (1 every 0.75 seconds)
				return;
			}
		 }
		 else{
			 
			 //Ignore all other messages that don't begin with the !grumbo prefix
			 return;
		 }
	});
}

/**
* Parses command.
*/
function parseCommand(message){
	
	//Get character
	dbfunc.getDB().collection("characters").findOne({"_id": message.author.id}, function(err, character){
		
		var args = message.content.split(' ');
	
		/////////////////////
		// !! HELP MENU !! //
		/////////////////////
		if(args[1] == 'help' && (args.length == 2 || (args.length == 3 && args[2] == '-d'))){
		
			//DM user
			var sender = message.author;
			if(args.length == 3){
				
				//Message channel
				sender = message.channel;
			}
			sender.send(help);
			sender.send("\n" + help2);
		}
		
		///////////////////////
		// !! PATCH NOTES !! //
		///////////////////////
		else if(args[1] == 'patchnotes' && (args.length == 2 || (args.length == 3 && args[2] == '-d'))){
			
			//DM user
			var sender = message.author;
			if(args.length == 3){
				
				//Message channel
				sender = message.channel;
			}
			sender.send(patchnotes);
		}
		
		/////////////////
		// !! GUIDE !! //
		/////////////////
		else if(args[1] == 'guide' && (args.length == 2 || (args.length == 3 && args[2] == '-d'))){
			
			//DM user
			var sender = message.author;
			if(args.length == 3){
				
				//Message channel
				sender = message.channel;
			}
			sender.send(guide);
			sender.send("\n" + guide2);
			sender.send("\n" + guide3);
		}
		
		/////////////////
		// !! STATS !! //
		/////////////////
		else if(args[1] == 'stats'){
			
			displayStats(character, message, args);
		}
		
		////////////////////////
		// !! LEADERBOARDS !! //
		////////////////////////
		else if(args[1] == 'leaderboards'){
			
			displayLeaderboards(message, args);
		}
		
		//////////////////////////
		// !! ACTIVE EFFECTS !! // 
		//////////////////////////
		else if(args[1] == 'actives'){
			
			activefunc.commandActives(character, message, args);
		}
		
		//////////////////////
		// !! ENEMY INFO !! // 
		//////////////////////
		else if(args[1] == 'enemy'){
			
			enemyfunc.commandEnemy(character, message, args);
		}
		
		/////////////////
		// !! ITEMS !! //
		/////////////////
		else if(args[1] == 'items'){
			
			itemsfunc.commandItems(message, args, character);
		}
		
		/////////////////
		// !! ITEMS !! //
		/////////////////
		else if(args[1] == 'shop'){
			
			shopfunc.commandShop(message, args, character);
		}
		
		//////////////////
		// !! BATTLE !! //
		//////////////////
		else if(args[1] == 'battle'){
			
			battlefunc.commandBattle(message, args, character);
		}
		
		/////////////////////
		// !! CHALLENGE !! //
		/////////////////////
		else if(args.length == 5 && args[1] == 'challenge'){
			
			challengefunc.commandChallenge(message, args, character);
		}
		
		// Bad command
		else{
			
			message.channel.send('Invalid Grumbo command. Type !grumbo help to see a list of commands.');
		}
	 });
}

/**
* Display stats. Also calculate how many battles you currently have.
*/
function displayStats(character, message, args){
	
	if(args.length == 2 || (args.length == 3 && args[2] == '-d')){
		
		//DM user
		var sender = message.author;
		if(args.length == 3){
			
			//Message channel
			sender = message.channel;
		}
		
		//Determine how many battles they should have left
		var date = new Date();
		var currentTime = date.getTime();
		battlefunc.restockBattles(currentTime, character);
		
		//Determine how many challenges they should have left
		challengefunc.restockChallenges(currentTime, character);
		
		var username = message.member.displayName;
		var statsString = username + " Lv" + character.level + " with " + character.experience + " EXP  |  " + character.gold + " Gold"
						+ "\nBattle          Wins " + character.wins + "  |  Losses " + character.losses + "  |  Win% " + character.winrate
						+ "\nChallenge  Wins " + character.challengeWins + "  |  Losses " + character.challengeLosses + "  |  Win% " + character.challengeWinrate
						+ "\nYou have " + character.battlesLeft + "/3 battles left"
						+ "\nYou have " + character.challengesLeft + "/3 challenges left";
		if(character.battlesLeft < 3){
			
			var timeUntilNextBattleInMinutes = Math.ceil((character.battletime + 3600000 - currentTime)/60000);
			statsString = statsString + "\nYou will gain another battle chance in " + timeUntilNextBattleInMinutes + " minutes";
		}
		if(character.challengesLeft < 3){
			
			var timeUntilNextChallengeInMinutes = Math.ceil((character.challengetime + 3600000 - currentTime)/60000);
			statsString = statsString + "\nYou will gain another challenge in " + timeUntilNextChallengeInMinutes + " minutes";
		}
		sender.send(statsString);

		//Save battle results
		dbfunc.updateCharacter(character);
	}
	else{
		
		message.channel.send("Bad stats command. Try '!grumbo help' for the correct command.");
	}
}

/**
* Display leaderboards. Sorts by level, then by experience.
*/
function displayLeaderboards(message, args){
	
	if(args.length == 2 || (args.length == 3 && args[2] == '-d')){
	
		dbfunc.getDB().collection("characters").find().toArray(function(err, characters){
					
			//DM user
			var sender = message.author;
			if(args.length == 3){
				
				//Message channel
				sender = message.channel;
			}
			
			//Sort based on level first, then experience
			characters.sort(function(a, b){
				var keyA = a.level,
					keyB = b.level,
					xpA = a.experience,
					xpB = b.experience;
					
				//Compare the users
				if(keyA < keyB) return 1;
				if(keyA > keyB) return -1;
				if(xpA < xpB) return 1;
				if(xpA > xpB) return -1;
				return 0;
			});
			
			var leaderboards = "------LEADERBOARDS------\n\n"
			var count = 1;
			characters.forEach(function(sortedCharacter){
				
				//Only show people in the server
				if(message.guild.members.get(sortedCharacter._id) != undefined){
					
					leaderboards = leaderboards + "[" + count + "] " + message.guild.members.get(sortedCharacter._id).displayName + "   Lv" + sortedCharacter.level + "  |  " 
						+ sortedCharacter.experience + " EXP  |  " + sortedCharacter.gold + " Gold"
						+ "\n       Battle          Wins " + sortedCharacter.wins + "  |  Losses " + sortedCharacter.losses + "  |  Win% " + sortedCharacter.winrate
						+ "\n       Challenge  Wins " + sortedCharacter.challengeWins + "  |  Losses " + sortedCharacter.challengeLosses + "  |  Win% " + sortedCharacter.challengeWinrate + "\n";
					count += 1;
				}
			});
			leaderboards = leaderboards + "\n--------------------------------"
			sender.send(leaderboards);
		});
	}
	else{
		
		message.channel.send("Bad leaderboards command. Try '!grumbo help' for the correct command.");
	}
}

/**
* Determines if x is an integer.
*/
function isInteger(x){
	
	return !isNaN(x) && (x % 1 === 0);
}

client.login(auth.token);