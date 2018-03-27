'use strict';
require('dotenv').config();

const https = require('https');
const host = 'apisandbox.dev.clover.com';
const accessToken = 'd2c504dc-2d28-6095-600e-1c2fb7c86f16'
const merchantId = 'TB6EGCJW1K3EW'
const merchantName = 'Miguel\'s Snack Shack'

const functions = require('firebase-functions'); // Cloud Functions for Firebase library

//Executes when webhook is called
exports.cloverAssistantWebhook = functions.https.onRequest((req, res) => {
  const app = new DialogflowApp({request: req, response: res});
  let intent = req.body.result.metadata.intentName;
  switch(intent){
    case 'Sales':
      lookupSales(req, res);
      break;
    case 'Stock':
      lookupInventory(req, res);
      break;
    case 'Order Inventory':
      orderInventory(req, res);
      break;
    default:
      res.setHeader('Content-Type', 'application/json');
      res.send(JSON.stringify({ 'followupEvent': {"name" : "input.unknown"}}));
  }
});

//Looks up sales data for the merchant.
function lookupSales(req, res){
  //Calls Clover Sales API to get sales and return data
  callSalesApi().then((output) => {
      // Return the Clover results to API.AI
      res.setHeader('Content-Type', 'application/json');
      res.send(JSON.stringify({ 'speech': output, 'displayText': output }));
    }).catch((error) => {
      // If there is an error let the user know
      res.setHeader('Content-Type', 'application/json');
      res.send(JSON.stringify({ 'speech': error, 'displayText': error }));
  });
}

/*
  Looks up inventory stock for specified item. Returns the output string
  in the response.
*/
function lookupInventory(req, res){
  let item = req.body.result.parameters.Item;
  //Call Clover API to get the itemId
  getInventoryId(item).then((itemId) => {
    //Call Clover to get quantity of item with the itemId
    getInventoryQuantity(item, itemId).then((output) => {
      // Return the Clover results as output string
      res.setHeader('Content-Type', 'application/json');
      res.send(JSON.stringify({ 'speech': output, 'displayText': output }));
    });
  }).catch((error) => {
      // If there is an error let the user know
      res.setHeader('Content-Type', 'application/json');
      res.send(JSON.stringify({ 'speech': error, 'displayText': error }));
    });
}

/*
  Returns the stock quantity of an item given the item name and item id.
*/
function getInventoryQuantity(item, itemId){
  return new Promise((resolve, reject) => {
    if(item == undefined){
      let output = 'Sorry, I don\'t see ' + item + ' in your inventory. Please try again.';
      resolve(output);
    }
    path = '/v3/merchants/' + merchantId + '/item_stocks/' + itemId + '?access_token=' + accessToken;
    console.log(path);
    https.get({host: host, path: path}, (res) => {
      let body = ''
      res.on('data', (d) => { body += d; }); // store each response chunk
      res.on('end', () => {
        // Parse the JSON for desired data
        let response = JSON.parse(body);
        let itemQuantity = response.quantity;
        console.log(itemQuantity);
        //Response
        let output = getInventoryQuantityOutput(item, itemQuantity);
        console.log(output);
        resolve(output);
      });
      res.on('error', (error) => {
        reject(error)
      });
    });
  });
}


/* 
  Calls Clover reporting API and returns output string with sales and refunds totals
*/
function callSalesApi() {
  return new Promise((resolve, reject) => {
    let path = '/v3/merchants/' + merchantId + '/reports/payments?access_token=' + accessToken;
    https.get({host: host, path: path}, (res) => {
      let body = '';
      res.on('data', (d) => { body += d; }); // store each response chunk
      res.on('end', () => {
        // Parse the JSON response for payment and refund totals
        let response = JSON.parse(body);
        let paymentSummaryNum = response['paymentSummary']['num'];
        let paymentSummaryAmountCents = response['paymentSummary']['amount'];
        let refundSummaryNum = response ['refundSummary']["num"];
        let refundSummaryAmountCents = response ['refundSummary']["amount"];
        let paymentSummaryAmountDollars = paymentSummaryAmountCents / 100;
        let refundSummaryAmountDollars = refundSummaryAmountCents / 100;
        //Response
        let output = getSalesOutput(salesDollars, paymentSummaryNum, refundDollars, refundSummaryNum);
        console.log(output);
        resolve(output);
      });
      res.on('error', (error) => {
        reject(error)
      });
    });
  });
}


//Calls Clover inventory API to get current stock count
//Returns output string
function getInventoryId(item) {
  return new Promise((resolve, reject) => {
    let path = '/v3/merchants/' + merchantId + '/items?filter=name=' + item + '&access_token=' + accessToken;
    //TODO: Clover requires exact string match. The code does not handle if you don't give the exact name. 
    //Future improvements would be to try different variations.
    console.log(path);
    https.get({host: host, path: path}, (res) => {
      let body = ''
      res.on('data', (d) => { body += d; }); // store each response chunk
      res.on('end', () => {
        // Parse the JSON for inventory quantity
        let response = JSON.parse(body);
        let itemId = response['elements'][0].id;
        console.log(response['elements'][0].id);
        resolve(itemId);
      });
      res.on('error', (error) => {
        reject(error)
      });
    });
  });
}

function orderInventory(req, res){
  console.log('orderInventory');
  //TODO: Lets user order more inventory.
}

function lookupEmployees(req, res){
  console.log('lookupEmployees');
  //TODO: Lets user lookup sales data by employees.
}

function getInventoryQuantityOutput(itemName, itemQuantity){
  let output = "";
  //Randomizes the response to mimic human speech.
  switch (Math.floor((Math.random() * 3))) {
    case 0:
      output = output + 'Your current inventory of ' + itemName + ' is at ' + itemQuantity + ' units.';
      break;
    case 1:
      output = output + 'It looks like you have ' + itemQuantity + ' units of ' + itemName + '.';
      break;
    case 2:
      output = output + 'You currently have ' + itemQuantity + ' units of ' + itemName + '.';
      break;
    }
  if(itemQuantity<10){
    output = 'You\'re running low. ' + output;
  }
  return output;
}

function getSalesOutput(salesTotal, salesCount, refundTotal, refundCount){
  let output = "";
  //Randomizes the response to mimic human speech.
  switch (Math.floor((Math.random() * 2)) {
    case 0:
      output = output + 'Today your store had ' + salesCount + ' sales for a total of $' + salesTotal 
        + '. Also, there was ' + refundCount + ' refunds totaling $' + refundTotal;
      break;
    case 1:
      output = output + 'Today your store processed $' + salesTotal + ' from ' + salesCount 
        + ' sales. Also, there was ' + refundCount + ' refunds totaling $' + refundTotal;
      break;
    }
  return output;
}


//Returns random acknowledgement for use 
function getAcknowledgement(){
  switch (Math.floor((Math.random() * 3))) {
    case 0:
      return 'Okay';
    case 1:
      return 'Alright';
    case 2:
      return 'Sure';
  }
}

//gcloud beta functions deploy cloverAssistantWebhook --stage-bucket clover-8df03.appspot.com --trigger-http
