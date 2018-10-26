const alexaSDK = require('alexa-sdk');
const awsSDK = require('aws-sdk');

const appId = 'amzn1.ask.skill.b36b44a8-d6b0-4600-9e35-d31c665f5ecb';
const itemsTable = 'MyBagItems';
const docClient = new awsSDK
    .DynamoDB
    .DocumentClient();

const instructions = `Your bag is open.<break strength="medium" /> 
                      The following commands are available: add item, remove item,
                      whats in my bag. What would you like to do?`;

const handlers = {

    /**
     * Triggered when the user says "Alexa, open My Bag.
     */
    'LaunchRequest'() {
        this.emit(':ask', instructions);
    },

    /**
     * Adds a item to the current user's saved bag.
     * Slots: ItemName, ItemQuantity
     */
    'AddItemIntent'() {
        const {
            userId
        } = this.event.session.user;
        const {
            slots
        } = this.event.request.intent;

        // prompt for slot values and request a confirmation for each

        // ItemName
        if (!slots.ItemName.value) {
            const slotToElicit = 'ItemName';
            const speechOutput = 'What is the name of the item?';
            const repromptSpeech = 'Please tell me the name of the item';
            return this.emit(':elicitSlot', slotToElicit, speechOutput, repromptSpeech);
        } else if (slots.ItemName.confirmationStatus !== 'CONFIRMED') {

            if (slots.ItemName.confirmationStatus !== 'DENIED') {
                // slot status: unconfirmed
                const slotToConfirm = 'ItemName';
                const speechOutput = `The name of the item is ${slots.ItemName.value}, correct?`;
                const repromptSpeech = speechOutput;
                return this.emit(':confirmSlot', slotToConfirm, speechOutput, repromptSpeech);
            }

            // slot status: denied -> reprompt for slot data
            const slotToElicit = 'ItemName';
            const speechOutput = 'What is the name of the item you would like to add?';
            const repromptSpeech = 'Please tell me the name of the item';
            return this.emit(':elicitSlot', slotToElicit, speechOutput, repromptSpeech);
        }

        // ItemQuantity
        if (!slots.ItemQuantity.value) {
            const slotToElicit = 'ItemQuantity';
            const speechOutput = 'How many?';
            const repromptSpeech = 'Please tell me how many.';
            return this.emit(':elicitSlot', slotToElicit, speechOutput, repromptSpeech);
        } else if (slots.ItemQuantity.confirmationStatus !== 'CONFIRMED') {

            if (slots.ItemQuantity.confirmationStatus !== 'DENIED') {
                // slot status: unconfirmed
                const slotToConfirm = 'ItemQuantity';
                const speechOutput = `You need ${slots.ItemQuantity.value}, right?`;
                const repromptSpeech = speechOutput;
                return this.emit(':confirmSlot', slotToConfirm, speechOutput, repromptSpeech);
            }

            // slot status: denied -> reprompt for slot data
            const slotToElicit = 'ItemQuantity';
            const speechOutput = 'How many?';
            const repromptSpeech = 'Please tell me how many.';
            return this.emit(':elicitSlot', slotToElicit, speechOutput, repromptSpeech);
        }


        // all slot values received and confirmed, now add the record to DynamoDB

        const name = slots.ItemName.value;
        const qty = slots.ItemQuantity.value;
        const dynamoParams = {
            TableName: itemsTable,
            Item: {
                Name: name,
                UserId: userId,
                Qty: qty
            }
        };

        const checkIfItemExistsParams = {
            TableName: itemsTable,
            Key: {
                Name: name,
                UserId: userId
            }
        };

        console.log('Attempting to add item', dynamoParams);

        // query DynamoDB to see if the item exists first
        // query DynamoDB to see if the item exists first
        docClient
            .get(checkIfItemExistsParams)
            .promise()
            .then(data => {
                console.log('Get item succeeded', data);

                const bagItem = data.Item;

                if (bagItem) {
                    const errorMsg = `Item ${name} is already in your bag!`;
                    this.emit(':tell', errorMsg);
                    throw new Error(errorMsg);
                } else {
                    // no match, add the item
                    return docClient.put(dynamoParams, function(err, data) {
                        if (err) {
                            console.error("Unable to update item. Error JSON:", JSON.stringify(err, null, 2));
                        } else {
                            console.log("UpdateItem succeeded:", JSON.stringify(data, null, 2));
                        }
                    });
                }
            })
            .then(data => {
                console.log('Add item succeeded', data);

                this.emit(':tell', `Item ${name} is now in your bag!`);
            })
            .catch(err => {
                console.error(err);
            });
    },

    /**
     * Lists all saved items for the current user.
     */
    'GetAllItemsIntent'() {
        const {
            userId
        } = this.event.session.user;
        const {
            slots
        } = this.event.request.intent;
        let output;

        const dynamoParams = {
            TableName: itemsTable
        };


        dynamoParams.FilterExpression = 'UserId = :user_id';
        dynamoParams.ExpressionAttributeValues = {
            ':user_id': userId
        };
        output = 'The following items are in your bag: <break strength="x-strong" />';


        // query DynamoDB
        docClient
            .scan(dynamoParams)
            .promise()
            .then(data => {
                console.log('Read table succeeded!', data);

                if (data.Items && data.Items.length) {
                    data.Items.forEach(item => {
                        output += `${item.Name}<break strength="x-strong" />`;
                    });
                } else {
                    output = 'Your bag is empty!';
                }

                console.log('output', output);

                this.emit(':tell', output);
            })
            .catch(err => {
                console.error(err);
            });
    },


    /**
     * Allow the user to delete one of their items
     */
    'DeleteItemIntent'() {
        const {
            slots
        } = this.event.request.intent;

        // prompt for the item name if needed and then require a confirmation
        if (!slots.ItemName.value) {
            const slotToElicit = 'ItemName';
            const speechOutput = 'What is the name of the item you would like to remove?';
            const repromptSpeech = 'Please tell me the name of the item';
            return this.emit(':elicitSlot', slotToElicit, speechOutput, repromptSpeech);
        } else if (slots.ItemName.confirmationStatus !== 'CONFIRMED') {

            if (slots.ItemName.confirmationStatus !== 'DENIED') {
                // slot status: unconfirmed
                const slotToConfirm = 'ItemName';
                const speechOutput = `You would like to delete the item ${slots.ItemName.value}, correct?`;
                const repromptSpeech = speechOutput;
                return this.emit(':confirmSlot', slotToConfirm, speechOutput, repromptSpeech);
            }

            // slot status: denied -> reprompt for slot data
            const slotToElicit = 'ItemName';
            const speechOutput = 'What is the name of the item you would like to delete?';
            const repromptSpeech = 'Please tell me the name of the item';
            return this.emit(':elicitSlot', slotToElicit, speechOutput, repromptSpeech);
        }

        const {
            userId
        } = this.event.session.user;
        const itemName = slots.ItemName.value;
        const dynamoParams = {
            TableName: itemsTable,
            Key: {
                Name: itemName,
                UserId: userId
            }
        };

        console.log('Attempting to read data');

        // query DynamoDB to see if the item exists first
        docClient
            .get(dynamoParams)
            .promise()
            .then(data => {
                console.log('Get item succeeded', data);

                const bagItem = data.Item;

                if (bagItem) {
                    console.log('Attempting to delete data', data);

                    return docClient.delete(dynamoParams, function(err, data) {
                        if (err) {
                            console.error("Unable to delete item. Error JSON:", JSON.stringify(err, null, 2));
                        } else {
                            console.log("DeleteItem succeeded:", JSON.stringify(data, null, 2));
                        }
                    });
                }

                const errorMsg = `Item ${itemName} not in your bag`;
                this.emit(':tell', errorMsg);
                throw new Error(errorMsg);
            })
            .then(data => {
                console.log('Delete item succeeded', data);

                this.emit(':tell', `Item ${itemName} deleted!`);
            })
            .catch(err => console.log(err));
    },

    'Unhandled'() {
        console.error('problem', this.event);
        this.emit(':ask', 'I do not know how to do that!');
    },

    'AMAZON.HelpIntent'() {
        const speechOutput = instructions;
        const reprompt = instructions;
        this.emit(':ask', speechOutput, reprompt);
    },

    'AMAZON.CancelIntent'() {
        this.emit(':tell', 'Goodbye!');
    },

    'AMAZON.StopIntent'() {
        this.emit(':tell', 'Goodbye!');
    }
};

exports.handler = function handler(event, context) {
    const alexa = alexaSDK.handler(event, context);
    alexa.appId = appId;
    alexa.registerHandlers(handlers);
    alexa.execute();
};