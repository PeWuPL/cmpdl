import request from 'request' // Used for HTTP requests
import * as colors from './colors.js' // Library for color formatting in console
import fs from 'fs-extra' // Manipulate files in OS
import * as unzipper from 'unzipper' // Unzip .zip files
import path from 'path' // Manipulate file paths
import * as crypto from 'crypto' // Get hash of file
const __dirname = path.resolve();
const auth = ""; // Auth key for authorizing requests on CurseForge
// Generic request send function
// method - POST, GET
// url - https://curseforge.com ...
// reqBody - request body to send
// altHeaders - additional headers for request

const sendRequest = (method,url,reqBody = {},altHeaders = {}) => { 
  return new Promise((res,rej) => {
    reqBody = JSON.stringify(reqBody); // Object smooshed in one liner
    let preHeaders = { // Headers potentially required
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36"
    };
    let headers = {...preHeaders,...altHeaders}; // Header combining

    let options = { // Basic object construction for request package to use
      headers,
      url:url,
      method:method
    }
    if(reqBody.length>0) { // Combine body with options, if body isn't empty
      options = {...options,...reqBody};
    }
    request(options,(err,response,body) => { // Send response to online server
      if(err) {
        console.error(err);
        rej(null);
      }
      res(body,response);
    })
  })
};
const write = (txt) => { // Simple stdout
  process.stdout.write(txt);
}
const cf = { // Basic library for communicating with curseforge's API
  getModUrl: (modId,fileId) => { // Get url of selected mod
		return new Promise((res,rej) => {
			sendRequest("GET",`https://api.curseforge.com/v1/mods/${modId}/files/${fileId}/download-url`,{},{"x-api-key":auth}).then(_ => {
				res(_);
			}).catch(e => {
				console.log(e);
				rej(e);
			})
		});
  },
	getModInfo: (modId,fileId) => { // Get mod details
		return new Promise((res,rej) => {
			let url = `https://api.curseforge.com/v1/mods/${modId}/files/${fileId}/`;
			sendRequest("GET",url,{},{"x-api-key":auth})
			.then(_ => {
				res(JSON.parse(_));
			}).catch(e => {
				console.log(e);
				console.log("PATH: "+url);
				rej(e)
			})
		});
	}
}
// Steps to make:
// Unzip
// Parse
//  Get info
//  Iterate over mods ID, save links to some array
// Create folder structure (in dest. directory)
// Download mods to 'mods'
// Copy contents of 'overrides' to modpack folder
// done.
write(colors.s.hide); // Hide cursor for convenience
if(auth=="") { // If authorization is empty
	write(`>>>${colors.f.lred} Auth key is empty. Set it to start downloading modpack.${colors.f.reset}\n`);
	process.exit();
}
let inputPath = ""; // ZIP file location
let outputPath = ""; // Directory output location
let modpackFiles = []; // Modpack's mod information
let args = process.argv; // Process' arguments

if(args.length <= 2) { // Exit when argument length doesn't match exit program and print error
	console.log(`${colors.f.lred}ERROR${colors.f.reset}: `
		+ colors.f.lblue
		+ "No input provided. See "+colors.f.lred+"-h"+colors.f.lblue+" for help."
		+ colors.f.reset);
	write(colors.s.show);
	process.exit(0);
}
for (let arg=2;arg<args.length;arg+=2) { // Argument parsing
	switch(args[arg]) {
		case "--help":
		case "-h": // Help
			if(args.length >3) {
				console.log(`${colors.f.red}ERROR${colors.f.reset}: Incorrect syntax.`);
				process.exit(0)
			}
		console.log(`${colors.f.lyellow}Usage${colors.f.reset}: index.js -i "${colors.f.lgreen}input.zip${colors.f.reset}" -o "${colors.f.lred}output/${colors.f.reset}"`)
	    console.log(`	${colors.f.lcyan}-h${colors.f.reset}, ${colors.f.lcyan}--help${colors.f.reset}	View this help`);
	    console.log(`	${colors.f.lcyan}-o${colors.f.reset}, ${colors.f.lcyan}--output${colors.f.reset}	Set modpack destination`);
	    console.log(`	${colors.f.lcyan}-i${colors.f.reset}, ${colors.f.lcyan}--input${colors.f.reset}	Set modpack zip file`);
		console.log(colors.s.show);
		process.exit(0);
		break;
		case "--input": // Set input file
		case "-i":
			try {
				// If input file exists, or input file in the same directory exists
				if(!fs.existsSync(args[arg+1])&&!fs.existsSync(__dirname+"/"+args[arg+1])) { 
					console.error("${colors.f.lred}ERROR${colors.f.reset}: Input path nonexistent.")
					write(colors.s.show);
					process.exit(0);
				}
				if(args.length==6) { // If syntax is correct, set input path
					inputPath = args[arg+1];
				}
				else {
					console.log("${colors.f.lred}ERROR${colors.f.reset}: Incorrect syntax.");
					write(colors.s.show);
					process.exit(0)
				}
			} catch (e) {
				console.error(e);
			}
		break;
	case "--output":
	case "-o":
	try {
		if(!fs.existsSync(args[arg+1])&&!fs.existsSync(__dirname+"/"+args[arg+1])) {
			console.error(`${colors.f.lred}ERROR${colors.f.reset}: Output directory nonexistent.`)
			write(colors.s.show);
			process.exit(0);
		}
		if(args.length==6) { // If syntax is correct
			outputPath = args[arg+1];
		}
		else {
			console.log("${colors.f.lred}ERROR${colors.f.reset}: Incorrect syntax.");
			write(colors.s.show);
			process.exit(0)
		}
	} catch (e) {
		console.error(e);
	}
	break;
	default:
		console.log(`${colors.f.lred}ERROR${colors.f.reset}: Unrecognized argument. See --help for help.`);
		write(colors.s.show);
		process.exit(0);
		break;
	}
}
if(path.extname(inputPath)!=".zip") {
	console.log("ERROR: Incorrect input file provided.")
	write(colors.s.show);
	process.exit(0)
}
// Create temporary directory for extracted contents
let tmpDir = __dirname+"/TEMP";
console.log("#".repeat(process.stdout.columns));
let text = `# ${colors.f.red}CMPDL - Curse ModPack Downloader v1${colors.f.reset} by PeWu`;
console.log(text+" ".repeat(8+process.stdout.columns-text.length)+"#");
console.log("#".repeat(process.stdout.columns));
if(!fs.existsSync(tmpDir)){
	write("Creating TEMP folder... ");
	fs.mkdirSync(tmpDir,{recursive:true});
	write("done.\n")
}
else {
	console.log("* TEMP folder exists.");
	write("	Purging TEMP directory... ")
	fs.rmSync(tmpDir, { recursive: true, force: true });
	fs.mkdirSync(tmpDir,{recursive:true});
	write("done.\n")
}
// Both paths are valid
const fetchModID = (filesMetadata) => { // GET MOD METADATA
	return new Promise(async(res,rej) => {
		for(var fileID in filesMetadata) {
			await cf.getModInfo(filesMetadata[fileID].projectID,filesMetadata[fileID].fileID).then(mf=>{
				let fileLength = parseInt(fileID)+1;
				fileLength = fileLength.toString().length;
				let statusString = `[${~~fileID+1}/${filesMetadata.length}] ${mf.data.fileName}${" ".repeat(process.stdout.columns-fileLength-12-(mf.data.fileLength/1024/1024).toFixed(2).length-mf.data.fileName.length)}(${(mf.data.fileLength/1024/1024).toFixed(2)} MB)`;
				let completionStage = Math.round(((~~fileID+1)/filesMetadata.length)*process.stdout.columns);
				//write(" ".repeat(process.stdout.columns)+"\r");
				write(colors.b.white+colors.f.black+statusString.substr(0,completionStage)+colors.b.reset+statusString.substr(completionStage)+"\r");
				//console.log(mf.data.hashes);
				if(mf.data.downloadUrl!=null) modpackFiles.push({fileName:mf.data.fileName,id:mf.data.modId,url:mf.data.downloadUrl,fileLength:mf.data.fileLength,displayName:mf.data.displayName,hashes:mf.data.hashes});
				else { // Fallback to most primitve way of calculating url. Well, it works.
					let mfUrl = `https://edge.forgecdn.net/files/${filesMetadata[fileID].fileID.toString().substr(0,4)}/${filesMetadata[fileID].fileID.toString().substr(4)}/${mf.data.fileName}`
					modpackFiles.push({fileName:mf.data.fileName,id:mf.data.modId,url:mfUrl,fileLength:mf.data.fileLength,displayName:mf.data.displayName,hashes:mf.data.hashes});
				}
			}).catch(e=>{
				write(colors.f.lred+"HTTP request failed. Reason: "+e+"\n");
				fileID-=1;
			});
		}
		res();
	})
}
const installMods = (list,output) => {
	return new Promise(async (res,rej) => {
		for (var modData in list) {
			await new Promise(nxt => {
				let untouchable = false; // Flag for avoiding overwriting valid files
				let fileSize = `(${(list[modData].fileLength/1024/1024).toFixed(2)} MB)`;
				let statusString = `[${~~modData+1}/${list.length}] Downloading ${list[modData].fileName} ...`;
				statusString = statusString+" ".repeat(process.stdout.columns-statusString.length-fileSize.length)+fileSize;
				let completionStage = Math.round(((~~modData+1)/list.length)*process.stdout.columns);
				if(fs.existsSync(output+`/mods/${list[modData].fileName}`)) { // If file exists
					let fileBuffer = fs.readFileSync(output+`/mods/${list[modData].fileName}`);
					let hash = crypto.createHash("md5");
					hash.update(fileBuffer);
					let hex = hash.digest("hex");
					// If hashes match, then omit downloading
					if(list[modData].hashes[1].algo==2&&list[modData].hashes[1].value==hex) { 
						write("\r");
						write(list[modData].fileName+" ".repeat(process.stdout.columns-list[modData].fileName.length-"valid".length)+colors.f.lgreen+"valid"+colors.f.reset+"\n");
						untouchable=true;
						nxt();
					}
					else {
						write("\r");
						write(list[modData].fileName+" ".repeat(process.stdout.columns-list[modData].fileName.length-"invalid".length)+colors.f.red+"invalid"+colors.f.reset+"\n");
					}
				}
				
				write(colors.b.white+colors.f.black+statusString.substr(0,completionStage)+colors.b.reset+statusString.substr(completionStage)+"\r");
				if(untouchable==false) {
					let file = fs.createWriteStream(output+`/mods/${list[modData].fileName}`);
					try {
						let stream = request({
							/* Here you should specify the exact link to the file you are trying to download */
							uri: list[modData].url,
							headers: {
								'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
								'Accept-Encoding': 'gzip, deflate, br',
								'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8,ro;q=0.7,ru;q=0.6,la;q=0.5,pt;q=0.4,de;q=0.3',
								'Cache-Control': 'max-age=0',
								'Connection': 'keep-alive',
								'Upgrade-Insecure-Requests': '1',
								'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/68.0.3440.106 Safari/537.36'
							},
							/* GZIP true for most of the websites now, disable it if you don't need it */
							gzip: true
						})
						.pipe(file)
						.on('finish',() => {
							//write("\r");
							//write(modData+" "+list[modData].fileName+" ".repeat(process.stdout.columns-modData.length-1-list[modData].fileName.length-"done".length)+colors.f.lgreen+"done"+colors.f.reset+"\n");
							nxt();
						})
						.on('error',(e) => {
							write(" ".repeat(process.stdout.columns)+"\r");
							write(list[modData].fileName+" ".repeat(process.stdout.columns-list[modData].fileName.length-"fail".length)+colors.f.red+"fail"+colors.f.reset+"\n");
							modData-=1;
							file.end();
							nxt();
						})
					}
					catch (e) {
						write(" ".repeat(process.stdout.columns)+"\r");
						write(list[modData].fileName+" ".repeat(process.stdout.columns-list[modData].fileName.length-"fail".length)+colors.f.red+"fail"+colors.f.reset+"\n");
						modData-=1;
						file.end();
						nxt();
					}
				}
				else {
					nxt();
				}
			});
			continue;
		}
		res();
	}).catch(error => {
    console.error(`Something happened: ${error}`);
		write(colors.s.show);
		process.exit();
	});
}
try {
	write(`* Extracting zipfile to TEMP directory... `);
	let extract = fs.createReadStream(inputPath).pipe(unzipper.Extract({path:tmpDir}));
	extract.on('finish',() => {
		write("done.\n");
		// Create folders for modpack
		console.log("* Preparing destination directories...");
		if(!fs.existsSync(outputPath+"/mods")){
			write("	Creating mods folder... ");
			fs.mkdirSync(outputPath+"/mods",{recursive:true});
			write("done.\n")
		}
		else write("	Folder mods existing.		Done.\n")
		if(!fs.existsSync(outputPath+"/config")){
			write("	Creating config folder... ");
			fs.mkdirSync(outputPath+"/config",{recursive:true});
			write("done.\n")
		}
		else write("	Folder config existing.		Done.\n")
		if(!fs.existsSync(outputPath+"/scripts")){
			write("	Creating scripts folder... ");
			fs.mkdirSync(outputPath+"/scripts",{recursive:true});
			write("done.\n")
		}
		else write("	Folder scripts existing.	Done.\n")
		if(!fs.existsSync(outputPath+"/resources")){
			write("	Creating resources folder... ");
			fs.mkdirSync(outputPath+"/resources",{recursive:true});
			write("done.\n")
		}
		else write("	Folder resources existing.	Done.\n")
		write("* Parsing info from manifest.json ... ");
		let manifest = fs.readFileSync(tmpDir+"/manifest.json",{encoding:"utf8",flag:"r"});
		write("done.\n");
		manifest = JSON.parse(manifest);
		//console.log(manifestRaw);
		console.log(`MINECRAFT: `);
		console.log(`	Version: ${manifest.minecraft.version}`);
		console.log(`	Loaders: `);
		for(let loader of manifest.minecraft.modLoaders) {
			console.log(`		${loader.id} ${loader.primary ? "PRIMARY" : "AUX"}`);
		}
		console.log("MODPACK: ");
		console.log(`	Author: ${manifest.author}`);
		console.log(`	Name: ${manifest.name}`);
		console.log(`	Version: ${manifest.version}`);
		console.log(`Fetching mod info...`);
		console.log("=".repeat(process.stdout.columns))
		fetchModID(manifest.files).then(_ => {
			write(" ".repeat(process.stdout.columns)+"\r")
			console.log(`Total ${modpackFiles.length} mods to install. Downloading... `);
			console.log("#".repeat(process.stdout.columns))
			installMods(modpackFiles,outputPath).then(_=> {
				write(" ".repeat(process.stdout.columns)+"\r")
				console.log("Done downloading. Copying overrides...");
				console.log("/".repeat(process.stdout.columns))
				fs.copySync(tmpDir+"/overrides",outputPath+"/",{overwrite:true},(e) => {
					if(e) {
						console.error(e);
						write(colors.s.show);
						process.exit(0);
					}
					console.log("Modpack completed. Finishing program.\n");
					write(colors.s.show);
					process.exit(0)
				})
			});
		});
	})
} catch (e) {
	console.error(e);
	write(colors.s.showCursor);
	process.exit(0)
}
process.on("SIGINT", ()=>{
	write(" ".repeat(process.stdout.columns));
	write("\r"+colors.s.show);
	console.log(`${colors.f.lcyan}Ctrl+C detected. Closing program.${colors.f.reset}`);
	process.exit();
});
