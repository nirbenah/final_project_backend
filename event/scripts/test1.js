
import assert from 'assert';
import { v4 as uuidv4 } from "uuid";
import fetch from "node-fetch"
import * as dotenv from "dotenv";

const args = process.argv.slice(2);
assert(args.length <= 1, 'usage: node test.js [url]');
dotenv.config();

const url = (args.length == 0) ? `http://localhost:${process.env.PORT}` : args[0];

const event1 = `{"title": "Marvel Festival",
    "category": "Festival",
    "description": "Some stuff.",
    "organizer": "Superman",
    "start_date": "2025-03-01T09:00",
    "end_date": "2025-03-01T19:00",
    "location": "Taub Haifa",
    "tickets":[
        {"name":"Entrance", "quantity":10, "price":20},
        {"name":"Photo", "quantity":10, "price":3000}]}`;

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

async function baseTest() {

    let res = await sendRequest('/api/segel')
    assert.equal(res.status, 404) // Changed here to 404 from 401

    let user = uuidv4().substring(0, 8);
    let pass = '1234'
    let reqBody = JSON.stringify({ username: user, password: pass })
    res = await sendRequest('/api/signup', 'POST', reqBody)
    assert.equal(res.status, 201)

    res = await sendRequest('/api/login', 'POST', reqBody)
    assert.equal(res.status, 200)
    let jwt = (await res.json()).token
    assert(jwt)

    res = await sendRequest('/api/event/Convention', 'GET', '', { authorization: `Bearer ${jwt}`})
    assert.equal(res.status, 200)

    console.log('Basic Test - Passed')
}

async function evetTests1() { 
    console.log("Start eventTests1");
    // Login with my username, so won't junk the DB
    let user = 'admin';
    let pass = 'admin'
    let reqBody = JSON.stringify({ username: user, password: pass });
    let res = await sendRequest('/api/login', 'POST', reqBody);
    assert.equal(res.status, 200)
    let jwt = (await res.json()).token
    assert(jwt);
    
    // Create an event
    reqBody = (event1);
    res = await sendRequest('/api/event', 'POST', reqBody);
    assert.equal(res.status, 401); // No autorization!
    res = await sendRequest('/api/event', 'POST', reqBody, { authorization: `Bearer ${jwt}`});
    assert.equal(res.status, 201);
    let event_id = (await res.json())._id;
    assert(event_id);

    // Get event
    res = await sendRequest(`/api/event/${event_id}`, 'GET', '', { authorization: `Bearer ${jwt}`});
    assert.equal(res.status, 200);
    assert.equal((await res.json()).title, "Marvel Festival");

    // Update Event
    res = await sendRequest(`/api/event/${event_id}`, 'PUT', JSON.stringify({"title" : "Better Than Marvel Festival!"}), { authorization: `Bearer ${jwt}`}); 
    assert.equal(res.status, 200);
    assert.equal(JSON.parse(await res.json())._id, event_id);

    // Delete Event
    res = await sendRequest(`/api/event/${event_id}`, 'DELETE', '', { authorization: `Bearer ${jwt}`});
    assert.equal(res.status, 200);
    
    // Get Deleted Event
    res = await sendRequest(`/api/event/${event_id}`, 'GET', '', { authorization: `Bearer ${jwt}`});
    assert.equal(res.status, 404);

    // Delete Deleted Event - OK since don't exist
    res = await sendRequest(`/api/event/${event_id}`, 'DELETE', '', { authorization: `Bearer ${jwt}`});
    assert.equal(res.status, 200);

    console.log("End eventTests1");
}

async function evetTests2() { 
    console.log("Start eventTests2");
    // Login with my username, so won't junk the DB
    let user = 'nimrodr';
    let pass = '123'
    let reqBody = JSON.stringify({ username: user, password: pass });
    let res = await sendRequest('/api/login', 'POST', reqBody);
    assert.equal(res.status, 200)
    let res_json = await res.json();
    let jwt = res_json.token
    assert(jwt);

    // Get all events "Festival"
    res = await sendRequest('/api/event/Festival', 'GET', '', { authorization: `Bearer ${jwt}`});
    assert.equal(res.status, 200);

    // Get all events organizer "Superman"
    let res1 = await sendRequest('/api/event/organizer/Superman', 'GET', '', { authorization: `Bearer ${jwt}`});
    assert.equal(res1.status, 200);

    // Assert same amount of events
    assert.equal((await res.json()).length, (await res1.json()).length);

    // Get 5 events "Festival"
    res = await sendRequest('/api/event/Festival?limit=5', 'GET', '', { authorization: `Bearer ${jwt}`});
    assert.equal(res.status, 200);

    // Get 7 events organizer "Superman"
    res1 = await sendRequest('/api/event/organizer/Superman?limit=7', 'GET', '', { authorization: `Bearer ${jwt}`});
    assert.equal(res1.status, 200);

    // Assert amount of events
    assert.equal((await res.json()).length, 5);
    assert.equal((await res1.json()).length, 7);

    // Get by empty catagory
    res = await sendRequest('/api/event/Exhibition', 'GET', '', { authorization: `Bearer ${jwt}`});
    assert.equal(res.status, 200);
    assert(Array.isArray(await res.json()));

    // Get by empty organizer
    res = await sendRequest('/api/event/organizer/Batman', 'GET', '', { authorization: `Bearer ${jwt}`});
    assert.equal(res.status, 200);
    assert(Array.isArray(await res.json()));
    

    console.log("End eventTests2");
}

async function userTests1() { 
    console.log("Start userTests1");
    // Login with my username, so won't junk the DB
    let user = 'nimrodr';
    let pass = '123'
    let reqBody = JSON.stringify({ username: user, password: pass });
    // Try to signup again
    let res = await sendRequest('/api/signup', 'POST', reqBody);
    assert.equal(res.status, 400)

    // Login
    res = await sendRequest('/api/login', 'POST', reqBody);
    assert.equal(res.status, 200)
    let jwt = (await res.json()).token
    assert(jwt);
    
    console.log("End userTests1");
}

async function errorTests1() { // Appendix 3 examples errors
    console.log("Start errorTests1");
    // Login 
    let reqBody = JSON.stringify({ username: "nimrodr", password: "123" });
    let res = await sendRequest('/api/login', 'POST', reqBody);
    assert.equal(res.status, 200)
    let jwt = (await res.json()).token
    assert(jwt);

    // Login Worker
    reqBody = JSON.stringify({ username: "worker", password: "123456" });
    res = await sendRequest('/api/login', 'POST', reqBody);
    assert.equal(res.status, 200)
    let jwt_worker = (await res.json()).token
    assert(jwt_worker);

    // Login admin
    reqBody = JSON.stringify({ username: "admin", password: "admin" });
    res = await sendRequest('/api/login', 'POST', reqBody);
    assert.equal(res.status, 200)
    let jwt_admin = (await res.json()).token
    assert(jwt_worker);
 

    // --------------------- 404 --------------------- // 
    
    // Sending a request to an existing path with the wrong method: DELETE /api/login
    res = await sendRequest('/api/login', 'DELETE');
    assert.equal(res.status, 404);

    // Sending a request to a nonexistent route: GET /api/card
    res = await sendRequest('/api/card', 'GET');
    assert.equal(res.status, 404);

    // Sending a GET or PUT request for an item that does not exist in the database: GET /api/event/1234
    res = await sendRequest(`/api/event/1234`, 'GET', '', { authorization: `Bearer ${jwt}`});
    assert.equal(res.status, 404);
    res = await sendRequest(`/api/event/1234`, 'PUT', JSON.stringify({"title" : "Better Than Marvel Festival!"}), { authorization: `Bearer ${jwt}`}); 
    assert.equal(res.status, 404);

    // --------------------- 400 --------------------- //
    // An invalid JSON body format
    const resBody = "{ \"title\" \"I forgot the :\" }";
    res = await sendRequest('/api/signup', 'POST', resBody);
    assert.equal(res.status, 400);
    
    // The body does not fit the requirement of the resource.
    res = await sendRequest('/api/login', 'POST', JSON.stringify({"username": "test"}));
    assert.equal(res.status, 400);

    let event_bad_cat = event1.replace(/Festival/g, "[Festival]");
    res = await sendRequest('/api/event', 'POST', event_bad_cat, { authorization: `Bearer ${jwt}`});
    assert.equal(res.status, 400);

    reqBody = JSON.stringify({ username: "nimrodr", password: "123" });
    res = await sendRequest('/api/signup', 'POST', reqBody);
    assert.equal(res.status, 400);

    // --------------------- 401 --------------------- //
    //Sending a request with no JWT token
    res = await sendRequest('/api/event', 'POST', event1);
    assert.equal(res.status, 401);

    // Invalid JWT token
    res = await sendRequest('/api/event', 'POST', event1, { authorization: `Bearer ${jwt}a`});
    assert.equal(res.status, 401);

    res = await sendRequest('/api/event', 'POST', event1, { authorization: `Bearer ${jwt.replace('a', 'b').replace('0', '1')}`});
    assert.equal(res.status, 401);

    // Expired JWT token
    const expired_jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY1ZTA0MjViZTU5NDJjOWFhNTMzZGQyMiIsImlhdCI6MTcwOTE5NzAzNCwiZXhwIjoxNzA5MjgzNDM0fQ.RwqjfnAEZEDXRMUcXzxrxUYQ8lUx1owdQZ_shFcrNQ0";
    res = await sendRequest('/api/event', 'POST', event1, { authorization: `Bearer ${expired_jwt}`});
    assert.equal(res.status, 401);
    
    // Incorrect user login credentials
    reqBody = JSON.stringify({ username: "nimrodr", password: "1234" });
    res = await sendRequest('/api/login', 'POST', reqBody);
    assert.equal(res.status, 401)

    // --------------------- 403 --------------------- //
    // Get event
    // res = await sendRequest('/api/event/organizer/Superman?limit=1&skip=2', 'GET', '', { authorization: `Bearer ${jwt}`});
    // const event_id = (await res.json())[0]._id;
    // assert.equal(res.status, 200)

    // manager sending an update permission
    res = await sendRequest(`/api/permission`, 'PUT', JSON.stringify({"username" : "nimrodr", "permission" : "W"}), { authorization: `Bearer ${jwt}`}); 
    assert.equal(res.status, 403);

    // worker sending a create event request.
    res = await sendRequest('/api/event', 'POST', event1, { authorization: `Bearer ${jwt_worker}`});
    assert.equal(res.status, 403);

    // --------------------- Validation order examples --------------------- //
    res = await sendRequest('/api/event', 'POST', event_bad_cat); // 401 before 400
    assert.equal(res.status, 401);

    res = await sendRequest('/api/event', 'POST', event_bad_cat, { authorization: `Bearer ${jwt_worker}`}); //403 before 400
    assert.equal(res.status, 403);
    
    res = await sendRequest(`/api/event/123`, 'PUT', resBody, { authorization: `Bearer ${jwt_admin}`}); // 400 before 404
    assert.equal(res.status, 400);

    console.log("End errorTests1");

}

async function advancedTests() {
    console.log("Start advancedTests");
    // Login Manager
    let reqBody = JSON.stringify({ username: "nimrodr", password: "123" });
    let res = await sendRequest('/api/login', 'POST', reqBody);
    assert.equal(res.status, 200)
    let jwt = (await res.json()).token
    assert(jwt);

    // Login Worker
    reqBody = JSON.stringify({ username: "worker", password: "123456" });
    res = await sendRequest('/api/login', 'POST', reqBody);
    assert.equal(res.status, 200)
    let jwt_worker = (await res.json()).token
    assert(jwt_worker);

    // Login Admin
    reqBody = JSON.stringify({ username: "admin", password: "admin" });
    res = await sendRequest('/api/login', 'POST', reqBody);
    assert.equal(res.status, 200)
    let jwt_admin = (await res.json()).token
    assert(jwt_worker);

    // Invalid permission
    res = await sendRequest(`/api/permission`, 'PUT', JSON.stringify({"username" : "nimrodr", "permission" : "A"}), { authorization: `Bearer ${jwt_admin}`});
    assert.equal(res.status, 400);

    // More then 50 events
    res = await sendRequest('/api/event/Festival?limit=60', 'GET', '', { authorization: `Bearer ${jwt}`});
    assert.equal(res.status, 200);
    assert.equal((await res.json()).length, 50);

    // 400 before 404
    const resBody = "{ \"title\" \"I forgot the :\" }";
    res = await sendRequest(`/api/event/65e1b1d6a1bf2dbc40df9cdc`, 'PUT', resBody, { authorization: `Bearer ${jwt_admin}`}); // 400 before 404
    assert.equal(res.status, 400);

    //  404
    res = await sendRequest(`/api/event/65e1b1d6a1bf2dbc40df9cdc`, 'PUT', JSON.stringify({"title" : "AA"}), { authorization: `Bearer ${jwt_admin}`}); // 400 before 404
    assert.equal(res.status, 404);

    // 404 api not fount
    res = await sendRequest(`/api/event/65e1b1d6a1bf2dbc40df9cdc`, 'PATCH', resBody, { authorization: `Bearer ${jwt_admin}`}); // 400 before 404
    assert.equal(res.status, 404);

    // Empty password
    reqBody = JSON.stringify({ username: "worker", password: "" });
    res = await sendRequest('/api/login', 'POST', reqBody);
    assert.equal(res.status, 400);

    // Empty username
    reqBody = JSON.stringify({ username: "", password: "123" });
    res = await sendRequest('/api/login', 'POST', reqBody);
    assert.equal(res.status, 400);

    // Update manager permission
    res = await sendRequest(`/api/permission`, 'PUT', JSON.stringify({"username" : "nimrodr", "permission" : "W"}), { authorization: `Bearer ${jwt_admin}`});
    assert.equal(res.status, 200);

    // Try to post from invalid user
    res = await sendRequest(`/api/event/65e1b245298fe7ffcc22f5be`, 'PUT', JSON.stringify({"title" : "ELSE something!"}), { authorization: `Bearer ${jwt}`}); 
    assert.equal(res.status, 403);

    // Return to manager
    res = await sendRequest(`/api/permission`, 'PUT', JSON.stringify({"username" : "nimrodr", "permission" : "M"}), { authorization: `Bearer ${jwt_admin}`});
    assert.equal(res.status, 200);

    // Admin change himself
    res = await sendRequest(`/api/permission`, 'PUT', JSON.stringify({"username" : "admin", "permission" : "W"}), { authorization: `Bearer ${jwt_admin}`});
    assert.equal(res.status, 400);
    
    console.log("End advancedTests");
}


await baseTest();
await evetTests1(); 
await evetTests2();
await userTests1();
await errorTests1();
await advancedTests();