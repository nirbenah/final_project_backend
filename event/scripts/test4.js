import assert from 'assert';
import { get } from 'http';
import fetch from "node-fetch";
import * as mongoose from "mongoose";
import * as dotenv from "dotenv";

// get acces to the env variables
dotenv.config();

const args = process.argv.slice(2);
assert(args.length <= 1, 'usage: node test.js [url]');

const url = (args.length == 0) ? 'http://localhost:3000' : args[0];

// Order of Validation
// Make sure to follow this order of validation and return the status code associated
// with the first error encountered, even if the request is invalid for multiple reasons.
// ● 404 – Not Found – API Path not found.
// ● 401 – Unauthorized.
// ● 403 – Forbidden.
// ● 400 – Bad Request.
// ● 404 – Not Found – Item not found.

function sendRequest(endpoint, method = 'GET', body = '', headers = {}) {
    const address = `${url}${endpoint}`;
    const content = {
        method: method,
        headers: headers
    }
    if (body) {
        content['body'] = body
    }
    return fetch(address, content)

}

function jsonContaindOnlyId(json) {
    return Object.keys(json).length === 1 && json.hasOwnProperty('_id');
}

function json1ContainsAllKeysJson2(json1, json2) { // get parsed jsons
    const keysJson1 = Object.keys(json1);
    const keysJson2 = Object.keys(json2);

    return keysJson2.every(key => keysJson1.includes(key));
}

// check  404 – Not Found – API Path not found.
async function testNotFound() {
    try {
        const res1 = await sendRequest('/api/unknown', 'GET', '', {});
        assert.equal(res1.status, 404, 'Expected 404 status for unknown endpoint');
        console.log('GET Not Found Test - Passed');

        const res2 = await sendRequest('/api/event/1', 'POST', '', {});
        assert.equal(res2.status, 404, 'Expected 404 status for unknown endpoint');

        console.log('Not Found Test - Passed');
    } catch (error) {
        throw new Error('Not Found Test - Failed:' + error.message);
    }
}

// check 401 – Unauthorized.
async function testUnauthorized() { 
    try{
        let res1 = await sendRequest('/api/event/{id}', 'GET', '', {});
        assert.equal(res1.status, 401, 'Expected 401 status for unauthorized request')

        let res2 = await sendRequest('/api/event/{category}', 'GET', '', {});
        assert.equal(res2.status, 401, 'Expected 401 status for unauthorized request')

        let res3 = await sendRequest('/api/event/organizer/{organizer}', 'GET', '', {});
        assert.equal(res3.status, 401, 'Expected 401 status for unauthorized request')

        let res4 = await sendRequest('/api/event', 'POST', '', {});
        assert.equal(res4.status, 401, 'Expected 401 status for unauthorized request')

        let res5 = await sendRequest('/api/event/{id}', 'PUT', '', {});
        assert.equal(res5.status, 401, 'Expected 401 status for unauthorized request')

        let res6 = await sendRequest('/api/event/{id}', 'DELETE', '', {});
        assert.equal(res6.status, 401, 'Expected 401 status for unauthorized request')

        let res7 = await sendRequest('/api/permission ', 'PUT', '', {});
        assert.equal(res7.status, 401, 'Expected 401 status for unauthorized request')
        
        console.log('Unauthorized Test - Passed');
    }catch(error){
        throw new Error('Unauthorized Test - Failed:' + error.message);
    }
}

async function signup(workerUser, managerUser){
    try{
        let res1 = await sendRequest('/api/signup', 'POST', workerUser, {});
        assert.equal(res1.status, 201, 'on res1: Expected 201 status for worker user creation' + ', actual status: ' + res1.status);

        let res2 = await sendRequest('/api/signup', 'POST', managerUser, {});
        assert.equal(res2.status, 201, 'on res2: Expected 201 status for manager user creation' + ', actual status: ' + res2.status);
    }catch(error){
        throw new Error('signup failed:' + error.message);
    }
}

async function loginAndPermission(adminUser, managerUser, workerUser, managePermission){ 
    try{
        let res3 = await sendRequest('/api/login', 'POST', workerUser, {});
        assert.equal(res3.status, 200, 'on res3: Expected 200 status for worker user login' + ', actual status: ' + res3.status);
        let workerUserToken = (await res3.json()).token;
        assert.ok(workerUserToken, 'on res3: Expected JWT token to be returned' + ', actual token: ' + workerUserToken);

        let res4 = await sendRequest('/api/permission', 'PUT', managePermission, {authorization: `Bearer ${workerUserToken}`});
        assert.equal(res4.status, 403, 'on res4: Expected 403 status for Forbidden access' + ', actual status: ' + res4.status); 

        let res5 = await sendRequest('/api/login', 'POST', adminUser, {});
        assert.equal(res5.status, 200, 'on res5: Expected 200 status for admin user login' + ', actual status: ' + res5.status);
        let adminUserToken = (await res5.json()).token;
        assert.ok(adminUserToken, 'on res5: Expected JWT token to be returned' + ', actual token: ' + adminUserToken);

        let res6 = await sendRequest('/api/permission', 'PUT', managePermission, {authorization: `Bearer ${adminUserToken}`});
        assert.equal(res6.status, 200, 'on res6: Expected 200 status for permission update' + ', actual status: ' + res6.status);

        let res7 = await sendRequest('/api/login', 'POST', managerUser, {});
        assert.equal(res7.status, 200, 'on res7: Expected 200 status for manager user login' + ', actual status: ' + res7.status);
        let managerUserToken = (await res7.json()).token;
        assert.ok(managerUserToken, 'on res7: Expected JWT token to be returned' + ', actual token: ' + managerUserToken);  
        return [adminUserToken, managerUserToken, workerUserToken];
    }catch(error){
        throw new Error('loginAndPermission failed:' + error.message);
    }
}

async function create2Events(event1, event2, adminUserToken, managerUserToken, workerUserToken){
    try{
        let res8 = await sendRequest('/api/event', 'POST', event1, {authorization: `Bearer ${managerUserToken}`});
        assert.equal(res8.status, 201, 'on res8: Expected 201 status for event creation' + ', actual status: ' + res8.status);
        let res8Json = await res8.json();
        assert.ok(jsonContaindOnlyId(res8Json), 'on res8: Expected event1 Id (and onlt it) to be returned');
        let event1Id = res8Json._id;


        let res9 = await sendRequest('/api/event', 'POST', event2, {authorization: `Bearer ${workerUserToken}`});
        assert.equal(res9.status, 403, 'on res9: Expected 403 status for Forbidden access');

        let res10 = await sendRequest('/api/event', 'POST', event2, {authorization: `Bearer ${adminUserToken}`});
        assert.equal(res10.status, 201, 'on res10: Expected 201 status for event creation');
        let res10Json = await res10.json();
        assert.ok(jsonContaindOnlyId(res10Json), 'on res10: Expected event2 Id (and onlt it) to be returned');
        let event2Id = res10Json._id;
        return [event1Id, event2Id];
    }catch(error){
        throw new Error('create2Events failed:' + error.message);
    }
}

async function getEventById(event1, event1Id, workerUserToken){ 
    try{
        // *** get event by id ***
        let notExistId = "607f1f77bcf86cd799439011";
        let resNotExistId = await sendRequest("/api/event/" + notExistId, 'GET', '', {authorization: `Bearer ${workerUserToken}`});
        assert.equal(resNotExistId.status, 404, 'on resNotExistId: Expected 404 status for Item not found' + ', actual status: ' + resNotExistId.status);

        let res11 = await sendRequest(`/api/event/${event1Id}`, 'GET', '', {authorization: `Bearer ${workerUserToken}`});
        assert.equal(res11.status, 200, 'on res11: Expected 200 status for event object retrieval' + ', actual status: ' + res11.status);
        let res11Json = await res11.json();
        assert.equal(event1Id, res11Json._id, 'on res11: Expected event1Id to be same as _id in the response');
        assert.ok(json1ContainsAllKeysJson2(res11Json, JSON.parse(event1)), 'on res11: Expected event1 keys to be include in the response');
    }catch(error){
        throw new Error('getEventById failed:' + error.message);
    }
}

async function getEventByCategory(event1, event2, event1Id, event2Id, workerUserToken){
    try{
        // *** get event by category *** 
        let category = "Concert";
        let resNotCurrExistCategory = await sendRequest(`/api/event/${category}`, 'GET', '', {authorization: `Bearer ${workerUserToken}`});
        // expect to get 200 status code and empty array
        assert.equal(resNotCurrExistCategory.status, 200, `on resNotCurrExistCategory: Expected 200 status for events objects list retrieval, actual status: ${resNotCurrExistCategory.status}`);
        // get the json res and make sure it is []
        let notCurrExistCategoryEventsList = await resNotCurrExistCategory.json();
        assert.ok(Array.isArray(notCurrExistCategoryEventsList), 'on resNotCurrExistCategory: Expected an array to be returned');
        assert.ok(notCurrExistCategoryEventsList.length === 0, 'on resNotCurrExistCategory: Expected empty array to be returned');

        let res12 = await sendRequest(`/api/event/${JSON.parse(event1).category}`, 'GET', '', {authorization: `Bearer ${workerUserToken}`});
        assert.equal(res12.status, 200, `on res12: Expected 200 status for events objects list retrieval, actual status: ${res12.status}`);
        // assert event1 _id && event2 _id are in the response
        let eventsList = await res12.json();
        // Extract event IDs from the eventsList
        const eventIds = eventsList.map(event => event._id);
        // Verify that event1 and event2 IDs are in the response
        assert.ok(eventIds.includes(event1Id), 'on res12: Event 1 ID is not present in the response');
        assert.ok(eventIds.includes(event2Id), 'on res12: Event 2 ID is not present in the response');
        // assert event1 fields are included in the response
        assert.ok(json1ContainsAllKeysJson2(eventsList.find(event => event._id === event1Id), JSON.parse(event1)), 'on res12: Expected event1 keys to be include in the response');
        // assert event2 fields are included in the response
        assert.ok(json1ContainsAllKeysJson2(eventsList.find(event => event._id === event2Id), JSON.parse(event2)), 'on res12: Expected event2 keys to be include in the response');
    }catch(error){
        throw new Error('getEventByCategory failed:' + error.message);
    }
}

async function getEventByorganizer(event1, event2, event1Id, event2Id, workerUserToken){
    try{
        // *** get event by organizer ***
        let res13 = await sendRequest(`/api/event/organizer/${JSON.parse(event1).organizer}`, 'GET', '', {authorization: `Bearer ${workerUserToken}`});
        assert.equal(res13.status, 200, 'on res13: Expected 200 status for events objects list retrieval' + ', actual status: ' + res13.status);
        // assert event1 _id && event2 _id are in the response
        let organizerEventsList = await res13.json();
        // Extract event IDs from the organizerEventsList
        const organizerEventIds = organizerEventsList.map(event => event._id);
        // Verify that event1 and event2 IDs are in the response
        assert.ok(organizerEventIds.includes(event1Id), 'on res13: Event 1 ID is not present in the response');
        assert.ok(organizerEventIds.includes(event2Id), 'on res13: Event 2 ID is not present in the response');
        // assert event1 fields are included in the response
        assert.ok(json1ContainsAllKeysJson2(organizerEventsList.find(event => event._id === event1Id), JSON.parse(event1)), 'on res13: Expected event1 keys to be include in the response');
        // assert event2 fields are included in the response
        assert.ok(json1ContainsAllKeysJson2(organizerEventsList.find(event => event._id === event2Id), JSON.parse(event2)), 'on res13: Expected event2 keys to be include in the response');
    }catch(error){
        throw new Error('getEventByOrganizer failed:' + error.message);
    }
}

async function updateEvent(event1Id, event1Update, workerUserToken, managerUserToken){
    try{
        // *** update event ***
        let notExistId = "607f1f77bcf86cd799439011";
        let resNotExistId = await sendRequest(`/api/event/${notExistId}`, 'PUT', event1Update, {authorization: `Bearer ${managerUserToken}`});
        assert.equal(resNotExistId.status, 404, 'on resNotExistId: Expected 404 status for Item not found' + ', actual status: ' + resNotExistId.status);

        let res14 = await sendRequest(`/api/event/${event1Id}`, 'PUT', event1Update, {authorization: `Bearer ${workerUserToken}`});
        assert.equal(res14.status, 403, 'on res14: Expected 403 status for Forbidden access' + ', actual status: ' + res14.status);

        let res15 = await sendRequest(`/api/event/${event1Id}`, 'PUT', event1Update, {authorization: `Bearer ${managerUserToken}`});
        assert.equal(res15.status, 200, 'on res15: Expected 200 status for event update' + ', actual status: ' + res15.status);
        let res15Json = await res15.json();
        assert.ok(jsonContaindOnlyId(res15Json), 'on res15: Expected event1 Id (and onlt it) to be returned');
        assert.equal(event1Id, res15Json._id, 'on res15: Expected event1 Id to be same as _id in the response');
    }catch(error){
        throw new Error('updateEvent failed:' + error.message);
    }
}

async function deleteEvent(event1Id, event2Id, workerUserToken, managerUserToken, adminUserToken){
    try{
        // *** delete events ***
        // in case of error (return status of 5xx or 4xx) the body will be ignored (no need to check for empty body in case of error)
        let res16 = await sendRequest(`/api/event/${event1Id}`, 'DELETE', '', {authorization: `Bearer ${workerUserToken}`});
        assert.equal(res16.status, 403, 'on res16: Expected 403 status for Forbidden access' + ', actual status: ' + res16.status);

        let res17 = await sendRequest(`/api/event/${event1Id}`, 'DELETE', '', {authorization: `Bearer ${managerUserToken}`});
        assert.equal(res17.status, 403, 'on res17: Expected 403 status for Forbidden access' + ', actual status: ' + res17.status);

        let jsonBody = JSON.stringify({message: "not supposed to be here"}); 
        let resDeleteWithBody = await sendRequest(`/api/event/${event1Id}`, 'DELETE', jsonBody, {authorization: `Bearer ${adminUserToken}`});
        assert.equal(resDeleteWithBody.status, 200, 'on resDeleteWithBody: Expected 200 status for event deletion req with Body - body should be ignored' + ', actual status: ' + resDeleteWithBody.status);

        let event_id = 111111111111;
        let resDeleteNotExist = await sendRequest(`/api/event/${event_id}`, 'DELETE', '', {authorization: `Bearer ${adminUserToken}`});
        assert.equal(resDeleteNotExist.status, 200, 'on resDeleteNotExist: Expected 200 status for deletion request of not exist event' + ', actual status: ' + resDeleteNotExist.status);

        let res18 = await sendRequest(`/api/event/${event1Id}`, 'DELETE', '', {authorization: `Bearer ${adminUserToken}`});
        assert.equal(res18.status, 200, 'on res18: Expected 200 status for event deletion' + ', actual status: ' + res18.status);
        let res18Body = await res18.text();
        assert.ok(res18Body.trim().length === 0, 'on res18: Expected empty response body' + ', actual body: ' + res18Body);

        let res19 = await sendRequest(`/api/event/${event2Id}`, 'DELETE', '', {authorization: `Bearer ${adminUserToken}`});
        assert.equal(res19.status, 200, 'on res19: Expected 200 status for event deletion' + ', actual status: ' + res19.status);
        let res19Body = await res19.text();
        assert.ok(res19Body.trim().length === 0, 'on res19: Expected empty response body' + ', actual body: ' + res19Body);

        // make sure the events are deleted
        let res20 = await sendRequest(`/api/event/${event1Id}`, 'GET', '', {authorization: `Bearer ${workerUserToken}`});
        assert.equal(res20.status, 404, 'on res20: Expected 404 status for Item not found' + ', actual status: ' + res20.status);

        let res21 = await sendRequest(`/api/event/${event2Id}`, 'GET', '', {authorization: `Bearer ${managerUserToken}`});
        assert.equal(res21.status, 404, 'on res21: Expected 404 status for Item not found' + ', actual status: ' + res21.status);
    }catch(error){
        throw new Error('deleteEvent failed:' + error.message);
    }
}

// check the system when 3 users are exists, 1 admin, 1 manager, 1 worker 
// and 2 events are created by the manager and admin
// check diffrent senarios for the 3 users
async function testCombination() {
    try{
        const event1 = JSON.stringify({
            title: "Test Event1",
            category: "Festival",
            description: "Test Description",
        organizer: "Test-Organizer",         // URIs with whitespaces or special characters will not be tested.
            start_date: "2024-03-10T09:00",
            end_date: "2024-03-10T17:00",
            location: "Test Location",
            tickets: [
                {
                    name: "General Admission",
                    quantity: 100,
                    price: 20
                }
            ],
            image: "https://example.com/image.jpg"
        });

        const event2 = JSON.stringify({
            title: "Test Event2",
            category: "Festival",
            description: "Test Description",
            organizer: "Test-Organizer",
            start_date: "2024-03-10T09:00",
            end_date: "2024-03-10T17:00",
            location: "Test Location",
            tickets: [
                {
                    name: "General Admission",
                    quantity: 100,
                    price: 20
                }
            ],
            image: "https://example.com/image.jpg"
        });

        const adminUser = JSON.stringify({
            username: "admin",
            password:"admin"
        });

        const managerUser = JSON.stringify({
            username: "managerUser",
            password: "managerUser"
        });

        const workerUser = JSON.stringify({
            username: "workerUser",
            password: "workerUser"
        });

        const managePermission = JSON.stringify({
            username: "managerUser",
            permission: "M"
        });

        const event1Update = JSON.stringify({
            title: "Test Event1 Updated"
        });

        await signup(workerUser, managerUser);
        let [adminUserToken, managerUserToken, workerUserToken] = await loginAndPermission(adminUser, managerUser, workerUser, managePermission);
        let [event1Id, event2Id] = await create2Events(event1, event2, adminUserToken, managerUserToken, workerUserToken);
        await getEventById(event1, event1Id, workerUserToken);
        await getEventByCategory(event1, event2, event1Id, event2Id, workerUserToken);
        await getEventByorganizer(event1, event2, event1Id, event2Id, workerUserToken);
        await updateEvent(event1Id, event1Update, workerUserToken, managerUserToken);
        await deleteEvent(event1Id, event2Id, workerUserToken, managerUserToken, adminUserToken);
        // if we here thew are 0 events in the database and 3 users (admin, manager, worker)


        console.log('Combination Test - Passed');
    }catch(error){
        throw new Error('Combination Test - Failed:' + error.message);
    } 
} 

async function testEventStrucure() {
    // The “Event” entity
    // The main entity of the system is the “Event” entity.
    // Each event will contain, at least, the following:
    // ● _id - Unique identifier, automatically created by MongoDB
    // ● Title – Title of the event, might not be unique.
    // ● Category – The type of the event, can only be one of the following:
    // Charity Event, Concert, Conference, Convention, Exhibition, Festival,
    // Product Launch or Sports Event.
    // ● Description – Short description of the event.
    // ● Organizer – Name of the event organizer, as a string.
    // ● Start_date – Starting date and time of the event in
    // YYYY-MM-DDTHH:mm format. For more information about this format
    // please refer to - Date time string format.
    // ● End_date – Ending date and time of the event in YYYY-MM-DDTHH:mm
    // format. The ending time must be set after the event start time.
    // ● Location – Location of where the event is being held, as a string.
    // ● Tickets – the list of tickets for the Event. An event must have at least one
    // ticket.
    // Each ticket will have the following values:
    // o Name - Name/Type of the ticket.
    // o Quantity – How many tickets are available, value >=0.
    // o Price – Price of the ticket, value >= 0.
    // ● Image (Optional) - URL of the Event image

    const eventWith_Id = JSON.stringify({
        _id: "not supposed to be here",
        title: "Test Event1",
        category: "Festival",
        description: "Test Description",
        organizer: "Test-Organizer",
        start_date: "2024-03-10T09:00",
        end_date: "2024-03-10T17:00",
        location: "Test Location",
        tickets: [
            {
                name: "General Admission",
                quantity: 100,
                price: 20
            }
        ],
        image: "https://example.com/image.jpg"
    });

    const eventWithoutTitle = JSON.stringify({
        category: "Festival",
        description: "Test Description",
        organizer: "Test-Organizer",
        start_date: "2024-03-10T09:00",
        end_date: "2024-03-10T17:00",
        location: "Test Location",
        tickets: [
            {
                name: "General Admission",
                quantity: 100,
                price: 20
            }
        ],
        image: "https://example.com/image.jpg"
    });

    const eventWithoutCategory = JSON.stringify({
        title: "Test Event1",
        description: "Test Description",
        organizer: "Test-Organizer",
        start_date: "2024-03-10T09:00",
        end_date: "2024-03-10T17:00",
        location: "Test Location",
        tickets: [
            {
                name: "General Admission",
                quantity: 100,
                price: 20
            }
        ],
        image: "https://example.com/image.jpg"
    });

    const eventWithInvalidCategory = JSON.stringify({
        title: "Test Event1",
        category: "Invalid Category",
        description: "Test Description",
        organizer: "Test-Organizer",
        start_date: "2024-03-10T09:00",
        end_date: "2024-03-10T17:00",
        location: "Test Location",
        tickets: [
            {
                name: "General Admission",
                quantity: 100,
                price: 20
            }
        ],
        image: "https://example.com/image.jpg"
    });

    const eventWithoutDescription = JSON.stringify({
        title: "Test Event1",
        category: "Festival",
        organizer: "Test-Organizer",
        start_date: "2024-03-10T09:00",
        end_date: "2024-03-10T17:00",
        location: "Test Location",
        tickets: [
            {
                name: "General Admission",
                quantity: 100,
                price: 20
            }
        ],
        image: "https://example.com/image.jpg"
    });

    const eventWithoutOrganizer = JSON.stringify({
        title: "Test Event1",
        category: "Festival",
        description: "Test Description",
        start_date: "2024-03-10T09:00",
        end_date: "2024-03-10T17:00",
        location: "Test Location",
        tickets: [
            {
                name: "General Admission",
                quantity: 100,
                price: 20
            }
        ],
        image: "https://example.com/image.jpg"
    });

    const eventWithoutStartDate = JSON.stringify({
        title: "Test Event1",
        category: "Festival",
        description: "Test Description",
        organizer: "Test-Organizer",
        end_date: "2024-03-10T17:00",
        location: "Test Location",
        tickets: [
            {
                name: "General Admission",
                quantity: 100,
                price: 20
            }
        ],
        image: "https://example.com/image.jpg"
    });

    const eventWithoutEndDate = JSON.stringify({
        title: "Test Event1",
        category: "Festival",
        description: "Test Description",
        organizer: "Test-Organizer",
        start_date: "2024-03-10T09:00",
        location: "Test Location",
        tickets: [
            {
                name: "General Admission",
                quantity: 100,
                price: 20
            }
        ],
        image: "https://example.com/image.jpg"
    });

    const eventWithInvalidStartDate = JSON.stringify({
        title: "Test Event1",
        category: "Festival",
        description: "Test Description",
        organizer: "Test-Organizer",
        start_date: "2024444-03-10T09:00",
        end_date: "2024-03-10T17:00",
        location: "Test Location",
        tickets: [
            {
                name: "General Admission",
                quantity: 100,
                price: 20
            }
        ],
        image: "https://example.com/image.jpg"
    });

    const eventWithInvalidEndDate = JSON.stringify({
        title: "Test Event1",
        category: "Festival",
        description: "Test Description",
        organizer: "Test-Organizer",
        start_date: "2024-03-10T09:00",
        end_date: "2024444-03-10T17:00:00",
        location: "Test Location",
        tickets: [
            {
                name: "General Admission",
                quantity: 100,
                price: 20
            }
        ],
        image: "https://example.com/image.jpg"
    });

    const evventWitheEndDateTimeBeforeStartDateTime1 = JSON.stringify({ 
        title: "Test Event1",
        category: "Festival",
        description: "Test Description",
        organizer: "Test-Organizer",
        start_date: "2024-03-10T17:00",
        end_date: "2024-03-10T09:00",
        location: "Test Location",
        tickets: [
            {
                name: "General Admission",
                quantity: 100,
                price: 20
            }
        ],
        image: "https://example.com/image.jpg"
    }); 

    const evventWitheEndDateTimeBeforeStartDateTime2 = JSON.stringify({
        title: "Test Event1",
        category: "Festival",
        description: "Test Description",
        organizer: "Test-Organizer",
        start_date: "2024-03-10T09:00",
        end_date: "2024-02-10T09:00",
        location: "Test Location",
        tickets: [
            {
                name: "General Admission",
                quantity: 100,
                price: 20
            }
        ],
        image: "https://example.com/image.jpg"
    });

    const eventWithoutLocation = JSON.stringify({
        title: "Test Event1",
        category: "Festival",
        description: "Test Description",
        organizer: "Test-Organizer",
        start_date: "2024-03-10T09:00",
        end_date: "2024-03-10T17:00",
        tickets: [
            {
                name: "General Admission",
                quantity: 100,
                price: 20
            }
        ],
        image: "https://example.com/image.jpg"
    });

    const eventWithoutTickets = JSON.stringify({
        title: "Test Event1",
        category: "Festival",
        description: "Test Description",
        organizer: "Test-Organizer",
        start_date: "2024-03-10T09:00",
        end_date: "2024-03-10T17:00",
        location: "Test Location",
        image: "https://example.com/image.jpg"
    });

    const eventWithInvalidTicketName = JSON.stringify({
        title: "Test Event1",
        category: "Festival",
        description: "Test Description",
        organizer: "Test-Organizer",
        start_date: "2024-03-10T09:00",
        end_date: "2024-03-10T17:00",
        location: "Test Location",
        tickets: [
            {
                name: "",
                quantity: 100,
                price: 20
            }
        ],
        image: "https://example.com/image.jpg"
    });

    const eventWithInvalidTicketQuantity = JSON.stringify({
        title: "Test Event1",
        category: "Festival",
        description: "Test Description",
        organizer: "Test-Organizer",
        start_date: "2024-03-10T09:00",
        end_date: "2024-03-10T17:00",
        location: "Test Location",
        tickets: [
            {
                name: "General Admission",
                quantity: -1,
                price: 20
            }
        ],
        image: "https://example.com/image.jpg"
    });

    const eventWithInvalidTicketPrice = JSON.stringify({
        title: "Test Event1",
        category: "Festival",
        description: "Test Description",
        organizer: "Test-Organizer",
        start_date: "2024-03-10T09:00",
        end_date: "2024-03-10T17:00",
        location: "Test Location",
        tickets: [
            {
                name: "General Admission",
                quantity: 100,
                price: -1
            }
        ],
        image: "https://example.com/image.jpg"
    });

    const evnetwithZeroTickets = JSON.stringify({   
        title: "Test Event1",
        category: "Festival",
        description: "Test Description",
        organizer: "Test-Organizer",
        start_date: "2024-03-10T09:00",
        end_date: "2024-03-10T17:00",
        location: "Test Location",
        tickets: [],
        image: "https://example.com/image.jpg"
    });

    const eventwithwrongOrganizerType = JSON.stringify({
        title: "Test Event1",
        category: "Festival",
        description: "Test Description",
        organizer: {wrongtype: "wrongtype"},
        start_date: "2024-03-10T09:00",
        end_date: "2024-03-10T17:00",
        location: "Test Location",
        tickets: [
            {
                name: "General Admission",
                quantity: 100,
                price: 20
            }
        ],
        image: "https://example.com/image.jpg"
    });

    const eventWithWrongLocationType = JSON.stringify({
        title: "Test Event1",
        category: "Festival",
        description: "Test Description",
        organizer: "Test-Organizer",
        start_date: "2024-03-10T09:00",
        end_date: "2024-03-10T17:00",
        location: {wrongtype: "wrongtype"},
        tickets: [
            {
                name: "General Admission",
                quantity: 100,
                price: 20
            }
        ],
        image: "https://example.com/image.jpg"
    });

    const eventWithWrongTicketsType = JSON.stringify({
        title: "Test Event1",
        category: "Festival",
        description: "Test Description",
        organizer: "Test-Organizer",
        start_date: "2024-03-10T09:00",
        end_date: "2024-03-10T17:00",
        location: "Test Location",
        tickets: "General Admission",
        image: "https://example.com/image.jpg"
    });

    const invalidEvents = [
        ["eventWithoutTitle", eventWithoutTitle],
        ["eventWithoutCategory", eventWithoutCategory],
        ["eventWithoutDescription", eventWithoutDescription],
        ["eventWithoutOrganizer", eventWithoutOrganizer],
        ["eventWithoutStartDate", eventWithoutStartDate],
        ["eventWithoutEndDate", eventWithoutEndDate],
        ["eventWithoutLocation", eventWithoutLocation],
        ["eventWithoutTickets", eventWithoutTickets],
        // ["eventWith_Id", eventWith_Id],
        ["eventWithInvalidCategory", eventWithInvalidCategory],
        ["eventWithInvalidStartDate", eventWithInvalidStartDate],
        ["eventWithInvalidEndDate", eventWithInvalidEndDate],
        ["evventWitheEndDateTimeBeforeStartDateTime1", evventWitheEndDateTimeBeforeStartDateTime1],
        ["evventWitheEndDateTimeBeforeStartDateTime2", evventWitheEndDateTimeBeforeStartDateTime2],
        ["evnetwithZeroTickets", evnetwithZeroTickets],
        ["eventWithInvalidTicketName", eventWithInvalidTicketName],
        ["eventWithInvalidTicketQuantity", eventWithInvalidTicketQuantity],
        ["eventWithInvalidTicketPrice", eventWithInvalidTicketPrice],
        ["eventwithwrongOrganizerType", eventwithwrongOrganizerType],
        ["eventWithWrongLocationType", eventWithWrongLocationType],
        ["eventWithWrongTicketsType", eventWithWrongTicketsType]
    ];

    const valideventWithOutImage = JSON.stringify({
        title: "Test Event1",
        category: "Festival",
        description: "Test Description",
        organizer: "Test-Organizer",
        start_date: "2024-03-10T09:00",
        end_date: "2024-03-10T17:00",
        location: "Test Location",
        tickets: [
            {
                name: "General Admission",
                quantity: 100,
                price: 20
            }
        ]
    });

    const validEventWithImage = JSON.stringify({
        title: "Test Event1",
        category: "Festival",
        description: "Test Description",
        organizer: "Test-Organizer",
        start_date: "2024-03-10T09:00",
        end_date: "2024-03-10T17:00",
        location: "Test Location",
        tickets: [
            {
                name: "General Admission",
                quantity: 100,
                price: 20
            }
        ],
        image: "https://example.com/image.jpg"
    });

    const validEventWithMultipleTickets = JSON.stringify({
        title: "Test Event1",
        category: "Festival",
        description: "Test Description",
        organizer: "Test-Organizer",
        start_date: "2024-03-10T09:00",
        end_date: "2024-03-10T17:00",
        location: "Test Location",
        tickets: [
            {
                name: "General Admission",
                quantity: 100,
                price: 20
            },
            {
                name: "VIP",
                quantity: 50,
                price: 50
            }
        ],
        image: "https://example.com/image.jpg"
    });

    const validEvents = [
        ["valideventWithOutImage", valideventWithOutImage],
        ["validEventWithImage", validEventWithImage],
        ["validEventWithMultipleTickets", validEventWithMultipleTickets]
    ];

    const adminUser = JSON.stringify({
        username: "admin",
        password:"admin"
    });

    try {
        // Log in with admin user 
        let res = await sendRequest('/api/login', 'POST', adminUser, {});
        assert.equal(res.status, 200, 'Expected 200 status for admin user login');
        let adminUserToken = (await res.json()).token;

        // Iterate over each invalid event
        invalidEvents.forEach(async ([eventName, event]) => {
            let res = await sendRequest('/api/event', 'POST', event, {authorization: `Bearer ${adminUserToken}`});
            assert.equal(res.status, 400, `Expected 400 status for ${eventName} creation, actual status: ${res.status}`);
        });

        validEvents.forEach(async ([eventName, event]) => {
            let res = await sendRequest('/api/event', 'POST', event, {authorization: `Bearer ${adminUserToken}`});
            assert.equal(res.status, 201, `Expected 201 status for ${eventName} creation, actual status: ${res.status}`);
            // make sure just _id is returned
            let resJson = await res.json();
            assert.ok(jsonContaindOnlyId(resJson), `Expected ${eventName} Id (and onlt it) to be returned`); 
            // delete the event
            let resDelete = await sendRequest(`/api/event/${resJson._id}`, 'DELETE', '', {authorization: `Bearer ${adminUserToken}`});
            assert.equal(resDelete.status, 200, `Expected 200 status for ${eventName} deletion, actual status: ${resDelete.status}`);
        });

        console.log('testEventStrucure - Passed');
    } catch(error) {
        throw new Error('testEventStrucure failed:' + error.message);   
    }
}

async function dbCleanUp() { // clean up the database except for the admin user
    try {
        // Set the `strictQuery` option to either `true` or `false` to suppress the deprecation warning
        console.log('connecting to the database...');
        mongoose.set('strictQuery', false);
        // // Connect to MongoDB
        const dbURI = `mongodb+srv://admin:${process.env.DBPASS}@cluster0.wwkedxh.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
        // get the connection
        let connection = await mongoose.connect(dbURI);
        const eventCollection = connection.connection.db.collection("events"); // you may replace `events` with the name of your collection
        // delete all documents in the collection
        await eventCollection.deleteMany({});
        const userCollection = connection.connection.db.collection("users"); // you may replace `users` with the name of your collection
        // delete all documents in the collection except for the admin user
        await userCollection.deleteMany({username: {$ne: 'admin'}});
        console.log('Clean up finished successfully'); 
    } catch (error) {
      // clean up failed
      console.error('Error has occuerrd :', error.message);
    }finally{
        try {
            // Close the connection
            await mongoose.disconnect();
            console.log('Connection closed successfully');
        } catch (error) {
            console.error('Error closing connection:', error);
        }
    }  
}                 

async function runTests() {
    // assume we start with only admin user in the database
    try{
        // insert dbCleanUp here if needed
        await testNotFound();
        await testUnauthorized();
        await testEventStrucure();
        await testCombination();
    }catch(error){
        console.error(error.message);
    }finally
    {
        dbCleanUp(); // clean up the database except for the admin user
    }
    // we should have only admin user in the database when we finish not matter what
}

runTests();