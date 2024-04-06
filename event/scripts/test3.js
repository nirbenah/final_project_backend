
import assert from 'assert';
import { v4 as uuidv4 } from "uuid";
import fetch from "node-fetch"

const createdEventIds = [];

const baseEvent = {
    "title": "DC Convention",
    "category": "Convention",
    "description": "First Ever DC Convention with Actor Interviews! A Must for All DC Fans.",
    "organizer": "WB-DC Team",
    "start_date": "2024-01-07T10:00",
    "end_date": "2024-01-07T19:00",
    "location": "Expo Tel Aviv",
    "tickets": [
        { "name": "Entrance", "quantity": 800, "price": 20 },
        { "name": "Interview", "quantity": 300, "price": 30 },
        { "name": "Meetups", "quantity": 100, "price": 70 }
    ],
    "image": "https: /images.thedirect.com/media/photos/comics-dc.jpg"
};

const baseEvent2 = { ...baseEvent };
baseEvent2.title = "Marvel Convention";
baseEvent2.organizer = "Malina";
baseEvent2.image = undefined;

const baseEvent3 = { ...baseEvent };
baseEvent3.title = "Anime Festival";
baseEvent3.category = "Festival";
baseEvent3.organizer = "Akira Toriyama (RIP)";

const specialEvent = { ...baseEvent }
specialEvent.title = "Special Event";
specialEvent.category = "Exhibition";
specialEvent.organizer = "theOneTheOnly";

const testEvents = [baseEvent, baseEvent2, baseEvent3];

const args = process.argv.slice(2);
assert(args.length <= 1, 'usage: node test.js [url]');

const url = (args.length == 0) ? 'http://localhost:3000' : args[0];

let adminJWT = await getJWT("admin", "admin");

function consoleLogRed(text) {
    console.log('\x1b[31m', text, '\x1b[0m');
}

function consoleLogGreen(text) {
    console.log('\x1b[32m', text, '\x1b[0m');
}

async function getJWT(username, password) {
    let res = await fetch(`${url}/api/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username: username, password: password })
    });
    let json = await res.json();
    return json.token;
}


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

function sendAuthenticatedRequest(endpoint, jwt, method = 'GET', body = '') {
    return sendRequest(endpoint, method, body, { authorization: `Bearer ${jwt}` });
}

async function signupTest1() {
    process.stdout.write("Signup & Login Test (1)..................");
    let res;

    let user = uuidv4().substring(0, 8);
    let pass = '1234';
    let reqBody = JSON.stringify({ username: user, password: pass });
    try {
        res = await sendRequest('/api/signup', 'POST', reqBody);
        assert.equal(res.status, 201);
        res = await sendRequest('/api/login', 'POST', reqBody);
        assert.equal(res.status, 200);
        let jwt = (await res.json()).token;
        assert(jwt);

        // You may comment this (vvvvv) if you haven't implemented it yet :)
        res = await sendRequest('/api/event/organizer/Alina', 'GET', '', { authorization: `Bearer ${jwt}` });
        assert.equal(res.status, 200);
    }
    catch (err) {
        consoleLogRed("[FAILED]");
        console.error("Error signing up: ", err);
        return false;
    }
    consoleLogGreen("[OK]");
    return true;
}

async function signupTest2() {
    process.stdout.write("Signup & Login Test (2)..................");
    let res;
    let reqBody = JSON.stringify({ username: "worker", password: "worker" });
    try {
        // Signup with the same user again
        await sendRequest('/api/signup', 'POST', reqBody); // First register
        res = await sendRequest('/api/signup', 'POST', reqBody);
        assert.equal(res.status, 400);

        // Signup with missing fields
        res = await sendRequest('/api/signup', 'POST', JSON.stringify({ "username": "admin1" }));
        assert.equal(res.status, 400);
        res = await sendRequest('/api/signup', 'POST', JSON.stringify({ "password": "admin1" }));
        assert.equal(res.status, 400);

        // Login with missing fields
        res = await sendRequest('/api/login', 'POST', JSON.stringify({ "username": "admin" }));
        assert.equal(res.status, 400);
        res = await sendRequest('/api/login', 'POST', JSON.stringify({ "password": "admin" }));
        assert.equal(res.status, 400);
    }
    catch (err) {
        consoleLogRed("[FAILED]");
        console.error("Error signing up: ", err);
        return false;
    }
    consoleLogGreen("[OK]");
    return true;
}

async function signupTest3() {
    process.stdout.write("Signup & Login Test (3)..................");
    let res;
    let reqBody = JSON.stringify({ username: "iDontExist", password: "O_O" });
    try {
        // Admin creates an event
        res = await sendAuthenticatedRequest('/api/event', adminJWT, 'POST', JSON.stringify(specialEvent));
        assert.equal(res.status, 201);
        const event1 = await res.json();

        // Login with nonexistant user
        res = await sendRequest('/api/login', 'POST', reqBody);
        assert.equal(res.status, 401);

        // Nonexistant user can't access event
        res = await sendAuthenticatedRequest('/api/event/' + event1._id, 'GET');
        assert.equal(res.status, 401);


        // signup and try to give elevated permissions
        reqBody = JSON.stringify({ username: uuidv4().substring(0, 8), password: ";)", role: 1 });
        res = await sendRequest('/api/signup', 'POST', reqBody);
        assert.equal(res.status, 201);

        // now login with the user and make sure he is a Worker
        res = await sendRequest('/api/login', 'POST', reqBody);
        let jwt = (await res.json()).token;
        assert(jwt);
        // Make sure he can't create event
        res = await sendAuthenticatedRequest('/api/event', jwt, 'POST', JSON.stringify(specialEvent));
        assert.equal(res.status, 403);
        // make sure he can access the event
        res = await sendAuthenticatedRequest('/api/event/' + event1._id, jwt, 'GET');
        assert.equal(res.status, 200);
        assert.equal((await res.json()).title, specialEvent.title);

        // signup with redundent fields in body
        reqBody = JSON.stringify({ username: uuidv4().substring(0, 8), password: ";)2", veryImportantInfo: "I'm a hacker" });
        res = await sendRequest('/api/signup', 'POST', reqBody);
        assert.equal(res.status, 201);

        // now login with the user and make sure he is a Worker
        res = await sendRequest('/api/login', 'POST', reqBody);
        jwt = (await res.json()).token;
        assert(jwt);
        // MAke sure he can't create event
        res = await sendAuthenticatedRequest('/api/event', jwt, 'POST', JSON.stringify(specialEvent));
        assert.equal(res.status, 403);
        // make sure he can access the event
        res = await sendAuthenticatedRequest('/api/event/' + event1._id, jwt, 'GET');
        assert.equal(res.status, 200);
        assert.equal((await res.json()).title, specialEvent.title);

        // Admin deletes the event
        res = await sendAuthenticatedRequest('/api/event/' + event1._id, adminJWT, 'DELETE');
        assert.equal(res.status, 200);

    }
    catch (err) {
        consoleLogRed("[FAILED]");
        console.error("Error signing up: ", err);
        return false;
    }
    consoleLogGreen("[OK]");
    return true;
}

async function getEventByIdTest1() {
    // Working on an empty DB
    process.stdout.write("Get Event By ID Test (1).................");
    try {
        // Not authenticated, can't access event
        let res = await sendRequest('/api/event/obviouslyFakeEvent', 'GET');
        assert.equal(res.status, 401);

        // Authenticate
        let jwt = await getJWT("admin", "admin");
        assert(jwt);

        // Authenticated, query for event to discover it doesn't exist
        res = await sendAuthenticatedRequest('/api/event/obviouslyFakeEvent', jwt);
        assert.equal(res.status, 404);
    }
    catch (err) {
        consoleLogRed("[FAILED]");
        console.error("Error getting events: ", err);
        return false;
    }
    consoleLogGreen("[OK]");
    return true;
}

async function getEventByCategoryTest1() {
    // Working on an empty DB
    process.stdout.write("Get Event By Category Test (1)...........");
    try {
        // Not authenticated, can't access event
        let res = await sendRequest('/api/event/Concert', 'GET');
        assert.equal(res.status, 401);

        // Authenticate
        let jwt = await getJWT("admin", "admin");
        assert(jwt);

        // Authenticated, query for event to discover it doesn't exist
        res = await sendAuthenticatedRequest('/api/event/Concert', jwt);
        assert.equal(res.status, 200);
        assert.equal(JSON.stringify((await res.json())), JSON.stringify([]));
    }
    catch (err) {
        consoleLogRed("[FAILED]");
        console.error("Error getting events: ", err);
        return false;
    }
    consoleLogGreen("[OK]");
    return true
}

async function getEventByCategoryTest2() {
    process.stdout.write("Get Event By Category Test (2)...........");
    try {
        const res = await sendAuthenticatedRequest('/api/event/Convention', adminJWT);
        const responseBody = await res.json();
        assert.equal(res.status, 200);
        assert((responseBody.length) > 0);
    }
    catch (err) {
        consoleLogRed("[FAILED]");
        console.error("Error getting events: ", err);
        return false;
    }
    consoleLogGreen("[OK]");
    return true
}

async function getEventByOrgTest1() {
    // Working on an empty DB
    process.stdout.write("Get Event By Org Test (1)................");
    try {
        // Not authenticated, can't access event
        let res = await sendRequest('/api/event/organizer/mushrooman', 'GET');
        assert.equal(res.status, 401);

        // Authenticated, query for event to discover it doesn't exist
        res = await sendAuthenticatedRequest('/api/event/organizer/mushrooman', adminJWT);
        assert.equal(res.status, 200);
        assert.equal(JSON.stringify((await res.json())), JSON.stringify([]));
    }
    catch (err) {
        consoleLogRed("[FAILED]");
        console.error("Error getting events: ", err);
        return false;
    }
    consoleLogGreen("[OK]");
    return true;
}

async function createEventTest(testNumber) {
    process.stdout.write(`Create Event Test (${testNumber})....................`);
    let res;
    try {
        res = await sendAuthenticatedRequest('/api/event', adminJWT, 'POST', JSON.stringify(testEvents[testNumber - 1]));
        assert.equal(res.status, 201);
        let createdEvent = await res.json();
        assert(createdEvent._id);
        createdEventIds.push(createdEvent._id);
    }
    catch (err) {
        consoleLogRed("[FAILED]");
        console.error("Error creating event: ", err);
        return false;
    }

    consoleLogGreen("[OK]");
    return true;
}

async function getEventByIdTest2() {
    // Working on an empty DB
    process.stdout.write("Get Event By ID Test (2).................");
    if (createdEventIds.length == 0) {
        consoleLogRed("[FAILED]");
        console.error("No event created to test with");
        return false;
    }
    try {
        // Authenticated, query for event to discover it doesn't exist
        let res = await sendAuthenticatedRequest('/api/event/' + createdEventIds[0], adminJWT);
        assert.equal(res.status, 200);
        const event = await res.json();
        assert.equal(event.title, baseEvent.title);
        assert.equal(event.category, baseEvent.category);
        assert.equal(event.organizer, baseEvent.organizer);
        assert.equal(event.description, baseEvent.description);
        assert.equal(Date(event.start_date), Date(baseEvent.start_date));
        assert.equal(Date(event.end_date), Date(baseEvent.end_date));
        assert.equal(event.location, baseEvent.location);
        assert.equal(event.image, baseEvent.image);
        assert.equal(event.tickets.length, baseEvent.tickets.length);
        assert.equal(event.tickets[0].name, baseEvent.tickets[0].name);
        assert.equal(event.tickets[0].quantity, baseEvent.tickets[0].quantity);
        assert.equal(event.tickets[0].price, baseEvent.tickets[0].price);

        res = await sendAuthenticatedRequest('/api/event/' + createdEventIds[0] + "?limit=1", adminJWT);
        assert.equal(res.status, 200);
        assert.equal(event.title, baseEvent.title);

        res = await sendAuthenticatedRequest('/api/event/' + createdEventIds[0] + "?limit=lamo", adminJWT);
        assert.equal(res.status, 200);
        assert.equal(event.title, baseEvent.title);

        res = await sendAuthenticatedRequest('/api/event/' + createdEventIds[0] + "?limit=2&skip=9", adminJWT);
        assert.equal(res.status, 200);
        assert.equal(event.title, baseEvent.title);

        res = await sendAuthenticatedRequest('/api/event/' + createdEventIds[0] + "?iDontExist=no", adminJWT);
        assert.equal(res.status, 200);
        assert.equal(event.title, baseEvent.title);

        res = await sendAuthenticatedRequest('/api/event/' + createdEventIds[0] + "?iDontExist=no&skip=-90", adminJWT);
        assert.equal(res.status, 200);
        assert.equal(event.title, baseEvent.title);
    }
    catch (err) {
        consoleLogRed("[FAILED]");
        console.error("Error getting events: ", err);
        return false;
    }
    consoleLogGreen("[OK]");
    return true;
}

async function createInvalidEventTest1() {
    // (1) Check missing mandatory fields
    process.stdout.write("Create Invalid Event Test (1)............");
    let res;
    try {
        // Missing title
        let { "title": title, ...invalidEvent1 } = baseEvent;
        res = await sendAuthenticatedRequest('/api/event', adminJWT, 'POST', JSON.stringify(invalidEvent1));
        assert.equal(res.status, 400);

        invalidEvent1.title = "";
        res = await sendAuthenticatedRequest('/api/event', adminJWT, 'POST', JSON.stringify(invalidEvent1));
        assert.equal(res.status, 400);

        // Missing category
        let { "category": category, ...invalidEvent2 } = baseEvent;
        res = await sendAuthenticatedRequest('/api/event', adminJWT, 'POST', JSON.stringify(invalidEvent2));
        assert.equal(res.status, 400);

        invalidEvent2.category = "";
        res = await sendAuthenticatedRequest('/api/event', adminJWT, 'POST', JSON.stringify(invalidEvent2));
        assert.equal(res.status, 400);

        // Missing description
        let { "description": description, ...invalidEvent3 } = baseEvent;
        res = await sendAuthenticatedRequest('/api/event', adminJWT, 'POST', JSON.stringify(invalidEvent3));
        assert.equal(res.status, 400);

        invalidEvent3.description = "";
        res = await sendAuthenticatedRequest('/api/event', adminJWT, 'POST', JSON.stringify(invalidEvent3));
        assert.equal(res.status, 400);

        // Missing organizer
        let { "organizer": organizer, ...invalidEvent4 } = baseEvent;
        res = await sendAuthenticatedRequest('/api/event', adminJWT, 'POST', JSON.stringify(invalidEvent4));
        assert.equal(res.status, 400);

        invalidEvent4.organizer = "";
        res = await sendAuthenticatedRequest('/api/event', adminJWT, 'POST', JSON.stringify(invalidEvent4));
        assert.equal(res.status, 400);

        // Missing start_date
        let { "start_date": start_date, ...invalidEvent5 } = baseEvent;
        res = await sendAuthenticatedRequest('/api/event', adminJWT, 'POST', JSON.stringify(invalidEvent5));
        assert.equal(res.status, 400);

        invalidEvent5.start_date = "";
        res = await sendAuthenticatedRequest('/api/event', adminJWT, 'POST', JSON.stringify(invalidEvent5));
        assert.equal(res.status, 400);

        // Missing end_date
        let { "end_date": end_date, ...invalidEvent6 } = baseEvent;
        res = await sendAuthenticatedRequest('/api/event', adminJWT, 'POST', JSON.stringify(invalidEvent6));
        assert.equal(res.status, 400);

        invalidEvent6.end_date = "";
        res = await sendAuthenticatedRequest('/api/event', adminJWT, 'POST', JSON.stringify(invalidEvent6));
        assert.equal(res.status, 400);

        // Missing location
        let { "location": location, ...invalidEvent7 } = baseEvent;
        res = await sendAuthenticatedRequest('/api/event', adminJWT, 'POST', JSON.stringify(invalidEvent7));
        assert.equal(res.status, 400);

        invalidEvent7.location = "";
        res = await sendAuthenticatedRequest('/api/event', adminJWT, 'POST', JSON.stringify(invalidEvent7));
        assert.equal(res.status, 400);

        // Missing tickets
        let { "tickets": tickets, ...invalidEvent8 } = baseEvent;
        res = await sendAuthenticatedRequest('/api/event', adminJWT, 'POST', JSON.stringify(invalidEvent8));
        assert.equal(res.status, 400);

        invalidEvent8.tickets = [];
        res = await sendAuthenticatedRequest('/api/event', adminJWT, 'POST', JSON.stringify(invalidEvent8));
        assert.equal(res.status, 400);

        invalidEvent8.tickets = "";
        res = await sendAuthenticatedRequest('/api/event', adminJWT, 'POST', JSON.stringify(invalidEvent8));
        assert.equal(res.status, 400);

        // Just for fun
        invalidEvent8 = "";
        res = await sendAuthenticatedRequest('/api/event', adminJWT, 'POST', JSON.stringify(invalidEvent8));
        assert.equal(res.status, 400);

    }
    catch (err) {
        consoleLogRed("[FAILED]");
        console.error("Error creating event: ", err);
        return false;
    }

    consoleLogGreen("[OK]");
    return true;
}

async function createInvalidEventTest2() {
    process.stdout.write("Create Invalid Event Test (2)............");
    let res;
    try {
        // (2) Check invalid date values
        let invalidEvent9 = { ...baseEvent };
        invalidEvent9.start_date = "123456789";
        res = await sendAuthenticatedRequest('/api/event', adminJWT, 'POST', JSON.stringify(invalidEvent9));
        assert.equal(res.status, 400);

        invalidEvent9.start_date = "2010-01-01-10:00";
        res = await sendAuthenticatedRequest('/api/event', adminJWT, 'POST', JSON.stringify(invalidEvent9));
        assert.equal(res.status, 400);

        invalidEvent9.start_date = "2010-41-01T10:00";
        res = await sendAuthenticatedRequest('/api/event', adminJWT, 'POST', JSON.stringify(invalidEvent9));
        assert.equal(res.status, 400);

        invalidEvent9.start_date = "2010-10-41T10:00";
        res = await sendAuthenticatedRequest('/api/event', adminJWT, 'POST', JSON.stringify(invalidEvent9));
        assert.equal(res.status, 400);

        invalidEvent9.start_date = "2010-21-01T10:00";
        res = await sendAuthenticatedRequest('/api/event', adminJWT, 'POST', JSON.stringify(invalidEvent9));
        assert.equal(res.status, 400);

        invalidEvent9.start_date = "2010-01-01T10:01";
        invalidEvent9.end_date = "2010-01-01T10:00";
        res = await sendAuthenticatedRequest('/api/event', adminJWT, 'POST', JSON.stringify(invalidEvent9));
        assert.equal(res.status, 400);

        // (3) Check other invalid values
        let invalidEvent10 = { ...baseEvent };
        invalidEvent10.category = "InvalidCategory";
        res = await sendAuthenticatedRequest('/api/event', adminJWT, 'POST', JSON.stringify(invalidEvent10));
        assert.equal(res.status, 400);

        let invalidEvent11 = { ...baseEvent };
        invalidEvent11.tickets[0].price = -1;
        res = await sendAuthenticatedRequest('/api/event', adminJWT, 'POST', JSON.stringify(invalidEvent10));
        assert.equal(res.status, 400);

        invalidEvent11.tickets[0].price = 100;
        invalidEvent11.tickets[0].quantity = -1;
        res = await sendAuthenticatedRequest('/api/event', adminJWT, 'POST', JSON.stringify(invalidEvent10));
        assert.equal(res.status, 400);

        invalidEvent11.tickets[0].quantity = "eight";
        res = await sendAuthenticatedRequest('/api/event', adminJWT, 'POST', JSON.stringify(invalidEvent10));
        assert.equal(res.status, 400);

        invalidEvent11.tickets[0].quantity = 80;
        invalidEvent11.tickets = []
        res = await sendAuthenticatedRequest('/api/event', adminJWT, 'POST', JSON.stringify(invalidEvent10));
        assert.equal(res.status, 400);
    }
    catch (err) {
        consoleLogRed("[FAILED]");
        console.error("Error creating event: ", err);
        return false;
    }

    consoleLogGreen("[OK]");
    return true;
}

async function createEventWithUselessFields() {
    process.stdout.write("Create Event With Useless Fields Test....");
    let res;
    try {
        let uselessEvent = { ...baseEvent };
        uselessEvent.uselessField = "I'm useless";
        res = await sendAuthenticatedRequest('/api/event', adminJWT, 'POST', JSON.stringify(uselessEvent));
        assert.equal(res.status, 201);
        let createdEvent = await res.json();
        assert(createdEvent._id);

        res = await sendAuthenticatedRequest('/api/event/' + createdEvent._id, adminJWT);
        assert.equal(res.status, 200);
        let responseBody = await res.json();
        assert.equal(responseBody.uselessField, undefined);

        res = await sendAuthenticatedRequest('/api/event/' + createdEvent._id, adminJWT, 'DELETE');
        assert.equal(res.status, 200);
    }
    catch (err) {
        consoleLogRed("[FAILED]");
        console.error("Error creating event: ", err);
        return false;
    }

    consoleLogGreen("[OK]");
    return true;
}

async function updatePermissionsTest1() {
    // Make sure admin can update permissions
    process.stdout.write("Upgrade Permissions Test (1).............");
    let res;
    try {
        res = await sendAuthenticatedRequest('/api/permission', adminJWT, 'PUT', JSON.stringify({ username: 'manager', permission: 'M' }));
        assert.equal(res.status, 200);
    }
    catch (err) {
        consoleLogRed("[FAILED]");
        console.error("Error upgrading permissions: ", err);
        return false;
    }
    consoleLogGreen("[OK]");
    return true;
}

async function updatePermissionsTest2() {
    // Make sure manager can't update permissions
    process.stdout.write("Upgrade Permissions Test (2).............");
    let res;
    try {
        res = await sendRequest('/api/permission', 'PUT', JSON.stringify({ username: 'worker', permission: 'M' }));
        assert.equal(res.status, 401);

        let jwt = await getJWT("manager", "manager");
        assert(jwt);
        res = await sendAuthenticatedRequest('/api/permission', jwt, 'PUT', JSON.stringify({ username: 'worker', permission: 'M' }));
        assert.equal(res.status, 403);

        jwt = await getJWT("worker", "worker");
        assert(jwt);
        res = await sendAuthenticatedRequest('/api/permission', jwt, 'PUT', JSON.stringify({ username: 'worker', permission: 'M' }));
        assert.equal(res.status, 403);

        res = await sendAuthenticatedRequest('/api/permission', adminJWT, 'PUT', JSON.stringify({ username: 'worker', permission: 'A' }));
        assert.equal(res.status, 400);

        res = await sendAuthenticatedRequest('/api/permission', adminJWT, 'PUT', JSON.stringify({ username: 'worker', permission: 'mega' }));
        assert.equal(res.status, 400);

        res = await sendAuthenticatedRequest('/api/permission', adminJWT, 'PUT', JSON.stringify({ username: 'worker', permission: 'Manager' }));
        assert.equal(res.status, 400);

        res = await sendAuthenticatedRequest('/api/permission', adminJWT, 'PUT', JSON.stringify({ username: 'worker' }));
        assert.equal(res.status, 400);

        res = await sendAuthenticatedRequest('/api/permission', adminJWT, 'PUT', JSON.stringify({ permission: 'W' }));
        assert.equal(res.status, 400);

        res = await sendAuthenticatedRequest('/api/permission', adminJWT, 'PUT', JSON.stringify({ username: 'admin', permission: 'W' }));
        assert.equal(res.status, 400); // Piazza (@74)

        res = await sendAuthenticatedRequest('/api/permission', adminJWT, 'PUT', JSON.stringify({ username: 'admin', permission: 'A' }));
        assert.equal(res.status, 400); // Piazza (@74)

        // Make sure admin is still admin after all the hate it got
        res = await sendAuthenticatedRequest('/api/permission', adminJWT, 'PUT', JSON.stringify({ username: 'worker', permission: 'W' }));
        assert.equal(res.status, 200);

    }
    catch (err) {
        consoleLogRed("[FAILED]");
        console.error("Error upgrading permissions: ", err);
        return false;
    }
    consoleLogGreen("[OK]");
    return true;
}

async function createWorker() {
    try {
        await sendRequest('/api/signup', 'POST', JSON.stringify({ username: 'worker', password: 'worker' }));
    }
    catch (err) {
        return false;
    }
    return true;
}

async function createManager() {
    try {
        await sendRequest('/api/signup', 'POST', JSON.stringify({ username: 'manager', password: 'manager' }));
        await sendAuthenticatedRequest('/api/permission', adminJWT, 'PUT', JSON.stringify({ username: 'manager', permission: 'M' }));
    }
    catch (err) {
        return false;
    }
    return true;
}

async function getEventByOrgTest2() {
    // Working on an empty DB
    process.stdout.write("Get Event By Org Test (2)................");
    try {
        // Not authenticated, can't access event
        let res = await sendRequest('/api/event/organizer/Malina', 'GET');
        assert.equal(res.status, 401);

        // Authenticated, query for event to discover it doesn't exist
        res = await sendAuthenticatedRequest('/api/event/organizer/Malina', adminJWT);
        assert.equal(res.status, 200);
        const requestBody = await res.json();
        assert(requestBody.length > 0);
        assert.equal(requestBody[0].organizer, "Malina");
        assert.equal(requestBody[0].title, "Marvel Convention");
    }
    catch (err) {
        consoleLogRed("[FAILED]");
        console.error("Error getting events: ", err);
        return false;
    }
    consoleLogGreen("[OK]");
    return true;
}

async function useQueryParams1() {
    process.stdout.write("Get By Category Query Params Test (1)....");
    try {
        // Not authenticated, can't access event
        let res = await sendRequest('/api/event/Concert', 'GET');
        assert.equal(res.status, 401);

        // Authenticated, query for event 
        res = await sendAuthenticatedRequest('/api/event/Convention', adminJWT);
        assert.equal(res.status, 200);
        let responseBody = await res.json();
        assert(Array.isArray(responseBody), 'Expected events to be an array');
        assert.notEqual((responseBody.length), 0);

        res = await sendAuthenticatedRequest('/api/event/Convention?limit=1', adminJWT);
        assert.equal(res.status, 200);
        responseBody = await res.json();
        assert(Array.isArray(responseBody), 'Expected events to be an array');
        assert.equal(responseBody.length, 1);

        res = await sendAuthenticatedRequest('/api/event/Convention?limit=2', adminJWT);
        assert.equal(res.status, 200);
        responseBody = await res.json();
        assert(Array.isArray(responseBody), 'Expected events to be an array');
        assert.equal((responseBody.length), 2);
    }
    catch (err) {
        consoleLogRed("[FAILED]");
        console.error("Error getting events: ", err);
        return false;
    }
    consoleLogGreen("[OK]");
    return true
}

async function useQueryParams2() {
    process.stdout.write("Get By Category Query Params Test (2)....");
    try {
        // Not authenticated, can't access event
        let res = await sendRequest('/api/event/Convention', 'GET');
        assert.equal(res.status, 401);

        // Authenticated, query for event 
        res = await sendAuthenticatedRequest('/api/event/Convention', adminJWT);
        assert.equal(res.status, 200);
        let responseBody = await res.json();
        assert(Array.isArray(responseBody), 'Expected events to be an array');
        assert.notEqual((responseBody.length), 0);
        assert.equal(responseBody[0].title, "DC Convention");
        assert.equal(responseBody[0].organizer, "WB-DC Team");

        res = await sendAuthenticatedRequest('/api/event/Convention?skip=1', adminJWT);
        assert.equal(res.status, 200);
        responseBody = await res.json();
        assert(Array.isArray(responseBody), 'Expected events to be an array');
        assert.equal(responseBody[0].title, "Marvel Convention");
        assert.equal(responseBody[0].organizer, "Malina");
        const totalConventions = responseBody.length;

        res = await sendAuthenticatedRequest('/api/event/Convention?skip=1&limit=1', adminJWT);
        assert.equal(res.status, 200);
        responseBody = await res.json();
        assert.equal((responseBody.length), 1);
        assert.equal(responseBody[0].title, "Marvel Convention");
        assert.equal(responseBody[0].organizer, "Malina");

        res = await sendAuthenticatedRequest('/api/event/Convention?limit=3&skip=1', adminJWT);
        assert.equal(res.status, 200);
        responseBody = await res.json();
        assert(2 <= responseBody.length <= Math.min(3, totalConventions));
    }
    catch (err) {
        consoleLogRed("[FAILED]");
        console.error("Error getting events: ", err);
        return false;
    }
    consoleLogGreen("[OK]");
    return true
}

async function useQueryParams3() {
    process.stdout.write("Get By Category Query Params Test (3)....");
    try {
        // Not authenticated, can't access event
        let res = await sendRequest('/api/event/Convention', 'GET');
        assert.equal(res.status, 401);

        // Authenticated, query for event 
        res = await sendAuthenticatedRequest('/api/event/Convention', adminJWT);
        assert.equal(res.status, 200);
        let responseBody = await res.json();
        assert(Array.isArray(responseBody), 'Expected events to be an array');
        assert.notEqual((responseBody.length), 0);
        assert.equal(responseBody[0].title, "DC Convention");
        assert.equal(responseBody[0].organizer, "WB-DC Team");

        // Test invalid query params [!!! MAY BE IGNORED BY PIAZZA @105]
        res = await sendAuthenticatedRequest('/api/event/Convention?skip=-4', adminJWT);
        responseBody = await res.json();
        assert.equal(res.status, 200);
        assert(responseBody.length > 0);
        
        res = await sendAuthenticatedRequest('/api/event/Convention?limit=lmao', adminJWT);
        responseBody = await res.json();
        assert.equal(res.status, 200);
        assert(responseBody.length > 0);
        
        res = await sendAuthenticatedRequest('/api/event/Convention?limit=-1&skip=-100', adminJWT);
        responseBody = await res.json();
        assert.equal(res.status, 200);
        assert(responseBody.length > 0);
        
        res = await sendAuthenticatedRequest('/api/event/Convention?limit=1&skip=-100', adminJWT);
        responseBody = await res.json();
        assert.equal(res.status, 200);
        assert(responseBody.length > 0);
        
        res = await sendAuthenticatedRequest('/api/event/Convention?limit=yas&skip=5', adminJWT);
        responseBody = await res.json();
        assert.equal(res.status, 200);
        
        res = await sendAuthenticatedRequest('/api/event/Convention?limit=none&skip=all', adminJWT);
        responseBody = await res.json();
        assert.equal(res.status, 200);
        assert(responseBody.length > 0);
        
        res = await sendAuthenticatedRequest('/api/event/Convention?limit=none&skip=all&ok=4', adminJWT);
        responseBody = await res.json();
        assert.equal(res.status, 200);
        assert(responseBody.length > 0);
        
        res = await sendAuthenticatedRequest('/api/event/Convention?limit=none&skip=all&limit=4', adminJWT);
        responseBody = await res.json();
        assert.equal(res.status, 200);
        assert(responseBody.length > 0);
        
        // Ignored on non-related route
        let reqBody = JSON.stringify({ username: "admin", password: "admin" });
        res = await sendRequest('/api/login?limit=none&skip=all&limit=4', "POST", reqBody);
        assert.equal(res.status, 200);
        assert((await res.json()).token);

    }
    catch (err) {
        consoleLogRed("[FAILED]");
        console.error("Error getting events: ", err);
        return false;
    }
    consoleLogGreen("[OK]");
    return true
}

async function deleteEvent(testNumber) {
    process.stdout.write(`Delete Event Test (${testNumber})....................`);
    let res;

    try {
        // Not authenticated, can't access event
        res = await sendRequest('/api/event/Convention', 'GET');
        assert.equal(res.status, 401);

        let managerJWT = await getJWT("manager", "manager");
        let workerJWT = await getJWT("worker", "worker");

        // Authenticated, but insufficiant permissions
        [managerJWT, workerJWT].forEach(async (jwt) => {
            res = await sendAuthenticatedRequest('/api/event/' + createdEventIds[testNumber - 1], jwt, 'DELETE');
            assert.equal(res.status, 403);
        });

        res = await sendAuthenticatedRequest('/api/event/' + createdEventIds[testNumber - 1], adminJWT, 'DELETE');
        assert.equal(res.status, 200);
    }
    catch (err) {
        consoleLogRed("[FAILED]");
        console.error("Error deleting event: ", err);
        return false;
    }

    consoleLogGreen("[OK]");
    return true;
}

async function deleteNonexistingEvent() {
    process.stdout.write("Delete Nonexisting Event Test............");
    let res;
    try {
        res = await sendAuthenticatedRequest('/api/event/obviouslyFakeEvent', adminJWT, 'DELETE');
        assert.equal(res.status, 200);
        res = await sendAuthenticatedRequest('/api/event/123412341234123412341234', adminJWT, 'DELETE');
        assert.equal(res.status, 200);
    }
    catch (err) {
        consoleLogRed("[FAILED]");
        console.error("Error deleting event: ", err);
        return false;
    }
    consoleLogGreen("[OK]");
    return true;
}

async function createAndDeleteEvent() {
    process.stdout.write("Create and Delete Event Test.............");
    let res;
    try {
        res = await sendAuthenticatedRequest('/api/event', adminJWT, 'POST', JSON.stringify(specialEvent));
        assert.equal(res.status, 201);
        let createdEvent = await res.json();
        assert(createdEvent._id);
        res = await sendAuthenticatedRequest('/api/event/' + createdEvent._id, adminJWT);
        assert.equal(res.status, 200);
        res = await sendAuthenticatedRequest('/api/event/' + createdEvent._id, adminJWT, 'DELETE');
        assert.equal(res.status, 200);
        await setTimeout(() => { }, 1000);
        res = await sendAuthenticatedRequest('/api/event/' + createdEvent._id, adminJWT);
        assert.equal(res.status, 404);
    }
    catch (error) {
        consoleLogRed("[FAILED]");
        console.error("Error creating and deleting event: ", error);
        return false;
    }

    consoleLogGreen("[OK]");
    return true;
}

async function IncompleteDataTest() {
    process.stdout.write("Incomplete Data Test.....................");
    let res;
    try {
        res = await sendAuthenticatedRequest('/api/event', adminJWT, 'POST', JSON.stringify({}));
        assert.equal(res.status, 400);

        res = await sendAuthenticatedRequest('/api/signup', adminJWT, 'POST', JSON.stringify({}));
        assert.equal(res.status, 400);

        res = await sendAuthenticatedRequest('/api/signup', adminJWT, 'POST', JSON.stringify({ username: "AAAAAAAAAAAA" }));
        assert.equal(res.status, 400);

        res = await sendAuthenticatedRequest('/api/signup', adminJWT, 'POST', JSON.stringify({ password: "AAAAAAAAAAAA" }));
        assert.equal(res.status, 400);
    }
    catch (err) {
        consoleLogRed("[FAILED]");
        console.error(err);
        return false;
    }

    consoleLogGreen("[OK]");
    return true;
}

async function invalidTokenTest() {
    process.stdout.write("Invalid Token Test.......................");
    try {
        let res = await sendAuthenticatedRequest('/api/event/Convention', "invalidToken");
        assert.equal(res.status, 401);
    }
    catch (err) {
        consoleLogRed("[FAILED]");
        console.error("Error getting events: ", err);
        return false;
    }
    consoleLogGreen("[OK]");
    return true
}

async function updateEventTest1() {
    process.stdout.write("Update Event Test (1)....................");
    let res;
    let responseBody;
    try {
        // Create
        res = await sendAuthenticatedRequest('/api/event', adminJWT, 'POST', JSON.stringify(specialEvent));
        assert.equal(res.status, 201);
        let createdEvent = await res.json();
        assert(createdEvent._id);

        // Get
        res = await sendAuthenticatedRequest('/api/event/' + createdEvent._id, adminJWT);
        assert.equal(res.status, 200);
        responseBody = await res.json();
        assert.equal(responseBody.title, specialEvent.title);

        // Update
        res = await sendAuthenticatedRequest('/api/event/' + createdEvent._id, adminJWT, 'PUT', JSON.stringify({ title: "No title - REOL" }));
        assert.equal(res.status, 200);

        // Get again
        res = await sendAuthenticatedRequest('/api/event/' + createdEvent._id, adminJWT);
        assert.equal(res.status, 200);
        responseBody = await res.json();
        assert.equal(responseBody.title, "No title - REOL");

        // Delete
        res = await sendAuthenticatedRequest('/api/event/' + createdEvent._id, adminJWT, 'DELETE');
        assert.equal(res.status, 200);

    }
    catch (err) {
        consoleLogRed("[FAILED]");
        console.error("Error getting events: ", err);
        return false;
    }
    consoleLogGreen("[OK]");
    return true
}

async function updateEventTest2() {
    // Only admins and managers can update events
    process.stdout.write("Update Event Test (2)....................");
    let res;
    let responseBody;
    let workerJWT = await getJWT("worker", "worker");
    let managerJWT = await getJWT("manager", "manager");
    try {
        // Create
        assert(managerJWT);
        res = await sendAuthenticatedRequest('/api/event', managerJWT, 'POST', JSON.stringify(specialEvent));
        assert.equal(res.status, 201);
        let createdEvent = await res.json();
        assert(createdEvent._id);

        // Get
        res = await sendAuthenticatedRequest('/api/event/' + createdEvent._id, adminJWT);
        assert.equal(res.status, 200);
        responseBody = await res.json();
        assert.equal(responseBody.title, specialEvent.title);

        // Update with unauthorized user
        res = await sendAuthenticatedRequest('/api/event/' + createdEvent._id, workerJWT, 'PUT', JSON.stringify({ title: "No title - REOL" }));
        assert.equal(res.status, 403);

        // Get again
        res = await sendAuthenticatedRequest('/api/event/' + createdEvent._id, adminJWT);
        assert.equal(res.status, 200);
        responseBody = await res.json();
        assert.equal(responseBody.title, specialEvent.title);

        // Update with authorized user (manager)
        res = await sendAuthenticatedRequest('/api/event/' + createdEvent._id, managerJWT, 'PUT', JSON.stringify({ title: "No title - REOL" }));
        assert.equal(res.status, 200);

        // Get once again
        res = await sendAuthenticatedRequest('/api/event/' + createdEvent._id, adminJWT);
        assert.equal(res.status, 200);
        responseBody = await res.json();
        assert.equal(responseBody.title, "No title - REOL");

        // Delete
        res = await sendAuthenticatedRequest('/api/event/' + createdEvent._id, adminJWT, 'DELETE');
        assert.equal(res.status, 200);

    }
    catch (err) {
        consoleLogRed("[FAILED]");
        console.error("Error getting events: ", err);
        return false;
    }
    consoleLogGreen("[OK]");
    return true
}

async function updateEventTest3() {
    process.stdout.write("Update Event Test (3)....................");
    let res;
    let responseBody;
    try {
        // Create
        res = await sendAuthenticatedRequest('/api/event', adminJWT, 'POST', JSON.stringify(specialEvent));
        assert.equal(res.status, 201);
        let createdEvent = await res.json();
        assert(createdEvent._id);

        // Get
        res = await sendAuthenticatedRequest('/api/event/' + createdEvent._id, adminJWT);
        assert.equal(res.status, 200);
        responseBody = await res.json();
        assert.equal(responseBody.title, specialEvent.title);

        // Update - empty title
        res = await sendAuthenticatedRequest('/api/event/' + createdEvent._id, adminJWT, 'PUT', JSON.stringify({ title: "" }));
        assert.equal(res.status, 400);

        // Get again
        res = await sendAuthenticatedRequest('/api/event/' + createdEvent._id, adminJWT);
        assert.equal(res.status, 200);
        responseBody = await res.json();
        assert.equal(responseBody.title, specialEvent.title);

        // Update - empty description
        res = await sendAuthenticatedRequest('/api/event/' + createdEvent._id, adminJWT, 'PUT', JSON.stringify({ title: "" }));
        assert.equal(res.status, 400);

        // Get again
        res = await sendAuthenticatedRequest('/api/event/' + createdEvent._id, adminJWT);
        assert.equal(res.status, 200);
        responseBody = await res.json();
        assert.equal(responseBody.description, specialEvent.description);

        // Update - empty category
        res = await sendAuthenticatedRequest('/api/event/' + createdEvent._id, adminJWT, 'PUT', JSON.stringify({ category: "" }));
        assert.equal(res.status, 400);

        // Get again
        res = await sendAuthenticatedRequest('/api/event/' + createdEvent._id, adminJWT);
        assert.equal(res.status, 200);
        responseBody = await res.json();
        assert.equal(responseBody.category, specialEvent.category);

        // Update - invalid category
        res = await sendAuthenticatedRequest('/api/event/' + createdEvent._id, adminJWT, 'PUT', JSON.stringify({ category: "invalid" }));
        assert.equal(res.status, 400);

        // Get again
        res = await sendAuthenticatedRequest('/api/event/' + createdEvent._id, adminJWT);
        assert.equal(res.status, 200);
        responseBody = await res.json();
        assert.equal(responseBody.category, specialEvent.category);

        // Update - empty organizer
        res = await sendAuthenticatedRequest('/api/event/' + createdEvent._id, adminJWT, 'PUT', JSON.stringify({ organizer: "" }));
        assert.equal(res.status, 400);

        // Get again
        res = await sendAuthenticatedRequest('/api/event/' + createdEvent._id, adminJWT);
        assert.equal(res.status, 200);
        responseBody = await res.json();
        assert.equal(responseBody.organizer, specialEvent.organizer);


        // Update - empty tickets
        res = await sendAuthenticatedRequest('/api/event/' + createdEvent._id, adminJWT, 'PUT', JSON.stringify({ tickets: [] }));
        assert.equal(res.status, 400);

        // Get again
        res = await sendAuthenticatedRequest('/api/event/' + createdEvent._id, adminJWT);
        assert.equal(res.status, 200);
        responseBody = await res.json();
        assert.equal(JSON.stringify(responseBody.tickets), JSON.stringify(specialEvent.tickets));

        // Update - invalid tickets
        res = await sendAuthenticatedRequest('/api/event/' + createdEvent._id, adminJWT, 'PUT', JSON.stringify({ tickets: "good ticket" }));
        assert.equal(res.status, 400);

        res = await sendAuthenticatedRequest('/api/event/' + createdEvent._id, adminJWT, 'PUT', JSON.stringify({ tickets: [{ name: "Valid", price: -1, quantity: 50 }] }));
        assert.equal(res.status, 400);

        res = await sendAuthenticatedRequest('/api/event/' + createdEvent._id, adminJWT, 'PUT', JSON.stringify({ tickets: [{ name: "", price: 50, quantity: 50 }] }));
        assert.equal(res.status, 400);

        // Get again
        res = await sendAuthenticatedRequest('/api/event/' + createdEvent._id, adminJWT);
        assert.equal(res.status, 200);
        responseBody = await res.json();
        assert.equal(JSON.stringify(responseBody.tickets), JSON.stringify(specialEvent.tickets));


        // Update - invalid start_date
        res = await sendAuthenticatedRequest('/api/event/' + createdEvent._id, adminJWT, 'PUT', JSON.stringify({ start_date: "2010 or smthn idk" }));
        assert.equal(res.status, 400);

        // Get again
        res = await sendAuthenticatedRequest('/api/event/' + createdEvent._id, adminJWT);
        assert.equal(res.status, 200);
        responseBody = await res.json();
        assert.equal(Date(responseBody.start_date), Date(specialEvent.start_date));

        // Update - invalid start_date
        res = await sendAuthenticatedRequest('/api/event/' + createdEvent._id, adminJWT, 'PUT', JSON.stringify({ start_date: "2010-01-01TTT01:01" }));
        assert.equal(res.status, 400);

        // Get again
        res = await sendAuthenticatedRequest('/api/event/' + createdEvent._id, adminJWT);
        assert.equal(res.status, 200);
        responseBody = await res.json();
        assert.equal(Date(responseBody.start_date), Date(specialEvent.start_date));

        // Update - empty end_date
        res = await sendAuthenticatedRequest('/api/event/' + createdEvent._id, adminJWT, 'PUT', JSON.stringify({ end_date: "" }));
        assert.equal(res.status, 400);

        // Get again
        res = await sendAuthenticatedRequest('/api/event/' + createdEvent._id, adminJWT);
        assert.equal(res.status, 200);
        responseBody = await res.json();
        assert.equal(Date(responseBody.end_date), Date(specialEvent.end_date));

        // Update - end_date before start_date
        res = await sendAuthenticatedRequest('/api/event/' + createdEvent._id, adminJWT, 'PUT', JSON.stringify({ end_date: "2014-01-05T10:00" }));
        assert.equal(res.status, 400);

        // Get again
        res = await sendAuthenticatedRequest('/api/event/' + createdEvent._id, adminJWT);
        assert.equal(res.status, 200);
        responseBody = await res.json();
        assert.equal(Date(responseBody.end_date), Date(specialEvent.end_date));

        // Update - end_date before start_date 2
        res = await sendAuthenticatedRequest('/api/event/' + createdEvent._id, adminJWT, 'PUT', JSON.stringify({ start_date: "2014-01-10T10:00", end_date: "2014-01-05T10:00" }));
        assert.equal(res.status, 400);

        // Get again
        res = await sendAuthenticatedRequest('/api/event/' + createdEvent._id, adminJWT);
        assert.equal(res.status, 200);
        responseBody = await res.json();
        assert.equal(Date(responseBody.end_date), Date(specialEvent.end_date));
        assert.equal(Date(responseBody.start_date), Date(specialEvent.start_date));

        // Delete
        res = await sendAuthenticatedRequest('/api/event/' + createdEvent._id, adminJWT, 'DELETE');
        assert.equal(res.status, 200);

    }
    catch (err) {
        consoleLogRed("[FAILED]");
        console.error("Error getting events: ", err);
        return false;
    }
    consoleLogGreen("[OK]");
    return true
}

// 400 before 404 when PUT data is invalid
async function updateEventTest4() {
    process.stdout.write("Update Event Test (4)....................");
    let res;
    try {
        // Get
        res = await sendAuthenticatedRequest('/api/event/' + 7, adminJWT);
        assert.equal(res.status, 404);

        // Update - empty title
        res = await sendAuthenticatedRequest('/api/event/' + 7, adminJWT, 'PUT', JSON.stringify({ title: "" }));
        assert.equal(res.status, 400);

        // Update - empty description
        res = await sendAuthenticatedRequest('/api/event/' + 7, adminJWT, 'PUT', JSON.stringify({ title: "" }));
        assert.equal(res.status, 400);

        // Update - empty category
        res = await sendAuthenticatedRequest('/api/event/' + 7, adminJWT, 'PUT', JSON.stringify({ category: "" }));
        assert.equal(res.status, 400);

        // Update - invalid category
        res = await sendAuthenticatedRequest('/api/event/' + 7, adminJWT, 'PUT', JSON.stringify({ category: "invalid" }));
        assert.equal(res.status, 400);

        // Update - empty organizer
        res = await sendAuthenticatedRequest('/api/event/' + 7, adminJWT, 'PUT', JSON.stringify({ organizer: "" }));
        assert.equal(res.status, 400);

        // Update - empty tickets
        res = await sendAuthenticatedRequest('/api/event/' + 7, adminJWT, 'PUT', JSON.stringify({ tickets: [] }));
        assert.equal(res.status, 400);

        // Update - invalid tickets
        res = await sendAuthenticatedRequest('/api/event/' + 7, adminJWT, 'PUT', JSON.stringify({ tickets: "good ticket" }));
        assert.equal(res.status, 400);

        // Update - invalid start_date
        res = await sendAuthenticatedRequest('/api/event/' + 7, adminJWT, 'PUT', JSON.stringify({ start_date: "2010 or smthn idk" }));
        assert.equal(res.status, 400);

        // Update - empty end_date
        res = await sendAuthenticatedRequest('/api/event/' + 7, adminJWT, 'PUT', JSON.stringify({ end_date: "" }));
        assert.equal(res.status, 400);

        // Update - invalid format
        res = await sendAuthenticatedRequest('/api/event/' + 7, adminJWT, 'PUT', JSON.stringify({ end_date: "2014-01-05:10:00" }));
        assert.equal(res.status, 400);

        // Update - valid end_date
        res = await sendAuthenticatedRequest('/api/event/' + 7, adminJWT, 'PUT', JSON.stringify({ end_date: "2014-01-05T10:00" }));
        assert.equal(res.status, 404);

        // Get
        res = await sendAuthenticatedRequest('/api/event/' + 7, adminJWT);
        assert.equal(res.status, 404);

    }
    catch (err) {
        consoleLogRed("[FAILED]");
        console.error("Error getting events: ", err);
        return false;
    }
    consoleLogGreen("[OK]");
    return true
}

async function updateEventTest5() {
    process.stdout.write("Update Event Test (5)....................");
    let res;
    try {
        // Update - title
        res = await sendAuthenticatedRequest('/api/event/' + 8, adminJWT, 'PUT', JSON.stringify({ title: "Valid title" }));
        assert.equal(res.status, 404);

        // Update - description
        res = await sendAuthenticatedRequest('/api/event/' + 8, adminJWT, 'PUT', JSON.stringify({ title: "Valid description" }));
        assert.equal(res.status, 404);

        // Update - category
        res = await sendAuthenticatedRequest('/api/event/' + 8, adminJWT, 'PUT', JSON.stringify({ category: "Festival" }));
        assert.equal(res.status, 404);

        // Update - organizer
        res = await sendAuthenticatedRequest('/api/event/' + 8, adminJWT, 'PUT', JSON.stringify({ organizer: "valid organizer" }));
        assert.equal(res.status, 404);

        // Update - tickets
        res = await sendAuthenticatedRequest('/api/event/' + 8, adminJWT, 'PUT', JSON.stringify({ tickets: [{ name: "mega", quantity: 50, price: 50 }] }));
        assert.equal(res.status, 404);

        // Update - start_date
        res = await sendAuthenticatedRequest('/api/event/' + 8, adminJWT, 'PUT', JSON.stringify({ start_date: "2014-01-05T04:00" }));
        assert.equal(res.status, 404);

        // Update - end_date
        res = await sendAuthenticatedRequest('/api/event/' + 8, adminJWT, 'PUT', JSON.stringify({ end_date: "2014-01-05T04:00" }));
        assert.equal(res.status, 404);

        // Update - end_date and start_date
        res = await sendAuthenticatedRequest('/api/event/' + 8, adminJWT, 'PUT', JSON.stringify({ end_date: "2014-01-05T04:00", end_date: "2014-01-05T10:00" }));
        assert.equal(res.status, 404);

    }
    catch (err) {
        consoleLogRed("[FAILED]");
        console.error("Error getting events: ", err);
        return false;
    }
    consoleLogGreen("[OK]");
    return true
}

async function errorsTest() {
    process.stdout.write("Errors Test .............................");
    let res;
    try {
        // Broken JSON
        res = await sendAuthenticatedRequest('/api/event/' + 8, adminJWT, 'PUT', "title 'missing :'");
        assert.equal(res.status, 400);
        
        res = await sendAuthenticatedRequest('/api/event', adminJWT, 'POST', JSON.stringify(specialEvent) + "XAX::}{{");
        assert.equal(res.status, 400);
        
        res = await sendAuthenticatedRequest('/api/card', adminJWT, 'POST', JSON.stringify(specialEvent) + "XAX::}{{");
        assert.equal(res.status, 404);
        
        // Title wrong type (it's an array instead of a string)
        let invalidEventTypes = { ...specialEvent }
        invalidEventTypes.title = ["invalid Title"]
        res = await sendAuthenticatedRequest('/api/event', adminJWT, 'POST', JSON.stringify(invalidEventTypes));
        assert.equal(res.status, 400);
        
        let invalidEventTypes2 = { ...specialEvent }
        invalidEventTypes2.tickets = ["ticket1", "ticket2", "ticket3"];
        res = await sendAuthenticatedRequest('/api/event', adminJWT, 'POST', JSON.stringify(invalidEventTypes2));
        assert.equal(res.status, 400);
        
        res = await sendAuthenticatedRequest('/api/event', adminJWT, 'POST', JSON.stringify(specialEvent));
        assert.equal(res.status, 201);
        let createdEventID = await res.json();

        res = await sendAuthenticatedRequest('/api/eventtt/' + createdEventID, adminJWT);
        assert.equal(res.status, 404);

        await sendAuthenticatedRequest('/api/event/' + createdEventID, adminJWT, 'DELETE');

        res = await sendAuthenticatedRequest('/api/signup/please', adminJWT, 'POST', JSON.stringify({ username: "AAAAAAAAAAAA", password: "AAAAAAAAAAAA" }));
        assert.equal(res.status, 404);

        res = await sendAuthenticatedRequest('/api/events/organizer/mushrooman', adminJWT, 'POST', JSON.stringify({ username: "AAAAAAAAAAAA", password: "AAAAAAAAAAAA" }));
        assert.equal(res.status, 404);

        res = await sendAuthenticatedRequest('/api/events/organizer/mushrooman', adminJWT, 'PUT', JSON.stringify({ username: "AAAAAAAAAAAA", password: "AAAAAAAAAAAA" }));
        assert.equal(res.status, 404);

        res = await sendAuthenticatedRequest('/api/signup', adminJWT, 'GET');
        assert.equal(res.status, 404, "GET /api/signup doesn't exist (It should be POST. 404)");

        res = await sendAuthenticatedRequest('/api/login', adminJWT, 'GET');
        assert.equal(res.status, 404);

        res = await sendAuthenticatedRequest('/api/event/1', adminJWT, 'POST', JSON.stringify({}));
        assert.equal(res.status, 404);
    }
    catch (err) {
        consoleLogRed("[FAILED]");
        console.error("Error getting events: ", err);
        return false;
    }

    consoleLogGreen("[OK]");
    return true;
}

async function queryLimitTest() {
    process.stdout.write("Query Limit Test ........................");
    let res;
    try {

        let newCreatedEventIds = [];
        let newBaseEvent = { ...baseEvent };
        newBaseEvent.organizer = "NissoMahMan";
        // Create 100 events
        for (let i = 0; i < 100; i++) {
            res = await sendAuthenticatedRequest('/api/event', adminJWT, 'POST', JSON.stringify(newBaseEvent));
            assert.equal(res.status, 201);
            let createdEvent = await res.json();
            assert(createdEvent._id);
            newCreatedEventIds.push(createdEvent._id);
            await new Promise(r => setTimeout(r, 100));
        }

        res = await sendAuthenticatedRequest('/api/event/organizer/NissoMahMan' + "?limit=1", adminJWT);
        assert.equal(res.status, 200);
        let responseBody = await res.json();
        assert(responseBody.length == 1);

        res = await sendAuthenticatedRequest('/api/event/organizer/NissoMahMan' + "?limit=60", adminJWT);
        assert.equal(res.status, 200);
        responseBody = await res.json();
        assert(responseBody.length == 50);

        res = await sendAuthenticatedRequest('/api/event/organizer/NissoMahMan', adminJWT);
        assert.equal(res.status, 200);
        responseBody = await res.json();
        assert(responseBody.length == 50);

        res = await sendAuthenticatedRequest('/api/event/organizer/NissoMahMan?skip=60', adminJWT);
        assert.equal(res.status, 200);
        responseBody = await res.json();
        assert(responseBody.length == 40);

        res = await sendAuthenticatedRequest('/api/event/organizer/NissoMahMan?limit=0', adminJWT);
        assert.equal(res.status, 200);
        responseBody = await res.json();
        assert(responseBody.length == 50);

        while (newCreatedEventIds.length > 0) {
            let poppedID = newCreatedEventIds.pop();
            res = await sendAuthenticatedRequest('/api/event/' + poppedID, adminJWT, 'DELETE');
            assert.equal(res.status, 200);
        }

        res = await sendAuthenticatedRequest('/api/event/organizer/NissoMahMan', adminJWT);
        assert.equal(res.status, 200);
        responseBody = await res.json();
        assert(responseBody.length == 0);
    }
    catch (err) {
        consoleLogRed("[FAILED]");
        console.error("Error getting events: ", err);
        return false;
    }

    consoleLogGreen("[OK]");
    return true;
}

async function lastMinuteTest() {
    process.stdout.write("Last Minute Test ........................");
    let res;
    try {
        // Piazza @99
        let newEvent = { ...specialEvent };
        newEvent.image = [];
        res = await sendAuthenticatedRequest('/api/event', adminJWT, 'POST', JSON.stringify(newEvent));
        assert.equal(res.status, 400);

        // Piazza @100
        const reqBody = JSON.stringify({ username: "shouldfailuser", password: "" })
        res = await sendRequest('/api/signup', 'POST', reqBody);
        assert.equal(res.status, 400);
        res = await sendRequest('/api/login', 'POST', reqBody);
        assert.equal(res.status, 400); // Piazza @103

        // Piazza @108
        res = await sendAuthenticatedRequest('/api/event', adminJWT, 'POST', JSON.stringify(specialEvent));
        assert.equal(res.status, 201);
        let createdEvent = await res.json();
        assert(createdEvent._id);
        res = await sendAuthenticatedRequest('/api/event/' + createdEvent._id, adminJWT, 'PUT', JSON.stringify({}));
        assert.equal(res.status, 200);
    }
    catch (err) {
        consoleLogRed("[FAILED]");
        console.error("Error getting events: ", err);
        return false;
    }

    consoleLogGreen("[OK]");
    return true;
}


async function runAll() {
    let passedAll = true;
    createWorker(); // After the worker has been created you may comment this out
    createManager(); // After the manager has been created you may comment this out
    passedAll = passedAll && await signupTest1();
    passedAll = passedAll && await signupTest2();
    passedAll = passedAll && await updatePermissionsTest1();
    passedAll = passedAll && await updatePermissionsTest2();
    passedAll = passedAll && await getEventByIdTest1();
    passedAll = passedAll && await getEventByCategoryTest1();
    passedAll = passedAll && await getEventByOrgTest1();
    passedAll = passedAll && await createEventTest(1);
    passedAll = passedAll && await createEventTest(2);
    passedAll = passedAll && await createEventTest(3);
    passedAll = passedAll && await getEventByOrgTest2();
    passedAll = passedAll && await getEventByCategoryTest2(); // Can only run after events have been created
    passedAll = passedAll && await getEventByIdTest2();
    passedAll = passedAll && await useQueryParams1();
    passedAll = passedAll && await useQueryParams2();
    passedAll = passedAll && await useQueryParams3();
    passedAll = passedAll && await deleteEvent(1);
    passedAll = passedAll && await deleteEvent(2);
    passedAll = passedAll && await deleteEvent(3);
    passedAll = passedAll && await deleteNonexistingEvent();
    passedAll = passedAll && await createAndDeleteEvent();
    passedAll = passedAll && await createInvalidEventTest1();
    passedAll = passedAll && await createInvalidEventTest2();
    passedAll = passedAll && await createEventWithUselessFields();
    passedAll = passedAll && await IncompleteDataTest();
    passedAll = passedAll && await invalidTokenTest();
    passedAll = passedAll && await updateEventTest1();
    passedAll = passedAll && await updateEventTest2();
    passedAll = passedAll && await updateEventTest3();
    passedAll = passedAll && await updateEventTest4();
    passedAll = passedAll && await updateEventTest5();
    passedAll = passedAll && await signupTest3();
    passedAll = passedAll && await errorsTest();
    passedAll = passedAll && await queryLimitTest();
    passedAll = passedAll && await lastMinuteTest();
    // Test - Try updating event with worker to make sure it failed

    if (passedAll) {
        consoleLogGreen("All tests passed!");
    } else {
        consoleLogRed("Some tests failed.");
    }
}

runAll();
