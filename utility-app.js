const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const url = require('url');
const querystring = require('querystring');
const port = 3000;
const http = require('http');
const https = require('https');
const nodemailer = require('nodemailer');
const fs = require('fs');
const appVersion = "1.0";

app.listen(port, () => {  console.log(`Utility app listening at http://<domain>:${port} - Options include: test, email, relay, filesave, version`)});

app.use(bodyParser.urlencoded({ extended: true }));

app.get('/utility', (req, res) => {

    //Process based off of action
    var url_parts = url.parse(req.url, true);
    var query = url_parts.query;
    var action = query.action;
    switch (action) {
        case "fileget":
            actionFileGet(req, res);
            break;
        case "relay":
            actionRelay(req, res);
            break;
        case "version":
            actionVersion(req, res);
            break;
        default:
            actionTest(req, res);
            break;
    };
});

app.post('/utility', (req, res) => {

    //Process based off of action
    var url_parts = url.parse(req.url, true);
    var query = url_parts.query;
    var action = query.action;
    switch (action) {
        case "filesave":
            actionFileSave(req, res);
            break;
        case "email":
            actionEmail(req, res);
            break;
        default:
            actionTest(req, res);
            break;
    };
});

app.post('/filesave', (req, res) => {

    //The filesave handler
    actionFileSave(req, res);

})

app.get('/fileget', (req, res) => {
     //Get file contents from handler
     actionFileGet(req, res);
})

app.get('/version', (req, res) => {
     //Get all the version info from handler
     actionVersion(req, res);
})

app.post('/email', (req, res) => {
     //Send it to the Email handler
     actionEmail(req, res);
})

  //Recieve relay call
app.get('/relay', async function(req, res) {
     //Relay request to handler
     actionRelay(req, res);
});

//Recieve test call
app.get('/test', async function(req, res) {
    //Test handler - it's live
    actionTest(req, res);
});

//Handler for test transaction
function actionTest(req, res) {
    //End point for testing this
    console.log("Doing Test Transaction");
    res.send('Test Completed Successfully - Version: ' + appVersion + ' app listening at http://<domain>:' + port + " Time: " + TimeStamp(Date())); 
}

//Handler to send emails
function actionEmail(req, res) {

    //Send out email - acting as an HTTP --> SMTP email relay
    var emailToSend = req.body;
    if (emailToSend.from && emailToSend.to && emailToSend.subject && emailToSend.message) {

        //All good, continue on
        let transport = nodemailer.createTransport({
            host: 'smtp.landsend.com',
            port: 25
        });
    
        const message = {
            from: emailToSend.from, // Sender address
            to: emailToSend.to,         // List of recipients
            subject: emailToSend.subject, // Subject line
            text: emailToSend.message // Plain text body
        };
        
        transport.sendMail(message, function(err, info) {
            if (err) {
              console.log(err)
              res.send("Failed");
            } else {
              //console.log(info);
              res.send("Success");
            }
        });

    }
    else {
        console.log("Invalid request");
        res.send("Invalid Request");
    } 
}

//Handler to save off files
function actionFileSave(req, res) {

    //Here save off a file, usually used for configuration files in Alvis Timeff
    try {
        var fileToSave = req.body;
        if (fileToSave.filename && fileToSave.contents) {
            var filePath = "OrgKeys/" + fileToSave.filename;
            var fileContents = fileToSave.contents;

            //If already exists, back it up
            var backUp = 'not needed';
            try {
                if (fs.existsSync(filePath)) {
                    //file exists - back it up
                    var backupPath = filePath + "." + TimeStamp(Date());
                    fs.copyFileSync(filePath, backupPath);
                    console.log("Backed up file: " + backupPath);
                    //File copied
                    backUp = 'success';
                }
            } catch(err) {
                console.error(err);
                res.send(err);
                backUp = 'failed';
            }

            //And now save the file
            if (backUp == 'not needed' || backUp == 'success') {
                const data = fs.writeFileSync(filePath, fileContents);
                //file written successfully
                console.log("Wrote file: " + filePath);
                res.send("200 - Success");
            }
            else {
                //Something failed..abort
                console.log("Strange error in saveing file: " + backUp);
            }
        }
        else {
            res.send("400 - Bad Request");
        }     
    } catch (err) {
        console.error(err);
        res.send(err);
    }
}

//Handler to get a file and deliver contents
function actionFileGet(req, res) {

    //Here get a file, usually used for configuration files in Alvis Time
    try {
        var url_parts = url.parse(req.url, true);
        var query = url_parts.query;
        var fileToGet = query.filename;
        console.log("FILE IS:", fileToGet);
        if (fileToGet) {
            var filePath = "OrgKeys/" + fileToGet;

            //And now get the file
            fs.readFile(filePath, 'utf8' , (err, data) => {
                if (err) {
                    res.send(err);
                    return;
                }
                //We got it
                console.log("Got file: " + filePath);
                res.send(data);
            });
        }
        else {
            res.send("400 - Bad Request");
        }     
    } catch (err) {
      console.error(err);
      res.send(err);
    }
}

//Handler to get version
function actionVersion(req, res) {
    //Here we fire off requests to get all of the version information for the requesting domain
    var url_parts = url.parse(req.url, true);
    var query = url_parts.query;
    if (query) {
        if (query.domain) {
            //OK, here we go - this will process the request
            getWebSiteInfo(query.domain, res);
        }
        else {
            res.send("Invalid Domain");
        }
    }
    else {
        res.send("Invalid Request");
    }
}

//Handler to relaty HTTP requests
function actionRelay(req, res) {

    //Relay handler - acts like a proxy - will relay requests and pass back results
    var url_parts = url.parse(req.url, true);
    var query = url_parts.query;
    if (query) {
        if (query.relayURI) {
            //Get the page/response and pass response object to send it
            getPage(query.relayURI, res, "return-page", null, null, null);
        }
    }   
}

//HTTP call for loading a page
function getPage(myURL, responseObject, action, actionObject, actionObjects, inputCookie) {

    var sleepCount = 0;
    var blnDone = false;
    var responseString = "Not Loaded"; 
    var options = {
        hostname: "",
        port: "",
        path: "",
        method: '',
        protocol: "",
        headers: {
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.8',
            'Connection': 'keep-alive',
            'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/53.0.2785.116 Safari/537.36'
          }
    };

    parseURL(myURL, options);

    if (inputCookie) {
        options.headers.cookie = inputCookie;
    }

    callback = function(response) {
        var str = '';
    
        //another chunk of data has been received, so append it to `str`
        response.on('data', function (chunk) {
            str += chunk;
        });
    
        //the whole response has been received, so we just print it out here
        response.on('end', function () {
            if (response.statusCode == 302 || response.statusCode == 301) {
                //Handle the redirect
                getPage(response.headers.location, responseObject, action, actionObject, actionObjects, response.headers["set-cookie"]);
            }
            else 
            {
                if (response.statusCode == 200) {
                    responseString = str;
                }
                else {
                    responseString = response.statusCode + " = " + response.statusMessage;
                }
                if (action == "return-page") {
                    responseObject.send(responseString);
                }
                else {
                    if (action == "version") {
                        actionObject.value = getVersion(responseString);
                        actionObject.done = true;
                        if (allDone(actionObjects)) {
                            buildAndSendVersionInfo(responseObject, actionObjects);
                        }
                    }
                }
            }

        });
    }
    if (options.protocol == "https:") {
        https.request(options, callback).end();
    }
    else {
        http.request(options, callback).end();
    }

}

//Splits up the URL to pull out our fields
function parseURL(inputURL, options) {

    var workingURI = "";
    var urlPieces;
    var hostPortPieces;
    workingURI = inputURL;

    //Default protocol is http and port 80
    options.protocol = "http:";
    options.port = "80";

    if (workingURI.includes("https://")) {
        options.port = "443";
        options.protocol = "https:";
        workingURI = workingURI.replace("https://", "");
    }
    else {
        if (workingURI.includes("http://")) {
            workingURI = workingURI.replace("http://", "")
        }
    }
    urlPieces = workingURI.split("/");
    options.hostname = urlPieces[0];
    if (urlPieces[1]) {
        var i;
        options.path = "";
        for (i = 1; i < urlPieces.length; i++) {
            options.path = options.path + "/" + urlPieces[i];
        }
    }
    else {
        options.path = "/";
    }

    if (options.hostname.includes(":")) {
        //We have port also
        hostPortPieces = options.hostname.split(":");
        options.hostname = hostPortPieces[0];
        options.port = hostPortPieces[1];
    }

}

//Get all of the version info for the domain
function getWebSiteInfo(domain, responseObject) {

    //This is matrics of versions and their values and URLs
    var versions = [
        {"name": "current_release_version", "value": "(unknown)", "url": "", "done": true},
        {"name": "ic_content_display_web_version_product", "value": "{'status': 'Getting....'}", "url": "https://_DOMAIN_/api/info", "done": false},
        {"name": "ic_content_display_web_version_basket", "value": "{'status': 'Getting....'}", "url": "https://_DOMAIN_/co/api/info", "done": false},
        {"name": "ic_web_tar_version", "value": "Getting....", "url": "https://_DOMAIN_/co/account/login", "done": false},
        {"name": "ic_servlet_filters_version", "value": "(not done - only on server)", "url": "", "done": true},
        {"name": "le_web_be_megalith_cd_version", "value": "(not done - only on server)", "url": "", "done": true},
        {"name": "le_web_be_megalith_pd_version", "value": "(not done - only on server)", "url": "", "done": true},
        {"name": "ic_web_fe_secure_checkout_version", "value": "Getting....", "url": "https://_DOMAIN_/secure-checkout/start", "done": false},
        {"name": "bcc_chai_version", "value": "(not done - only on server)", "url": "", "done": true},
        {"name": "ic_mqwrapper_version", "value": "(not done - only on server)", "url": "", "done": true},
        {"name": "bcc_pmos_version", "value": "(not done - only on server)", "url": "", "done": true},
        {"name": "le_web_be_megalith_pub_version", "value": "(not done - only on server)", "url": "", "done": true},
        {"name": "ic_inventory_version", "value": "(not done - only on server)", "url": "", "done": true},
        {"name": "ic_storelocator_version", "value": "(not done - only on server)", "url": "", "done": true},
        {"name": "ic_web_front_end_version_pdp", "value": "Getting....", "url": "https://_DOMAIN_/products/mens-short-sleeve-super-soft-supima-polo-shirt-with-pocket/id_248708", "done": false},
        {"name": "ic_web_front_end_version_pmp", "value": "Getting....", "url": "https://_DOMAIN_/shop/mens-polo-shirts-tops/S-xfe-xez-y5b-yqm-xec?cm_re=lec-_-mns-_-global-_-glbnv-polo-shirts-_-20160316-_-txt", "done": false},
        {"name": "ic_web_front_end_version_basket", "value": "Getting....", "url": "https://_DOMAIN_/shopping-bag", "done": false},
        {"name": "ic_web_front_end_version_myaccount", "value": "Getting....", "url": "https://_DOMAIN_/co/account/login", "done": false},
        {"name": "ic_cgi_new_tar_version", "value": "Coming....", "url": "", "done": true},
        {"name": "http_status", "value": "Getting...", "url": "https://_DOMAIN_", "done": false}    
    ]

    //For each entry, go get em
	versions.forEach(function(versionToGet) {
        if (!versionToGet.done) {
            if (versionToGet.url != "") {

                //Buld the URL
                versionToGet.url = versionToGet.url.replace("_DOMAIN_", domain);

                //Get the page/response and pass response object to send it
                getPage(versionToGet.url, responseObject, "version", versionToGet, versions, null);
            
            }   
            else {
                versionToGet.done = true;
            } 
        }
    });
}

//Grab the version info from the page stream
function getVersion(myPageData) {

	var myArray;
    var myVersion;
    var myFullVersion = "";
    var inputLine = "";

    if (myPageData.includes("git.build.version")) {
        return myPageData;
    }
    else {
        myArray = myPageData.split(/\n/);
    }
  
    //Loop thru each line of the response and interrogate it for version info
    for (i = 0; i < myArray.length; i++) {
        inputLine = myArray[i];
        if (inputLine.includes("git.")) {
            myVersion = inputLine.replace("''", "");
            myVersion = inputLine.replace('""', "");
			myVersion = inputLine.replace(",", "");
			myVersion = myVersion.trim();
			myFullVersion = appendVersion(myFullVersion, myVersion);
        }
        else {
            if (inputLine.includes('<!DOCTYPE html><html lang="en"><head>')) {
                if (myArray[i+1].includes("<!-- ")) {
                    //BUild Time is next
                    myVersion = myArray[i+1];
                    myVersion = myVersion.replace("<!-- ", "");
                    myVersion = myVersion.replace(" -->", "");
                    myVersion = myVersion.trim();
                    myVersion = "Build Time: " + myVersion;
                    myFullVersion = appendVersion(myFullVersion, myVersion);
                }             
            }
            else {
                if (inputLine.includes("<!-- @build:ic_front_end release/")) {
                    myVersion = inputLine.replace("<!-- @build:ic_front_end release/", "");
                    myVersion = myVersion.replace(" -->", "");
                    myVersion = myVersion.trim();
                    myFullVersion = appendVersion(myFullVersion, myVersion);
                }
                else {
                    if (inputLine.includes("<!-- @build:ic_front_end_shared release/")) {
                        myVersion = inputLine.replace("<!-- @build:ic_front_end_shared release/", "");
                        myVersion = myVersion.replace(" -->", "");
                        myVersion = myVersion.trim();
                        myFullVersion = appendVersion(myFullVersion, myVersion);
                    }
                    else {
                        if (inputLine.includes("<!-- ic_web version:")) {
                            myVersion = inputLine.replace("<!-- ic_web version:", "");
                            myVersion = myVersion.replace(" -->", "");
                            myVersion = myVersion.trim();
                            myFullVersion = appendVersion(myFullVersion, myVersion);
                        }
                        else {
                            if (inputLine.includes("<!doctype html>")) {
                                if (myArray[i+1].includes('<html lang="en">') && myArray[i+2].includes("<head>")) {
                                    if (myArray[i+3].includes("<!-- ")) {
                                        //CO Build Date
                                        myVersion = myArray[i+3].replace("<!-- ", "");
                                        myVersion = myVersion.replace(" -->", "");
                                        myVersion = "Build Time: " + myVersion.trim();
                                        myFullVersion = appendVersion(myFullVersion, myVersion);
                                    }
                                }
                            }
                            else {
                                if (inputLine.includes("<!-- @build ")) {
                                    //CO BUild - here is where it shouldbe
                                    myVersion = inputLine.replace("<!-- @build ", "");
                                    myVersion = myVersion.replace(" -->", "");
                                    myVersion = myVersion.trim();
                                    myFullVersion = appendVersion(myFullVersion, myVersion);
                                }
                            }
                        }
                    }
                }
            }
        }
    }
	
    return myFullVersion;

}

//Add some more to the defined version
function appendVersion(inputFullVersion, inputVersion) {

	var responseVersion;
	
	if (inputFullVersion.length > 0) {
        responseVersion = inputVersion + "<br>" + inputFullVersion ;
    }
    else {
        responseVersion = inputVersion;
    }
	
	return responseVersion;
}
	
//Sleep function, like what every other language has
function sleep(inputMS) {
    let timeStart = new Date().getTime(); 
    while (true) { 
        let elapsedTime = new Date().getTime() - timeStart; 
        if (elapsedTime > inputMS) { 
        break; 
        } 
    } 
}

//Build the output for the version request
function buildAndSendVersionInfo(responseObject, actionObjects) {

    //This is the response packet
    var outputResponse = '{' +
    '"versions": {' +
    '  "current_release_version": "_current_release_version_",' +
    '  "ic_content_display_web_version_product": _ic_content_display_web_version_product_,' +
    '  "ic_content_display_web_version_basket": _ic_content_display_web_version_basket_,' +
    '  "ic_web_tar_version": "_ic_web_tar_version_",' +
    '  "ic_servlet_filters_version": "(not done - only on server)",' +
    '  "le_web_be_megalith_cd_version": "(not done - only on server)",' +
    '  "le_web_be_megalith_pd_version": "(not done - only on server)",' +
    '  "ic_web_fe_secure_checkout_version": "_ic_web_fe_secure_checkout_version_",' +
    '  "bcc_chai_version": "_bcc_chai_version_",' +
    '  "ic_mqwrapper_version": "_ic_mqwrapper_version_",' +
    '  "bcc_pmos_version": "_bcc_pmos_version_",' +
    '  "le_web_be_megalith_pub_version": "_le_web_be_megalith_pub_version_",' +
    '  "ic_inventory_version": "_ic_inventory_version_",' +
    '  "ic_storelocator_version": "(not done - only on server)",' +
    '  "ic_web_front_end_version_pdp": "_ic_web_front_end_version_pdp_",' +
    '  "ic_web_front_end_version_pmp": "_ic_web_front_end_version_pmp_",' +
    '  "ic_web_front_end_version_basket": "_ic_web_front_end_version_basket_",' +
    '  "ic_web_front_end_version_myaccount": "_ic_web_front_end_version_myaccount_",' +
    '  "ic_cgi_new_tar_version": "Coming....",' +
    '  "http_status": ""' +
    '}}';

    //Fill in our values
    actionObjects.forEach(function (actionObject) {
        outputResponse = outputResponse.replace("_" + actionObject.name + "_", actionObject.value);
    });

    //And send it out
    responseObject.set('Content-Type', 'application/json;charset=UTF-8');
    responseObject.send(outputResponse);

}

//All Done test - all entries s/b true
function allDone(inputObjects) {

    var blnResponse = true;
    inputObjects.forEach(function(inputObject) {
        if (!inputObject.done) {
            blnResponse = false;
        }
    });

    return blnResponse;

}

//Return the timestamp as YYYY-MM-DD-HH-MM-SS
function TimeStamp(inputDate) {

    inputDate = new Date(inputDate);
    var lYear = inputDate.getFullYear();
    var lMonth = inputDate.getMonth()+1;
    var lDay = inputDate.getDate();
    var lHour = inputDate.getHours();
    var lMinute = inputDate.getMinutes();
    var lSecond = inputDate.getSeconds();
    
    if (lDay < 10) {
        lDay = '0' + lDay;
    }
    if (lMonth < 10) {
        lMonth = '0' + lMonth;
    }
    if (lHour < 10) {
        lHour = '0' + lHour;
    }
    if (lMinute < 10) {
        lMinute = '0' + lMinute;
    }
    if (lSecond < 10) {
        lSecond = '0' + lSecond;
    }
    return (lYear + "-" + lMonth + "-" + lDay + "-" + lHour + "-" + lMinute + "-" + lSecond);
}